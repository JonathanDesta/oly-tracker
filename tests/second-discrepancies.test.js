import test from "node:test";
import assert from "node:assert/strict";
import { defaults, dayPlan, failure, DAYS } from "../src/prescription.js";
import {
  fresh,
  nextLoad,
  exposureHistory,
  normal,
  monitoring,
  planFor,
  startSession,
} from "../src/training.js";
import { applyChange } from "../src/review.js";
const now = new Date("2026-09-14T10:00:00").getTime();
const rows = (c, day, ctx = {}) =>
  dayPlan(c, day, ctx).sessions.flatMap((s) => s.rows);
function profile(week = 3, entry = 3) {
  const s = fresh("2026-09-14", "source");
  Object.assign(s.training, { week, entry, gate: week >= 9 ? "R" : "F" });
  s.readiness = {
    date: "2026-09-14",
    level: "green",
    event: "normal",
    local: "",
  };
  return s;
}
function record(e, reps, options = {}) {
  return {
    id: crypto.randomUUID(),
    day: "tuesday",
    session: { id: "main", rows: [structuredClone(e)] },
    sets: [{ key: e.key, weight: 100, reps, endpoint: "failure" }],
    omissions: [],
    context: { level: "green", event: "normal", recovery: "normal" },
    followup: { normal: true },
    ...options,
  };
}
function reviewed(s, week, entry = s.training.entry, green = true) {
  s.reviews.push({
    weekId: crypto.randomUUID(),
    week,
    green,
    recovery: "normal",
    training: { ...structuredClone(s.training), week, entry },
  });
}
const change = (kind, extra = {}) => ({
  kind,
  ready: true,
  stable: true,
  reason: "Comparable training and subsequent recovery reviewed.",
  ...extra,
});
test("second report 3: assistance holds secure loads through all Realization weeks, including week 11", () => {
  const s = profile(11),
    c = s.training;
  c.trials = [
    { id: "support", kind: "squat", day: "tuesday", exercise: "front_squat" },
    {
      id: "friday_support",
      kind: "squat",
      day: "friday",
      exercise: "back_squat",
    },
    { id: "press", kind: "press", day: "friday" },
    { id: "jerk", kind: "pause_jerk", day: "thursday" },
  ];
  c.anchors.jerk = 220;
  for (const week of [4, 8, 9, 10, 11]) {
    c.week = week;
    for (const [day, key] of [
      ["tuesday", "support_support"],
      ["friday", "press"],
    ]) {
      const e = rows(c, day).find((x) => x.key === key);
      assert.equal(e.hold, true);
      const h = [record(e, e.repRange[1]), record(e, e.repRange[1])];
      s.records = h;
      assert.equal(nextLoad(e, exposureHistory(s, e)).weight, 100);
    }
  }
  assert.ok(!rows(c, "friday").some((e) => e.key === "support_friday_support"));
  assert.ok(!rows(c, "thursday").some((e) => e.id === "pause_jerk"));
  assert.ok(!rows(c, "friday").some((e) => e.id === "incline"));
  const e = rows(c, "tuesday").find((x) => x.key === "support_support");
  const secure = record(e, 5),
    failed = record(e, 4);
  failed.sets[0] = { ...failed.sets[0], weight: 110, endpoint: "tech" };
  failed.followup.normal = false;
  s.records = [secure, failed];
  const planned = planFor(s, "tuesday")
    .sessions.flatMap((x) => x.rows)
    .find((x) => x.key === e.key);
  assert.equal(planned.heldWeight, 100);
  assert.equal(nextLoad(planned, exposureHistory(s, planned)).weight, 100);
  s.records = [record(e, 2)];
  assert.equal(nextLoad(e, exposureHistory(s, e)).weight, 92.5);
  c.week = 3;
  const progressing = rows(c, "tuesday").find((x) => x.key === e.key);
  s.records = [record(e, 5), record(e, 5)];
  assert.equal(
    nextLoad(progressing, exposureHistory(s, progressing)).weight,
    102.5,
  );
});
test("second report 5: main aerobics cap at 30; page-22 walks are separate rows and sum exactly", () => {
  const c = { ...defaults(), entry: 3 };
  for (const minutes of [40, 45, 50, 55, 60, 70, 150, 160, 300]) {
    c.cardio = { enabled: true, minutes };
    const all = DAYS.flatMap((d) => rows(c, d)).filter(
      (e) => e.id === "aerobic",
    );
    assert.equal(
      all.reduce((n, e) => n + e.minutes, 0),
      minutes,
    );
    assert.ok(
      all.filter((e) => e.key === "aerobic").every((e) => e.minutes <= 30),
    );
  }
  c.cardio.minutes = 150;
  assert.deepEqual(
    DAYS.map((d) =>
      rows(c, d)
        .filter((e) => e.id === "aerobic")
        .map((e) => e.minutes),
    ),
    [[20], [10], [30, 10], [20], [10], [30, 10], [10]],
  );
});
test("second report 8: a ready limited-later day receives and earns normal load progression, with confirmed follow-up", () => {
  const s = profile();
  s.readiness.event = "limited_later";
  const e = rows(s.training, "tuesday", s.readiness).find(
    (e) => e.key === "bench_low",
  );
  assert.ok(!e.hold);
  const first = record(e, 5),
    second = record(e, 5);
  second.context.event = "limited_later";
  s.records = [first, second];
  assert.equal(nextLoad(e, exposureHistory(s, e)).weight, 102.5);
  second.followup.normal = false;
  assert.equal(nextLoad(e, exposureHistory(s, e)).weight, 100);
  assert.throws(
    () =>
      applyChange(s, change("set", { exercise: "shrug", day: "tuesday" }), now),
    /active event/,
  );
  s.training.trials = [
    { id: "extra", kind: "set", day: "tuesday", exercise: "shrug" },
    { id: "support", kind: "squat", day: "tuesday", exercise: "front_squat" },
  ];
  const restricted = rows(s.training, "tuesday", s.readiness);
  assert.equal(restricted.find((e) => e.id === "shrug").sets, 1);
  assert.equal(restricted.find((e) => e.id === "shrug").trialIds.length, 0);
  assert.ok(!restricted.some((e) => e.key.startsWith("support_")));
  for (const context of [
    { level: "amber", event: "limited_later" },
    { level: "green", event: "verification" },
    { level: "green", event: "limited_later", local: "upper" },
  ])
    assert.equal(
      normal({ ...first, context: { ...first.context, ...context } }),
      false,
    );
});
test("second report 9: the ramp cannot count as two stable weeks, including with an unsupported early-start assertion", () => {
  const s = profile(3);
  reviewed(s, 1, 1);
  reviewed(s, 2, 2);
  for (const adapted of [false, true])
    assert.throws(
      () => applyChange(s, change("athletic_start", { adapted }), now),
      /entry ramp/,
    );
  assert.equal(s.training.athletics.enabled, false);
  const unreviewed = profile(3);
  assert.throws(
    () => applyChange(unreviewed, change("athletic_start"), now),
    /Normally introduce/,
  );
  const ready = profile(5);
  reviewed(ready, 3);
  reviewed(ready, 4);
  applyChange(ready, change("athletic_start"), now);
  assert.equal(ready.training.athletics.enabled, true);
});
test("second report 9: source-permitted stable lower-dose and adapted starts remain available; introduction excludes another increase in either order", () => {
  const lower = profile(3, 1);
  reviewed(lower, 1);
  reviewed(lower, 2);
  applyChange(lower, change("athletic_start"), now);
  assert.equal(lower.training.entry, 1);
  assert.equal(lower.training.athletics.enabled, true);
  const adapted = profile(3);
  applyChange(adapted, change("athletic_start", { adapted: true }), now);
  const s = profile(5);
  applyChange(s, change("cardio_start"), now);
  assert.throws(
    () => applyChange(s, change("athletic_start"), now),
    /No other dose increase/,
  );
  const reverse = profile(5);
  applyChange(reverse, change("athletic_start"), now);
  assert.throws(
    () => applyChange(reverse, change("cardio_start"), now),
    /No other dose increase/,
  );
  const changed = profile(5);
  reviewed(changed, 3);
  reviewed(changed, 4);
  changed.training.cardio.enabled = true;
  assert.throws(
    () => applyChange(changed, change("athletic_start"), now),
    /dose\/recovery change/,
  );
});
test("second report 11: >20% first-set loss requires two comparable exposures and survives later cardio logging", () => {
  const s = profile(),
    e = failure("row", 2, 8, 12, 150);
  const flag = () => monitoring(s).some((x) => x.includes("more than 20%"));
  s.records = [record(e, 10), record(e, 8), record(e, 8)];
  assert.equal(flag(), false, "exactly 20% is not more than 20%");
  s.records.at(-1).sets[0].reps = 7;
  assert.equal(flag(), false, "one exposure is insufficient");
  s.records.at(-2).sets[0].reps = 7;
  assert.equal(flag(), true);
  s.records.push({
    session: { id: "cardio", rows: [] },
    sets: [{ minutes: 20 }],
  });
  assert.equal(flag(), true);
  s.records[1].sets[0].weight = 105;
  assert.equal(flag(), false, "different loads are not comparable");
  s.records[1].sets[0].weight = 100;
  s.records[2].session.rows[0].setup = 2;
  assert.equal(flag(), false, "a new setup resets comparability");
  s.records = [record(e, 10), record(e, 10), record(e, 10)];
  s.records.forEach((r) => r.sets.push({ ...r.sets[0], reps: 1 }));
  assert.equal(
    flag(),
    false,
    "later sets do not replace the first-set comparison",
  );
});
test("second report 12: missing protection defers base/support barbell sets and prevents bench rescue", () => {
  const s = profile();
  s.readiness.noProtection = true;
  s.training.trials = [
    { id: "s", kind: "squat", day: "tuesday", exercise: "front_squat" },
  ];
  for (const day of ["tuesday", "friday"]) {
    const actual = rows(s.training, day, s.readiness);
    assert.ok(
      !actual.some((e) =>
        ["bench", "front_squat", "back_squat"].includes(e.id),
      ),
    );
    assert.ok(actual.some((e) => e.id === "incline"));
  }
  assert.throws(
    () => startSession(s, "monday", "rescue", now, { rescue: "bench_low" }),
    /protection/,
  );
});
