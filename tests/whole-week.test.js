import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  planFor,
  startSession,
  omissionRecord,
  stopSession,
  logSet,
  nextRow,
  advanceWeek,
  scheduledDate,
  rowStatus,
} from "../src/training.js";
import { dayPlan } from "../src/prescription.js";
import {
  DOSE_VERSION,
  REGIONAL_DOSE_VERSION,
  doseLedger,
} from "../src/dose.js";
import { programDays, slotLabel } from "../src/calendar.js";
import { fixedDay, fixedSession } from "../src/timeline.js";
import { validate } from "../src/storage.js";
import { buildPlannerFeed } from "../src/planner-feed.js";
import { applyChange } from "../src/review.js";
import { syncPacing } from "../src/pacing.js";
const base = () => {
  const s = fresh("2026-10-05", "weekday", "all-failure");
  Object.assign(s.training, {
    week: 3,
    entry: 3,
    failureEntry: 4,
    failureWeeks: ["a", "b"],
  });
  s.training.scheduleTrial.weeks = ["a", "b"];
  return s;
};
const monday = Date.parse("2026-10-05T13:00:00-05:00"),
  wednesday = monday + 2 * 86400000;
const ready = (s, date) =>
  (s.readiness = { date, level: "green", event: "normal", local: "" });

test("whole-week recommendation has three specific exposures per lift, recovery days and exact 20/16/20 assistance", () => {
  const s = base(),
    days = programDays(s.training);
  const plans = days.map((d) => dayPlan(s.training, d));
  assert.deepEqual(
    plans.map((p) => doseLedger([p]).conventional),
    [20, 0, 16, 0, 20, 0, 0],
  );
  assert.deepEqual(
    plans.map((p) => doseLedger([p]).olympic),
    [4, 0, 4, 0, 4, 0, 0],
  );
  for (const d of ["tuesday", "thursday", "friday"]) {
    const rows = dayPlan(s.training, d).sessions[0].rows;
    assert.deepEqual(
      rows
        .slice(0, 2)
        .map((e) => e.id)
        .sort(),
      ["cj", "snatch"],
    );
    assert(rows.every((e) => !["hang", "jerk", "pull"].includes(e.id)));
  }
  assert.match(slotLabel(s.training, "thursday"), /wednesday/);
  assert.equal(scheduledDate(s, "thursday"), "2026-10-07");
  assert.equal(scheduledDate(s, "friday"), "2026-10-09");
  const week = doseLedger(plans);
  assert.equal(week.conventional, 56);
  assert.equal(week.olympic, 12);
  const feed = buildPlannerFeed(s, monday);
  assert.deepEqual(
    feed.entries.map((e) => e.date),
    ["2026-10-05", "2026-10-07", "2026-10-09"],
  );
  for (const e of feed.entries) {
    assert.equal(e.visits, 1);
    assert.equal(e.forecastSeconds, e.guideSeconds);
  }
  assert.deepEqual(validate(s), s);
});

