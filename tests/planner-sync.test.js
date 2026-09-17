import test from "node:test";
import assert from "node:assert/strict";
import { fresh, deferDay, addDays } from "../src/training.js";
import { dayPlan } from "../src/prescription.js";
import { fixedSession } from "../src/timeline.js";
import {
  buildPlannerFeed,
  forecastSession,
  calibrationDefaults,
  journalEntities,
  adoptJournalEntities,
} from "../src/planner-feed.js";
import { validate } from "../src/storage.js";
import { DriveSync, mergeRevisions, diffEntities } from "../src/cloud-sync.js";
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
};
const rev = (id, parents, changes, writer = id) => ({
  schema: 1,
  app: "test",
  id,
  parents,
  changes,
  writer,
  createdAt: 1,
});
test("reported introductory A calibrates only the matching dose without changing guided timers", () => {
  const s = fresh("2026-09-14"),
    before = JSON.stringify(s);
  const a = dayPlan(s.training, "monday").sessions[0];
  assert.equal(forecastSession(s, a).forecastSeconds, 2700);
  assert.equal(
    forecastSession(s, a).guideSeconds,
    fixedSession(a, s.training).seconds[0],
  );
  assert.equal(
    forecastSession(s, dayPlan(s.training, "tuesday").sessions[0]).basis,
    "model",
  );
  assert.equal(JSON.stringify(s), before);
  s.training.entry = 3;
  s.training.week = 3;
  assert.equal(
    forecastSession(s, dayPlan(s.training, "monday").sessions[0]).basis,
    "model",
  );
});
test("recent matching observations use a median and exclude partial or interrupted sessions", () => {
  const s = fresh("2026-09-14"),
    session = dayPlan(s.training, "tuesday").sessions[0];
  s.calibration = calibrationDefaults();
  for (const [i, min] of [100, 120, 125, 130, 135, 140, 999].entries())
    s.records.push({
      id: String(i),
      status: i === 6 ? "partial" : "complete",
      startedAt: i * 100000000,
      endedAt: i * 100000000 + min * 60000,
      session: structuredClone(session),
      timeConfig: structuredClone(s.training),
    });
  assert.equal(forecastSession(s, session).forecastSeconds, 130 * 60);
  s.calibration.excludedRecordIds.push("5");
  assert.equal(forecastSession(s, session).forecastSeconds, 125 * 60);
  s.training.timing.unilateralCable = false;
  assert.equal(forecastSession(s, session).basis, "model");
});
test("feed follows real dates and preserves the source journal through projection", () => {
  const s = fresh("2026-09-14");
  s.dates.thursday = "2026-09-18";
  s.dates.friday = "2026-09-21";
  const before = JSON.stringify(s),
    feed = buildPlannerFeed(s, Date.parse("2026-09-14T14:00:00Z"));
  assert.equal(feed.entries.length, 4);
  assert.equal(feed.entries.find((e) => e.day === "friday").date, "2026-09-21");
  assert.equal(feed.repeatStart, "2026-09-24");
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(
    validate(adoptJournalEntities(s, journalEntities(s))).training,
    s.training,
  );
});
test("calendar rotations preserve the next A date and all training prescriptions", () => {
  for (let offset = 0; offset < 7; offset++) {
    const s = fresh("2026-12-28");
    const before = JSON.stringify(s.training);
    deferDay(s, "monday", addDays(s.weekStart, offset));
    const feed = buildPlannerFeed(s, Date.parse("2026-12-28T12:00:00Z"));
    assert.deepEqual(
      feed.entries.map((e) => e.date),
      [0, 1, 3, 4].map((n) => addDays(s.weekStart, n + offset)),
    );
    assert.equal(feed.repeatStart, addDays(s.weekStart, 7 + offset));
    assert.equal(JSON.stringify(s.training), before);
  }
});
test("independent revisions merge; concurrent edits and delete/edit conflicts retain both versions", () => {
  const root = rev("root", [], { one: { value: 1 }, two: { value: 2 } });
  const a = rev("a", ["root"], { one: { value: 3 } });
  const b = rev("b", ["root"], { two: { value: 4 } });
  assert.deepEqual(mergeRevisions([root, a, b], "test").entities, {
    one: 3,
    two: 4,
  });
  const del = rev("del", ["root"], { one: { deleted: true } });
  const conflict = mergeRevisions([root, a, del], "test").conflicts[0];
  assert.equal(conflict.key, "one");
  assert.equal(conflict.variants.length, 2);
  assert.deepEqual(
    mergeRevisions(
      [root, a, del, rev("resolved", ["a", "del"], { one: { deleted: true } })],
      "test",
    ).entities,
    { two: 2 },
  );
  assert.deepEqual(diffEntities({ x: 1 }, {}), { x: { deleted: true } });
  assert.throws(() => mergeRevisions([a], "test"), /incomplete/);
  assert.throws(
    () => mergeRevisions([rev("x", ["y"], {}), rev("y", ["x"], {})], "test"),
    /cycle/,
  );
});
test("long histories merge without recursive stack growth or quadratic ancestor storage", () => {
  const revisions = Array.from({ length: 5000 }, (_, i) =>
    rev(String(i), i ? [String(i - 1)] : [], { value: { value: i } }),
  );
  assert.equal(mergeRevisions(revisions, "test").entities.value, 4999);
});
test("private Drive roundtrip handles pagination, offline edits and explicit conflict resolution", async () => {
  const files = [];
  let online = true;
  const fetcher = async (url, options = {}) => {
    if (!online) throw Error("Offline");
    const u = new URL(url);
    if (options.method === "POST") {
      const pieces = options.body.split(
        /Content-Type: application\/json[^\r]*\r\n\r\n/,
      );
      const metadata = JSON.parse(pieces[1].split("\r\n--")[0]),
        data = JSON.parse(pieces[2].split("\r\n--")[0]);
      const id = String(files.length);
      files.push({ id, appProperties: metadata.appProperties, data });
      return { ok: true, json: async () => ({ id }) };
    }
    if (u.searchParams.get("alt") === "media")
      return {
        ok: true,
        json: async () =>
          files.find((f) => f.id === u.pathname.split("/").at(-1)).data,
      };
    const offset = Number(u.searchParams.get("pageToken") || 0);
    return {
      ok: true,
      json: async () => ({
        files: files
          .slice(offset, offset + 2)
          .map(({ id, appProperties }) => ({ id, appProperties })),
        ...(offset + 2 < files.length
          ? { nextPageToken: String(offset + 2) }
          : {}),
      }),
    };
  };
  let left = { value: 1 },
    right = {},
    adopted = 0;
  const a = new DriveSync({
    app: "test",
    storage: memory(),
    getSnapshot: () => left,
    applySnapshot: (s) => {
      left = s;
    },
    hasLocalData: () => true,
    getToken: () => "test-token",
    fetcher,
  });
  const b = new DriveSync({
    app: "test",
    storage: memory(),
    getSnapshot: () => right,
    applySnapshot: (s) => {
      right = s;
      adopted++;
    },
    hasLocalData: () => Object.keys(right).length > 0,
    getToken: () => "test-token",
    fetcher,
  });
  try {
    await a.capture();
    await a.sync();
    await b.sync();
    assert.equal(right.value, 1);
    assert.equal(adopted, 1);
    online = false;
    left = { value: 2, a: 1 };
    right = { value: 3, b: 2 };
    await a.capture();
    await b.capture();
    await a.sync();
    assert.match(a.status, /Offline/);
    online = true;
    await a.sync();
    await b.sync();
    assert.equal(b.conflicts.length, 1);
    assert.equal(right.value, 3);
    const choice = b.conflicts[0].variants.find((v) => v.value === 2);
    await b.resolve("value", choice.revision);
    await a.sync();
    assert.deepEqual(right, { value: 2, a: 1, b: 2 });
    assert.deepEqual(left, right);
    delete right.a;
    await b.capture();
    await b.sync();
    await a.sync();
    assert.equal("a" in left, false);
  } finally {
    clearTimeout(a.timer);
    clearTimeout(b.timer);
  }
});

