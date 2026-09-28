import { chromium } from "playwright";
import assert from "node:assert/strict";
import { serve } from "../scripts/serve.js";
const server = serve(0);
await new Promise((r) => server.on("listening", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.OLY_BROWSER_CHANNEL || "chrome",
});
const context = await browser.newContext({
  permissions: ["notifications"],
  viewport: { width: 390, height: 844 },
});
const requests = [],
  errors = [];
// Only the push provider and online service are stubbed. The real app, its
// service worker, permission call, UI and deadline lifecycle run in Chromium.
await context.addInitScript(() => {
  const subscription = {
    options: {},
    toJSON: () => ({
      endpoint: "https://web.push.apple.com/test",
      keys: { auth: "test", p256dh: "test" },
    }),
    unsubscribe: async () => true,
  };
  Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", {
    get() {
      return {
        getSubscription: async () => null,
        subscribe: async () => subscription,
      };
    },
  });
});
await context.route(
  "https://oly-timer-notifications.oly-timer-notifications.workers.dev/**",
  async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    const body = req.postDataJSON();
    requests.push({ path, method: req.method(), body });
    const value =
      path === "/config"
        ? { publicKey: "BA".repeat(43) + "A" }
        : path === "/register"
          ? { connected: true, credential: "private-device-credential" }
          : { revision: body?.revision, scheduled: body?.timer?.id || null };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, X-Pairing-Code",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      },
    });
  },
);
let page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const click = (name) => page.getByRole("button", { name, exact: true }).click();
try {
  await page.goto(origin);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await click("Settings");
  await page
    .getByLabel("Connection code", { exact: true })
    .fill("private-test-code");
  await click("Enable background notifications");

  await page
    .getByRole("button", { name: "Disconnect notifications", exact: true })
    .waitFor();
  await click("Test with phone locked · 10 seconds");
  await page.waitForFunction(() =>
    document
      .querySelector("[data-push-state]")
      .textContent.includes("Background alert saved"),
  );
  assert(requests.some((r) => r.body?.timer?.deadline > Date.now()));
  assert(
    requests.every(
      (r) =>
        !r.body?.timer ||
        Object.keys(r.body.timer).sort().join() === "deadline,id",
    ),
  );
  await click("Cancel alarm");
  await page.waitForFunction(() =>
    document
      .querySelector("[data-push-state]")
      .textContent.includes("no background alert scheduled"),
  );
  assert.equal(requests.at(-1).body.timer, null);
  // Send a synthetic push through Chromium's actual worker infrastructure,
  // after closing the last app page. This is not proof of APNs/iPhone delivery.
  const cdp = await context.newCDPSession(page);
  let registrations = [];
  cdp.on("ServiceWorker.workerRegistrationUpdated", (event) =>
    registrations.push(...event.registrations),
  );
  await cdp.send("ServiceWorker.enable");
  for (let i = 0; i < 20 && !registrations.length; i++)
    await new Promise((r) => setTimeout(r, 100));
  const registration = registrations.find((r) => r.scopeURL === origin + "/");
  assert(registration);
  // A second tab keeps the DevTools transport alive, not the application page.
  const control = await context.newPage();
  const controlCDP = await context.newCDPSession(control);
  await controlCDP.send("ServiceWorker.enable");
  await page.close();
  await controlCDP.send("ServiceWorker.deliverPushMessage", {
    origin,
    registrationId: registration.registrationId,
    data: JSON.stringify({ title: "Timer finished" }),
  });
  page = await context.newPage();
  await page.goto(origin);
  const notifications = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    for (let i = 0; i < 20; i++) {
      const items = await registration.getNotifications();
      if (items.length) {
        const titles = items.map((n) => n.title);
        items.forEach((n) => n.close());
        return titles;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return [];
  });
  assert.deepEqual(notifications, ["Oly Tracker · timer finished"]);
  await click("Settings");
  await click("Disconnect notifications");
  await page
    .getByRole("button", {
      name: "Enable background notifications",
      exact: true,
    })
    .waitFor();
  assert(requests.some((r) => r.path === "/device" && r.method === "DELETE"));
  assert.deepEqual(errors, []);
  console.log(
    "PASS background notification UI: connect, save, cancel, disconnect; real service worker displays synthetic push with the app page closed.",
  );
} catch (error) {
  console.error({
    error: error.message,
    requests,
    errors,
    body: await page.locator("body").innerText(),
  });
  throw error;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