test("athletics runs between Olympic work and assistance in one visit, with runnable local preparation", () => {
  const s = base();
  s.training.athletics.enabled = true;
  const p = dayPlan(s.training, "thursday"),
    t = fixedDay(p, s.training);
  assert.deepEqual(
    p.sessions.map((se) => se.id),
    ["main", "athletics", "support"],
  );
  assert.equal(t.visits, 1);
  assert.equal(t.gapSeconds, 0);
  assert.equal(doseLedger([p]).conventional, 16);
  assert(
    t.sessions
      .find((se) => se.id === "support")
      .overhead.general.every((n) => n === 0),
  );
  assert.equal(
    t.sessions.reduce((n, se) => n + se.overhead.breaks[0], 0),
    600,
  );
  ready(s, "2026-10-07");
  omissionRecord(
    s,
    "tuesday",
    "main",
    "Synthetic completed prerequisite",
    monday,
  );
  assert.throws(
    () => startSession(s, "thursday", "support", wednesday),
    /Resolve Olympic/,
  );
  omissionRecord(s, "thursday", "main", "Synthetic prerequisite", wednesday);
  assert.throws(
    () => startSession(s, "thursday", "support", wednesday),
    /Resolve Olympic/,
  );
  omissionRecord(
    s,
    "thursday",
    "athletics",
    "Synthetic prerequisite",
    wednesday,
  );
  assert.throws(
    () =>
      advanceWeek(
        s,
        {
          notes: "Unfinished assistance",
          action: "advance",
          green: true,
          recovery: "normal",
        },
        wednesday,
      ),
    /Resolve/,
  );
  ready(s, "2026-10-09");
  assert.throws(
    () => startSession(s, "friday", "main", monday + 4 * 86400000),
    /Resolve C/,
  );
  ready(s, "2026-10-07");
  startSession(s, "thursday", "support", wednesday);
  assert(!s.active.warmup);
  assert(!s.active.timeConfig.continuation);
  assert.equal(
    s.active.pacing.plan.reduce((n, p) => n + p.seconds, 0),
    fixedSession(s.active.session, s.active.timeConfig, s.active.timeConfig)
      .seconds[0],
  );
  const e = nextRow(s.active);
  s.active.warmup = true;
  s.active.preparations.push(e.key);
  logSet(s, { weight: 100, reps: 10, endpoint: "failure" }, wednesday + 1000);
  syncPacing(
    s.active,
    Object.fromEntries(
      s.active.session.rows.map((e) => [e.key, rowStatus(s.active, e)]),
    ),
    wednesday + 1000,
  );
  assert.deepEqual(validate(s), s);
  const activeFeed = buildPlannerFeed(s, wednesday + 1000).entries.find(
    (e) => e.day === "thursday",
  );
  assert(activeFeed.activeRemainingSeconds > 0);
  stopSession(s, "Synthetic fixture finished", wednesday + 2000);
  assert.equal(s.records.at(-1).session.id, "support");
});

test("pivot athletics does not create an empty prerequisite or disappear from Planner", () => {
  const s = base();
  s.training.week = 13;
  s.training.athletics.enabled = true;
  const p = dayPlan(s.training, "thursday");
  assert.deepEqual(
    p.sessions.map((se) => se.id),
    ["athletics", "support"],
  );
  assert(p.sessions.every((se) => se.rows.length));
  assert.equal(fixedDay(p, s.training).visits, 1);
  assert(
    buildPlannerFeed(s, monday).entries.some(
      (e) => e.day === "thursday" && e.modules.some((m) => m.id === "support"),
    ),
  );
});

test("7.18 started weeks keep their calendar until review; fresh upgrades adopt and pause old trials", () => {
  const s = base();
  s.training.doseVersion = REGIONAL_DOSE_VERSION;
  s.training.trials = [
    {
      id: "old",
      kind: "set",
      day: "tuesday",
      exercise: "row",
      startedAt: monday,
      reason: "Prior allocation",
      baseline: "Prior",
      status: "testing",
      paused: false,
      reviews: [],
    },
  ];
  ready(s, "2026-10-05");
  startSession(s, "tuesday", "main", monday);
  const old = structuredClone(s.active);
  let upgraded = validate(s);
  assert.deepEqual(upgraded.active, old);
  assert.equal(upgraded.training.doseVersion, REGIONAL_DOSE_VERSION);
  assert.equal(upgraded.training.nextDoseVersion, DOSE_VERSION);
  stopSession(upgraded, "Synthetic boundary", monday + 1000);
  assert.equal(scheduledDate(upgraded, "thursday"), "2026-10-06");
  for (const day of programDays(upgraded.training))
    if (
      dayPlan(upgraded.training, day).sessions.some((se) => se.id === "main") &&
      !upgraded.records.some(
        (r) => r.weekId === upgraded.weekId && r.day === day,
      )
    )
      omissionRecord(
        upgraded,
        day,
        "main",
        "Synthetic boundary",
        monday + 1000,
      );
  advanceWeek(
    upgraded,
    {
      action: "advance",
      green: true,
      recovery: "normal",
      notes: "Resolve old week",
      scheduleQuality: true,
    },
    monday + 2000,
  );
  assert.equal(upgraded.training.doseVersion, DOSE_VERSION);
  assert.equal(upgraded.training.failureEntry, 2);
  assert(upgraded.training.trials.every((t) => t.paused));
  assert.deepEqual(upgraded.records[0].session, old.session);
  assert.match(slotLabel(upgraded.training, "thursday"), /wednesday/);
  const empty = base();
  empty.training.doseVersion = REGIONAL_DOSE_VERSION;
  assert.equal(validate(empty).training.doseVersion, DOSE_VERSION);
});