test("mixed timing coverage counts changing only once and deliberate interruptions stay excluded", () => {
  const s = fresh("2026-09-28"),
    session = dayPlan(s.training, "tuesday").sessions[0];
  s.records = [false, true].map((includes, n) => ({
    id: String(n),
    status: "complete",
    startedAt: n * 100000000,
    endedAt: n * 100000000 + (includes ? 110 : 100) * 60000,
    session,
    timeConfig: s.training,
    timingIncludesChange: includes,
  }));
  const f = forecastSession(s, session);
  assert.equal(f.forecastSeconds + f.postChangeSeconds, 110 * 60);
  s.records.forEach((r) => (r.timingExcluded = true));
  assert.equal(forecastSession(s, session).basis, "model");
});
test("Chicago dates, fixed future weekdays and current readiness flow through the read-only feed", async () => {
  const { localDate, addDays, startSession } = await import(
    "../src/training.js"
  );
  assert.equal(localDate(new Date("2026-11-02T05:30:00Z")), "2026-11-01");
  assert.equal(addDays("2026-10-31", 2), "2026-11-02");
  const now = Date.parse("2026-09-28T12:00:00-05:00"),
    s = fresh("2026-09-28");
  s.readiness = {
    date: "2026-09-28",
    level: "amber",
    event: "normal",
    local: "",
  };
  const planned = buildPlannerFeed(s, now).entries.find(
    (e) => e.day === "monday",
  );
  assert.equal(planned.basis, "model");
  startSession(s, "monday", "main", now);
  const before = JSON.stringify(s),
    active = buildPlannerFeed(s, now + 60000).entries.find(
      (e) => e.day === "monday",
    );
  assert(active.active);
  assert(active.activeRemainingSeconds >= 0);
  assert.equal(JSON.stringify(s), before);
});

test("legacy Planner mirrors recover only an absent Oly journal and never replace current data", async () => {
  const { loadStore, KEY } = await import("../src/storage.js");
  const storage = memory(),
    original = fresh("2026-09-28");
  original.version = 2;
  storage.setItem(
    "day_cache_v1",
    JSON.stringify({
      settings: { tomtomKey: "not-journal-data" },
      olyState: { data: original },
    }),
  );
  const restored = loadStore(storage);
  assert.equal(restored.state.weekId, original.weekId);
  assert(restored.recovered);
  assert(storage.getItem("oly_before_planner_sync"));
  assert(!JSON.stringify(restored.state).includes("not-journal-data"));
  const current = fresh("2026-10-05");
  storage.setItem(KEY, JSON.stringify(current));
  assert.equal(loadStore(storage).state.weekId, current.weekId);
});
