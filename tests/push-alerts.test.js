import test from "node:test";
import assert from "node:assert/strict";
import { PushAlerts } from "../src/push-alerts.js";
const fixture = () => {
  const values = new Map([
    ["oly_push_device_v1", JSON.stringify({ token: "a".repeat(64) })],
  ]);
  let now = 100000,
    fail = false;
  const requests = [],
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (k, v) => values.set(k, v),
    };
  const alerts = new PushAlerts({
    storage,
    service: "https://service.test",
    now: () => now,
    Notification: { permission: "granted" },
    navigator: {},
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, body });
      if (fail) throw Error("Offline");
      return Response.json({
        scheduled: body.timer?.id || null,
        revision: body.revision,
      });
    },
  });
  return {
    alerts,
    requests,
    setTime: (v) => (now = v),
    fail: (v) => (fail = v),
  };
};
test("client saves one opaque deadline, avoids repeated requests, and updates/cancels on timer changes", async () => {
  const f = fixture(),
    target = {
      key: "private workout:snatch:date",
      label: "Snatch",
      deadline: 120000,
    };
  await f.alerts.sync(target);
  await f.alerts.sync(target);
  assert.equal(f.requests.length, 1);
  assert(!JSON.stringify(f.requests).includes("snatch"));
  assert.match(f.alerts.status, /saved/);
  await f.alerts.sync({ ...target, key: "new", deadline: 180000 });
  assert.equal(f.requests[1].body.timer.deadline, 180000);
  assert(f.requests[1].body.revision > f.requests[0].body.revision);
  await f.alerts.sync(null);
  assert.equal(f.requests[2].body.timer, null);
});
test("offline changes are visibly unconfirmed, retry online, and never schedule an expired countdown", async () => {
  const f = fixture(),
    target = { key: "a", deadline: 120000 };
  f.fail(true);
  await f.alerts.sync(target);
  assert.match(f.alerts.status, /not confirmed/);
  await f.alerts.sync(target);
  assert.equal(f.requests.length, 1);
  f.setTime(106000);
  f.fail(false);
  await f.alerts.sync(target);
  assert.match(f.alerts.status, /saved/);
  f.setTime(121000);
  await f.alerts.sync({ key: "expired", deadline: 120000 });
  assert.equal(f.requests.length, 2);
});
test("a cancellation arriving during a schedule request is sent immediately after it", async () => {
  const f = fixture();
  let release;
  f.alerts.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    f.requests.push({ body });
    if (body.timer) await new Promise((r) => (release = r));
    return Response.json({ revision: body.revision });
  };
  const pending = f.alerts.sync({ key: "a", deadline: 120000 });
  f.alerts.sync(null);
  release();
  await pending;
  await f.alerts.operation;
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].body.timer, null);
});