test("Wednesday assistance supports controlled set trials and all 52-week module timing remains finite", () => {
  const s = base();
  applyChange(
    s,
    {
      kind: "set",
      exercise: "row",
      day: "thursday",
      reason: "Comparable response review",
      ready: true,
      stable: true,
    },
    monday,
  );
  assert.equal(
    dayPlan(s.training, "thursday").sessions[0].rows.find((e) => e.id === "row")
      .sets,
    5,
  );
  assert.deepEqual(validate(s), s);
  for (let cycle = 1; cycle <= 4; cycle++)
    for (let week = 1; week <= 13; week++) {
      const t = base().training;
      Object.assign(t, { cycle, week, gate: "R" });
      t.athletics.enabled = true;
      t.athletics.secondary = 1;
      t.cardio.enabled = true;
      t.cardio.minutes = 150;
      t.mobility = ["Ankle dorsiflexion"];
      t.mobilityDays = 4;
      for (const day of programDays(t)) {
        const p = dayPlan(t, day),
          time = fixedDay(p, t);
        assert(Number.isFinite(time.seconds[0]));
        assert.equal(
          time.seconds[0],
          time.sessions.reduce(
            (n, se) => n + se.stages.reduce((n, x) => n + x.seconds, 0),
            0,
          ),
        );
        assert(p.sessions.every((se) => se.rows.length));
        for (const se of p.sessions)
          assert(Number.isFinite(fixedSession(se, t).seconds[0]));
      }
    }
});

test("future Friday retains its moderate bench; only a resolved missed low slot replaces it", () => {
  const s = base();
  const bench = () =>
    planFor(s, "friday", false, monday).sessions[0].rows.find(
      (e) => e.id === "bench",
    );
  assert.equal(bench().key, "bench_moderate");
  assert.equal(bench().sets, 2);
  omissionRecord(s, "tuesday", "main", "Low slot actually omitted", monday);
  assert.equal(bench().key, "bench_low");
  assert.equal(bench().sets, 1);
});

test("measured same-visit assistance is not shortened by subtracting imaginary visit overhead", () => {
  const s = base();
  s.training.athletics.enabled = true;
  const p = dayPlan(s.training, "thursday"),
    t = fixedDay(p, s.training),
    se = p.sessions.find((se) => se.id === "support");
  const seconds = t.sessions.find((se) => se.id === "support").seconds[0];
  s.records.push({
    id: "measured-continuation-fixture",
    omissions: [],
    context: { level: "green", event: "normal", local: "" },
    weekId: "earlier",
    day: "thursday",
    status: "complete",
    session: se,
    timeConfig: { ...s.training, continuation: true },
    sets: [],
    startedAt: monday - seconds * 1000,
    endedAt: monday,
  });
  const e = buildPlannerFeed(s, monday).entries.find(
    (e) => e.day === "thursday",
  );
  assert.equal(e.forecastSeconds, t.seconds[0]);
  assert.equal(e.guideSeconds, t.seconds[0]);
});

test("a prepared continuation inherits warm-up but preserves unfinished Olympic recovery", () => {
  const s = base();
  s.training.athletics.enabled = true;
  ready(s, "2026-10-07");
  omissionRecord(s, "tuesday", "main", "Synthetic prerequisite", monday);
  startSession(s, "thursday", "main", wednesday);
  const e = nextRow(s.active);
  s.active.warmup = true;
  s.active.preparations.push(e.key);
  logSet(
    s,
    { weight: e.workingLoad || 120, outcome: "make", grade: "A", effort: 8 },
    wednesday + 1000,
  );
  stopSession(s, "Synthetic warm-up inheritance fixture", wednesday + 2000);
  omissionRecord(
    s,
    "thursday",
    "athletics",
    "Field work omitted",
    wednesday + 3000,
  );
  startSession(s, "thursday", "support", wednesday + 4000);
  assert(s.active.warmup);
  assert(s.active.timeConfig.continuation);
  assert.equal(s.active.session.rows[0].entryRecovery, 297);
  assert.equal(
    s.active.pacing.plan.find((p) => p.role === "recovery").seconds,
    297,
  );
  assert(!s.active.pacing.plan.some((p) => p.role === "general"));
  assert.deepEqual(validate(s), s);
});
