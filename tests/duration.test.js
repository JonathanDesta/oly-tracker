import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  dayPlan,
  quality,
  failure,
  DAYS,
} from "../src/prescription.js";
import {
  estimateDay,
  estimateSession,
  TIME_DEFAULTS,
  validTimeProfile,
  minutesText,
} from "../src/duration.js";
import { fresh, startSession, localDate, planFor } from "../src/training.js";
import { validate } from "../src/storage.js";
const session = (rows, kind = "lifting", id = "main") => ({ id, rows, kind });
const row = (e, c = defaults()) => estimateSession(session([e]), c).rows[0];
const base = () => ({ ...defaults(), week: 3, entry: 3 });
const sum = (pairs) =>
  pairs.reduce((a, p) => a.map((n, i) => n + p[i]), [0, 0]);

test("time: failure rep windows, tempo, unilateral work and n−1 rests replace a fixed 30 seconds", () => {
  const e = failure("lateral", 4, 12, 20, 150),
    c = base();
  const oneArm = row(e, c);
  assert.deepEqual(oneArm.parts.work, [348, 740]);
  assert.deepEqual(oneArm.parts.rest, [450, 450]);
  c.equipment.lateral = "db";
  const both = row(e, c);
  assert.deepEqual(both.parts.work, [164, 360]);
  assert.ok(both.parts.ramp[1] < oneArm.parts.ramp[1]);
  assert.equal(row(failure("bench", 1, 3, 5, 270)).parts.rest[1], 0);
  assert.deepEqual(row(failure("calf", 2, 10, 15, 150)).parts.work, [90, 170]);
});
test("time: Olympic doubles, paired lifts, heavy replacement singles and resets have distinct execution costs", () => {
  const e = quality("snatch", 3, 2, [70, 75]);
  assert.deepEqual(row(e).parts.work, [102, 180]);
  e.repSequence = [2, 1, 1];
  assert.deepEqual(row(e).parts.work, [58, 100]);
  assert.deepEqual(
    row(quality("cj", 3, "1+1", [65, 70])).parts.work,
    [75, 120],
  );
  assert.ok(row(quality("jerk", 3, 2, [60, 70])).parts.work[1] >= 3 * 30);
});
test("time: page-9 ramp thresholds, light stages, low bench and repeated continuation rows", () => {
  const sn = (pct) => row(quality("snatch", 3, 1, [pct, pct])).parts.ramp;
  assert.ok(sn(75)[0] > sn(74)[0]);
  assert.ok(sn(85)[0] > sn(84)[0]);
  assert.ok(sn(40)[1] < sn(60)[1]);
  const low = row(failure("bench", 1, 3, 5, 270));
  const moderate = row(failure("bench", 1, 6, 8, 210));
  assert.deepEqual(
    low.parts.ramp.map((n, i) => n - moderate.parts.ramp[i]),
    [73, 139],
  );
  const e = failure("front_squat", 1, 4, 6, 270);
  const support = { ...e, key: "support_squat" };
  const t = estimateSession(session([e, support]), base());
  assert.deepEqual(t.rows[1].parts.ramp, [0, 0]);
  assert.deepEqual(t.rows[1].parts.recovery, [270, 270]);
  const next = estimateSession(
    session([e, failure("bench", 1, 3, 5, 270)]),
    base(),
  );
  assert.deepEqual(
    next.rows[1].parts.recovery,
    [0, 0],
    "a new lift has its own ramp, no invented final-set rest",
  );
});
test("time: equipment changes overlap recovery; unusually slow changes add only their excess", () => {
  const e = quality("snatch", 2, 1, [70, 70], "snatch", 7, 150),
    c = base();
  assert.deepEqual(row(e, c).parts.handling, [0, 0]);
  c.timing.plateSeconds = 300;
  assert.deepEqual(row(e, c).parts.handling, [65, 275]);
  c.timing.extraRestSeconds = 60;
  assert.deepEqual(row(e, c).parts.rest, [210, 210]);
  assert.deepEqual(row(e, c).parts.handling, [5, 215]);
  const a = failure("curl", 1, 8, 12, 150),
    b = failure("triceps", 1, 10, 15, 150);
  const cable = estimateSession(session([a, b]), base());
  assert.deepEqual(
    cable.rows[1].parts.waiting,
    [0, 0],
    "consecutive cable exercises keep the station",
  );
});
test("time: mock meet includes 8–10 minutes between lifts and then a separate CJ ramp", () => {
  const c = { ...base(), week: 12, gate: "R" },
    p = dayPlan(c, "friday");
  const t = estimateDay(p, c).sessions[0];
  assert.deepEqual(t.rows[1].parts.recovery, [480, 600]);
  assert.ok(t.rows[1].parts.ramp[0] > 8 * 60);
  assert.deepEqual(t.rows[0].parts.rest, [540, 540]);
  assert.equal(t.rows.length, 2);
});
test("time: split visits each have breaks and the prescribed re-warm-up; three hours is separate from training", () => {
  const c = { ...base(), split: true },
    p = dayPlan(c, "tuesday"),
    t = estimateDay(p, c);
  assert.equal(t.visits, 2);
  assert.equal(t.gapSeconds, 10800);
  assert.deepEqual(t.sessions[1].overhead.general, [180, 300]);
  assert.deepEqual(
    t.sessions.map((s) => s.overhead.breaks),
    [
      [600, 600],
      [600, 600],
    ],
  );
  assert.deepEqual(t.seconds, sum(t.sessions.map((s) => s.seconds)));
  assert.deepEqual(
    t.elapsed,
    t.seconds.map((n) => n + 10800),
  );
});
test("time: field warm-up, jumps, fly run-in, both cut sides and same-visit transition", () => {
  const c = base();
  c.athletics.enabled = true;
  let t = estimateDay(dayPlan(c, "monday"), c);
  const a = t.sessions[1];
  assert.deepEqual(a.overhead.general, [540, 780]);
  assert.deepEqual(a.rows[0].parts.work, [52, 64]);
  assert.deepEqual(a.rows[1].parts.rest, [360, 360]);
  assert.equal(t.gapSeconds, 10800);
  c.timing.athleticsVisit = "same";
  t = estimateDay(dayPlan(c, "monday"), c);
  assert.equal(t.visits, 1);
  assert.equal(t.gapSeconds, 0);
  assert.deepEqual(t.sessions[1].overhead.breaks, [0, 0]);
  assert.deepEqual(t.sessions[1].overhead.transition, [300, 300]);
  for (const [id, work] of [
    ["fly", [10, 18]],
    ["cut", [52, 84]],
  ]) {
    const e = {
      id,
      key: id,
      sets: 2,
      kind: "speed",
      reps: id === "fly" ? "10 m" : "1/side",
      rest: 180,
    };
    assert.deepEqual(
      estimateSession(session([e], "athletic"), c).rows[0].parts.work,
      work,
    );
  }
});
test("time: cardio moving minutes and selected mobility remain separate from gym overhead", () => {
  const c = base();
  Object.assign(c.cardio, { enabled: true, minutes: 150 });
  c.mobility = ["ankle", "front rack"];
  let moving = 0;
  for (const d of DAYS) {
    const p = dayPlan(c, d),
      t = estimateDay(p, c);
    moving += t.sessions
      .flatMap((s) => s.rows)
      .filter((r) => r.station === "cardio" || r.station === "walk")
      .reduce((n, r) => n + r.parts.work[0] / 60, 0);
    assert.deepEqual(t.seconds, sum(t.sessions.map((s) => s.seconds)));
    if (d === "wednesday") {
      assert.deepEqual(t.mobility, [420, 500]);
      assert.ok(t.seconds[0] > 40 * 60);
    }
    if (d === "monday") assert.deepEqual(t.mobility, [0, 0]);
  }
  assert.equal(moving, 150);
  c.mobilitySeconds = 45;
  assert.deepEqual(estimateDay(dayPlan(c, "sunday"), c).mobility, [540, 620]);
});
test("time: source restrictions, taper, pivot and empty days recalculate without changing any prescription", () => {
  for (const week of [1, 3, 4, 5, 8, 9, 11, 12, 13])
    for (const level of ["green", "amber", "red"])
      for (const day of DAYS) {
        const c = { ...base(), week },
          p = dayPlan(c, day, { level }),
          before = structuredClone(p);
        const t = estimateDay(p, c);
        assert.deepEqual(p, before);
        for (const s of t.sessions) {
          assert.deepEqual(
            s.seconds,
            sum([
              ...Object.values(s.overhead),
              ...s.rows.map((r) => r.seconds),
            ]),
          );
          for (const r of s.rows) {
            assert.deepEqual(r.seconds, sum(Object.values(r.parts)));
            for (const v of Object.values(r.parts))
              assert.ok(Number.isFinite(v[0]) && v[0] >= 0 && v[1] >= v[0]);
          }
        }
        if (level === "red") assert.deepEqual(t.seconds, [0, 0]);
      }
  const c = base();
  assert.ok(
    estimateDay(dayPlan(c, "tuesday", { level: "amber" }), c).seconds[1] <
      estimateDay(dayPlan(c, "tuesday"), c).seconds[1],
  );
  assert.equal(minutesText([0, 0]), "0 min");
});
test("time: settings validate, old backups receive defaults and sessions freeze their starting assumptions", () => {
  const s = fresh("2026-09-14");
  delete s.training.timing;
  assert.deepEqual(validate(s).training.timing, TIME_DEFAULTS);
  s.training.timing = { ...TIME_DEFAULTS };
  for (const bad of [
    { ...TIME_DEFAULTS, breakMinutes: -1 },
    { ...TIME_DEFAULTS, plateSeconds: Infinity },
    { ...TIME_DEFAULTS, traffic: "anything" },
    null,
  ]) {
    assert.equal(validTimeProfile(bad), false);
    assert.throws(
      () => validate({ ...s, training: { ...s.training, timing: bad } }),
      /time planning/,
    );
  }
  const now = new Date("2026-09-14T10:00:00").getTime();
  s.readiness = {
    date: localDate(new Date(now)),
    level: "green",
    local: "",
    event: "normal",
  };
  startSession(s, "monday", "main", now);
  const budget = estimateSession(
    s.active.originalSession,
    s.active.timeConfig,
  ).seconds;
  s.training.timing.breakMinutes = 40;
  assert.deepEqual(
    estimateSession(s.active.originalSession, s.active.timeConfig).seconds,
    budget,
  );
  const updated = estimateDay(planFor(s, "monday", true, now), s.training);
  assert.deepEqual(updated.sessions[0].overhead.breaks, [2400, 2400]);
  assert.deepEqual(validate(s).active.timeConfig, s.active.timeConfig);
});
