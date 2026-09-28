import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  DeviceTimer,
  validSubscription,
  validTimer,
} from "../notifications/worker.js";
import webpush from "../notifications/node_modules/web-push/src/index.js";
import { createECDH, randomBytes } from "node:crypto";
const sub = () => {
  const key = createECDH("prime256v1");
  key.generateKeys();
  return {
    endpoint: "https://web.push.apple.com/fake-test-endpoint",
    keys: {
      p256dh: key.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    },
  };
};
const fixture = () => {
  const data = new Map();
  let alarm;
  const storage = {
    async get(k) {
      return data.get(k);
    },
    async put(k, v) {
      if (typeof k === "string") data.set(k, v);
      else Object.entries(k).forEach(([k, v]) => data.set(k, v));
    },
    async deleteAll() {
      data.clear();
    },
    async deleteAlarm() {
      alarm = null;
    },
    async setAlarm(t) {
      alarm = t;
    },
  };
  const vapid = webpush.generateVAPIDKeys();
  const env = {
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
    VAPID_SUBJECT: "https://example.com/",
    APP_URL: "https://example.com/app/",
  };
  const device = new DeviceTimer(
    { storage, blockConcurrencyWhile: (fn) => fn() },
    env,
  );
  const call = (path, body, method = "PUT") =>
    device.fetch(
      new Request("https://service.test" + path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  return { device, data, call, alarm: () => alarm };
};
test("subscriptions reject arbitrary hosts, embedded credentials, wrong protocols and invalid keys", () => {
  assert(validSubscription(sub()));
  for (const endpoint of [
    "http://web.push.apple.com/x",
    "https://attacker.test/x",
    "https://web.push.apple.com:444/x",
    "https://user@web.push.apple.com/x",
  ])
    assert(!validSubscription({ ...sub(), endpoint }));
  assert(!validSubscription({ ...sub(), keys: { auth: "bad" } }));
  assert(
    !validTimer({ id: crypto.randomUUID(), deadline: Date.now() + 7200100 }),
  );
  assert(!validTimer({ id: crypto.randomUUID(), deadline: Date.now() - 1 }));
});
test("service enforces origin, private pairing and device credential before accessing storage", async () => {
  const env = {
    APP_ORIGIN: "https://example.com",
    PAIRING_CODE: "private-code",
  };
  for (const [headers, expected] of [
    [{ Origin: "https://evil.test" }, 403],
    [{}, 401],
    [
      {
        Authorization: "Bearer " + "a".repeat(64),
        "X-Pairing-Code": "wrong-code",
      },
      403,
    ],
  ]) {
    const r = await worker.fetch(
      new Request("https://service.test/register", {
        method: "POST",
        headers,
        body: "{}",
      }),
      env,
    );
    assert.equal(r.status, expected);
  }
});
test("one timer/device: extend replaces deadline, stale requests cannot restore old timers, pause cancels, disconnect revokes", async () => {
  const f = fixture(),
    t = { id: crypto.randomUUID(), deadline: Date.now() + 10000 };
  assert.equal((await f.call("/timer", { revision: 1, timer: t })).status, 410);
  await f.call("/register", { subscription: sub() }, "POST");
  await f.call("/timer", { revision: 1, timer: t });
  assert.equal(f.alarm(), t.deadline);
  await f.call("/timer", {
    revision: 3,
    timer: { ...t, deadline: t.deadline + 60000 },
  });
  assert.equal(
    (await (await f.call("/timer", { revision: 2, timer: t })).json()).stale,
    true,
  );
  assert.equal(f.alarm(), t.deadline + 60000);
  await f.call("/timer", { revision: 4, timer: null });
  assert.equal(f.alarm(), null);
  await f.call("/device", null, "DELETE");
  assert.equal(f.data.size, 0);
  assert.equal((await f.call("/timer", { revision: 5, timer: t })).status, 410);
});
test("alarm sends encrypted Web Push without a page, expires late timers, and deletes revoked subscriptions", async () => {
  const f = fixture();
  await f.call("/register", { subscription: sub() }, "POST");
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, options) => {
    sent = { url, options };
    return new Response(null, { status: 201 });
  };
  try {
    f.data.set("timer", { id: crypto.randomUUID(), deadline: Date.now() - 1 });
    await f.device.alarm();
    assert.equal(sent.options.headers["Content-Encoding"], "aes128gcm");
    assert.equal(sent.options.headers.TTL, 30);
    assert.equal(f.data.get("timer"), null);
    sent = null;
    f.data.set("timer", {
      id: crypto.randomUUID(),
      deadline: Date.now() - 61000,
    });
    await f.device.alarm();
    assert.equal(sent, null);
    globalThis.fetch = async () => new Response(null, { status: 410 });
    f.data.set("timer", { id: crypto.randomUUID(), deadline: Date.now() - 1 });
    await f.device.alarm();
    assert.equal(f.data.size, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("unsigned random device IDs cannot allocate durable objects or schedule timers", async () => {
  let allocated = false;
  const env = {
    APP_ORIGIN: "https://example.com",
    PAIRING_CODE: "private-pairing-code",
    TIMERS: {
      idFromName() {
        allocated = true;
      },
    },
  };
  for (const authorization of [
    "a".repeat(64),
    "a".repeat(64) + "." + "b".repeat(64),
  ]) {
    const response = await worker.fetch(
      new Request("https://service.test/timer", {
        method: "PUT",
        headers: { Authorization: "Bearer " + authorization },
        body: "{}",
      }),
      env,
    );
    assert.equal(response.status, 401);
    assert.equal(allocated, false);
  }
});
