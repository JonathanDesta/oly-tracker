import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";

const json = (value, status = 200) => Response.json(value, { status });
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function credentialSignature(token, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Buffer.from(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode("oly-device:" + token),
    ),
  ).toString("hex");
}
export function validSubscription(s) {
  try {
    const u = new URL(s.endpoint);
    return (
      u.protocol === "https:" &&
      !u.port &&
      !u.username &&
      !u.password &&
      [
        "web.push.apple.com",
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
      ].includes(u.hostname) &&
      /^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh) &&
      /^[A-Za-z0-9_-]{22}$/.test(s.keys.auth) &&
      s.endpoint.length < 4096
    );
  } catch {
    return false;
  }
}
export function validTimer(t, now = Date.now()) {
  return (
    t === null ||
    (t &&
      /^[a-f0-9-]{36}$/.test(t.id) &&
      Number.isSafeInteger(t.deadline) &&
      t.deadline > now &&
      t.deadline <= now + 7200000)
  );
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin"),
      path = new URL(request.url).pathname;
    if (origin && origin !== env.APP_ORIGIN)
      return json({ error: "Origin not allowed." }, 403);
    const headers = {
      "Access-Control-Allow-Origin": env.APP_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-Pairing-Code",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const respond = (r) =>
      new Response(r.body, {
        status: r.status,
        headers: { ...Object.fromEntries(r.headers), ...headers },
      });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (path === "/config" && request.method === "GET")
      return respond(json({ publicKey: env.VAPID_PUBLIC_KEY }));
    const [token, signature] = (
      request.headers.get("Authorization")?.replace(/^Bearer /, "") || ""
    ).split(".");
    if (!/^[a-f0-9]{64}$/.test(token || ""))
      return respond(json({ error: "Device sign-in required." }, 401));
    if (
      path === "/register" &&
      !equal(request.headers.get("X-Pairing-Code"), env.PAIRING_CODE)
    )
      return respond(json({ error: "Incorrect connection code." }, 403));
    if (
      path !== "/register" &&
      (!/^[a-f0-9]{64}$/.test(signature || "") ||
        !equal(signature, await credentialSignature(token, env.PAIRING_CODE)))
    )
      return respond(
        json({ error: "Reconnect notifications on this device." }, 401),
      );
    if (!["/register", "/timer", "/device"].includes(path))
      return respond(json({ error: "Not found." }, 404));
    if (Number(request.headers.get("Content-Length")) > 8192)
      return respond(json({ error: "Request too large." }, 413));
    const body = await request.text();
    if (body.length > 8192)
      return respond(json({ error: "Request too large." }, 413));
    const hash = Buffer.from(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ).toString("hex");
    try {
      const r = await env.TIMERS.get(env.TIMERS.idFromName(hash)).fetch(
        new Request(request.url, {
          method: request.method,
          headers: { "Content-Type": "application/json" },
          ...(body ? { body } : {}),
        }),
      );
      if (path === "/register" && r.ok)
        return respond(
          json({
            connected: true,
            credential: `${token}.${await credentialSignature(token, env.PAIRING_CODE)}`,
          }),
        );
      return respond(r);
    } catch {
      return respond(
        json({ error: "Notification service unavailable. Try again." }, 503),
      );
    }
  },
};

export class DeviceTimer {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const path = new URL(request.url).pathname,
        storage = this.ctx.storage;
      let body;
      try {
        body = request.method === "DELETE" ? null : await request.json();
      } catch {
        return json({ error: "Invalid request." }, 400);
      }
      if (path === "/register" && request.method === "POST") {
        if (!validSubscription(body?.subscription))
          return json({ error: "Unsupported notification subscription." }, 400);
        await storage.put("subscription", body.subscription);
        return json({ connected: true });
      }
      if (!(await storage.get("subscription")))
        return json({ error: "Reconnect notifications on this device." }, 410);
      if (path === "/device" && request.method === "DELETE") {
        await storage.deleteAlarm();
        await storage.deleteAll();
        return json({ connected: false });
      }
      if (path !== "/timer" || request.method !== "PUT")
        return json({ error: "Not found." }, 404);
      if (
        !Number.isSafeInteger(body?.revision) ||
        body.revision <= 0 ||
        !validTimer(body.timer)
      )
        return json({ error: "Invalid timer deadline." }, 400);
      const revision = (await storage.get("revision")) || 0;
      if (body.revision <= revision) return json({ stale: true, revision });
      await storage.put({ revision: body.revision, timer: body.timer });
      if (body.timer) await storage.setAlarm(body.timer.deadline);
      else await storage.deleteAlarm();
      return json({
        scheduled: body.timer?.id || null,
        revision: body.revision,
      });
    });
  }
  async alarm() {
    return this.ctx.blockConcurrencyWhile(async () => {
      const storage = this.ctx.storage,
        timer = await storage.get("timer"),
        subscription = await storage.get("subscription");
      if (!timer || !subscription) return;
      if (timer.deadline > Date.now()) {
        await storage.setAlarm(timer.deadline);
        return;
      }
      // Never deliver a forgotten timer hours later after a service interruption.
      if (Date.now() - timer.deadline > 60000) {
        await storage.put("timer", null);
        return;
      }
      const notification = {
        title: "Oly Tracker · timer finished",
        body: "Your countdown has finished. Open Oly Tracker for the next step.",
        tag: "oly-timer",
        icon: this.env.APP_URL + "icon.svg",
        data: { url: this.env.APP_URL, timerId: timer.id },
      };
      const details = webpush.generateRequestDetails(
        subscription,
        JSON.stringify(notification),
        {
          TTL: 30,
          urgency: "high",
          topic: "oly-timer",
          vapidDetails: {
            subject: this.env.VAPID_SUBJECT,
            publicKey: this.env.VAPID_PUBLIC_KEY,
            privateKey: this.env.VAPID_PRIVATE_KEY,
          },
        },
      );
      const response = await fetch(details.endpoint, {
        method: details.method,
        headers: details.headers,
        body: details.body,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if ([404, 410].includes(response.status)) {
        await storage.deleteAlarm();
        await storage.deleteAll();
        return;
      }
      if (!response.ok) throw Error("Push provider rejected delivery.");
      await storage.put("timer", null);
    });
  }
}
