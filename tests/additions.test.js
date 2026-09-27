import test from "node:test";
import assert from "node:assert/strict";
import { fresh, normal, planFor } from "../src/training.js";
import { dayPlan, copy } from "../src/prescription.js";
import { fixedDay } from "../src/timeline.js";
import { primaryAthleticSlot, secondaryAthleticSlot } from "../src/calendar.js";
import {
  optionalStatus,
  optionalPreview,
  applyGuidedChange,
  introductionStatus,
  observation,
  athleticProgress,
  nextOptionalChange,
  doseText,
} from "../src/additions.js";
const now = Date.parse("2026-09-21T15:00:00-05:00");
function ready() {
  const s = fresh("2026-09-21", "weekday", "all-failure");
  Object.assign(s.training, {
    entry: 3,
    week: 5,
    failureEntry: 4,
    failureWeeks: ["one", "two"],
  });
  s.training.scheduleTrial.weeks = ["one", "two"];
  s.reviews = [3, 4].map((week) => ({
    type: "weekly",
    at: now - (5 - week) * 7 * 86400000,
    weekId: `prior-${week}`,
    week,
    training: { ...copy(s.training), week },
    green: true,
    recovery: "normal",
  }));
  return s;
}
const change = (kind) => ({
  kind,
  confirmed: true,
  reason: "Improve athletic skills without disrupting lifting.",
  fullCycle: true,
});
function record(s, at, secondary = false, ctx = {}) {
  const slot = secondary
    ? secondaryAthleticSlot(s.training)
    : primaryAthleticSlot(s.training);
  const se = dayPlan(s.training, slot, ctx).sessions.find(
    (se) => se.id === (secondary ? "athletics-secondary" : "athletics"),
  );
  return {
    id: String(at),
    startedAt: at,
    status: "complete",
    session: se,
    context: { level: "green", event: "normal", recovery: "normal" },
    followup: { normal: true },
    omissions: [],
    sets: se.rows.flatMap((e) =>
      Array.from({ length: e.sets }, () => ({ key: e.key, quality: "good" })),
    ),
  };
}
test("guided additions explain build-up and do not mutate a pending journal", () => {
  const s = fresh("2026-09-21", "weekday", "all-failure"),
    original = copy(s);
  assert.match(introductionStatus(s).title, /1 of 4/);
  assert.match(
    optionalStatus(s, "athletic_start", now).reason,
    /Weekly review/,
  );
  const p = optionalPreview(s, "athletic_start");
  assert.equal(p.days[0].label, "Wednesday");
  assert.deepEqual(s, original);
  assert.throws(
    () => applyGuidedChange(s, change("athletic_start"), now),
    /Build up/,
  );
  assert.deepEqual(s, original);
});
test("preview, applied prescription and whole-day timers agree at every initial athletic step", () => {
  const s = ready();
  for (let stage = 0; stage < 8; stage++) {
    const kind = stage ? "athletic_step" : "athletic_start";
    const original = copy(s),
      preview = optionalPreview(s, kind, now + stage * 20000);
    assert.equal(optionalStatus(s, kind, now + stage * 20000).allowed, true);
    assert.deepEqual(s, original);
    applyGuidedChange(s, change(kind), now + stage * 20000);
    assert.deepEqual(s.training.athletics, preview.training.athletics);
    assert.equal(preview.days.length, 1);
    const day = preview.days[0];
    assert.equal(
      day.afterSeconds,
      fixedDay(dayPlan(s.training, day.day), s.training).seconds[0],
    );
    assert.ok(day.addedSeconds >= 0);
    assert.deepEqual(
      day.sessions,
      planFor(
        s,
        day.day,
        false,
        now + stage * 20000,
        false,
        true,
      ).sessions.filter((se) => se.kind === "athletic"),
    );
    assert.equal(s.training.athletics.stage, stage);
    s.weekId = `next-${stage}`; // a subsequent review week, not another addition in the introduction week
    s.records.push(
      record(s, now + stage * 20000 + 1000),
      record(s, now + stage * 20000 + 2000),
    );
  }
  assert.match(doseText(s.training.athletics), /5 sets of 3 jumps.*4 × 20 m/);
});
test("completed athletic work needs matching dose and normal subsequent recovery; incomplete, shortened and unrelated logs do not count", () => {
  const s = ready();
  applyGuidedChange(s, change("athletic_start"), now);
  s.weekId = "following";
  const good = record(s, now + 1000);
  assert.equal(normal(good), true);
  const noFollowup = copy(good);
  noFollowup.followup.normal = false;
  const partial = copy(good);
  partial.status = "stopped";
  const shortened = copy(good);
  shortened.session.rows[0].sets = 1;
  shortened.sets = shortened.sets.filter((x, i) => i !== 0);
  s.records.push(noFollowup, partial, shortened, good);
  assert.equal(athleticProgress(s).count, 1);
  assert.equal(optionalStatus(s, "athletic_step", now + 2000).allowed, false);
  assert.equal(optionalStatus(s, "cardio_start", now + 2000).allowed, false);
  s.records.push(record(s, now + 3000));
  assert.equal(observation(s).count, 2);
  assert.equal(optionalStatus(s, "athletic_step", now + 4000).allowed, true);
});
test("second day starts with jumps only, then two short runs; observations belong to that changed day", () => {
  const s = ready();
  s.training.athletics.enabled = true;
  s.records = [1, 2, 3].map((n) => record(s, now - n * 1000));
  assert.match(optionalStatus(s, "athletic_second", now).reason, /3 of 4/);
  s.records.push(record(s, now - 4000));
  const p = optionalPreview(s, "athletic_second");
  assert.equal(p.days[0].label, "Monday");
  assert.equal(p.days[0].sessions[0].rows.length, 1);
  applyGuidedChange(s, change("athletic_second"), now);
  s.records.push(record(s, now + 1000), record(s, now + 2000));
  assert.equal(optionalStatus(s, "athletic_runs", now + 3000).allowed, false);
  s.records.push(record(s, now + 4000, true), record(s, now + 5000, true));
  applyGuidedChange(s, change("athletic_runs"), now + 6000);
  const rows = dayPlan(s.training, "tuesday").sessions.find(
    (se) => se.id === "athletics-secondary",
  ).rows;
  assert.deepEqual(
    rows.map((e) => [e.sets, e.reps]),
    [
      [2, 3],
      [2, "10 m"],
    ],
  );
});
test("running variations replace two runs at the stated starting effort; switching or increasing needs observed varied sessions", () => {
  const s = ready();
  Object.assign(s.training.athletics, { enabled: true, stage: 7 });
  const p = optionalPreview(s, "cut");
  assert.equal(p.training.athletics.intensity, 80);
  applyGuidedChange(s, change("cut"), now);
  let rows = dayPlan(s.training, "thursday").sessions.find(
    (se) => se.kind === "athletic",
  ).rows;
  assert.equal(rows.find((r) => r.id === "sprint").sets, 2);
  assert.equal(rows.find((r) => r.id === "cut").sets, 2);
  s.records.push(
    record(s, now + 1000, false, { variation: false }),
    record(s, now + 2000, false, { variation: false }),
  );
  assert.equal(athleticProgress(s).count, 0);
  assert.equal(
    optionalStatus(s, "variation_intensity", now + 3000).allowed,
    false,
  );
  s.records.push(record(s, now + 4000), record(s, now + 5000));
  applyGuidedChange(s, change("variation_intensity"), now + 6000);
  assert.equal(s.training.athletics.intensity, 90);
});
test("cardio holds each increase for two green reviewed weeks and previews the actual recovery-day mapping", () => {
  const s = ready();
  const p = optionalPreview(s, "cardio_start");
  assert.deepEqual(
    p.days.map((d) => d.label),
    ["Tuesday", "Saturday"],
  );
  applyGuidedChange(s, change("cardio_start"), now);
  assert.equal(optionalStatus(s, "cardio_step", now + 1000).allowed, false);
  for (const n of [1, 2])
    s.reviews.push({
      type: "weekly",
      weekId: `cardio-${n}`,
      at: now + n * 1000,
      green: true,
      recovery: "normal",
      training: copy(s.training),
    });
  applyGuidedChange(s, change("cardio_step"), now + 3000);
  assert.equal(s.training.cardio.minutes, 45);
  assert.equal(observation(s).count, 0);
});
test("a pause clears the obsolete observation wait and keeps the resume prescription visible", () => {
  const s = ready();
  s.training.athletics.stage = 3;
  applyGuidedChange(s, change("athletic_start"), now);
  s.training.athletics.enabled = false;
  s.reviews.push({
    at: now + 1000,
    type: "Reverse interfering addition",
    kind: "athletics",
  });
  assert.equal(observation(s), null);
  const p = optionalPreview(s, "athletic_start");
  assert.equal(p.training.athletics.stage, 3);
  assert.match(doseText(p.training.athletics), /15 m.*90–95/);
});
test("held weeks and open workouts explain the next action; full cycle confirmation remains necessary above 150 minutes", () => {
  const s = ready();
  s.training.week = 8;
  assert.match(optionalStatus(s, "cardio_start", now).reason, /Week 8 holds/);
  s.training.week = 5;
  s.active = { id: "test" };
  assert.equal(optionalStatus(s, "cardio_start", now).action, "resume");
  s.active = null;
  s.training.cardio = { enabled: true, minutes: 150 };
  assert.throws(
    () =>
      applyGuidedChange(s, { ...change("cardio_step"), fullCycle: false }, now),
    /full cycle/,
  );
  const original = copy(s);
  assert.throws(
    () =>
      applyGuidedChange(s, { ...change("cardio_step"), confirmed: false }, now),
    /Confirm/,
  );
  assert.deepEqual(s, original);
  assert.equal(
    nextOptionalChange(
      { ...s.training, cardio: { enabled: true, minutes: 300 } },
      "cardio",
    ),
    null,
  );
});

test("variation preview explains an ordinary next session and never invents a time increase", () => {
  const s = ready();
  Object.assign(s.training.athletics, { enabled: true, stage: 7 });
  s.records.push(record(s, now - 1000)); // next exposure is deliberately unvaried
  const p = optionalPreview(s, "fly", now);
  assert.equal(p.days.length, 0);
  assert.match(p.unchangedReason, /following alternating session/);
  assert.match(
    doseText(p.training.athletics),
    /4 × 20 m.*replace the last two runs/,
  );
});

test("legacy athletics on a saved nondefault day still counts its completed sessions", () => {
  const s = fresh("2026-09-21", "source", "source");
  Object.assign(s.training, { entry: 3, week: 5 });
  Object.assign(s.training.athletics, { enabled: true, day: "thursday" });
  const session = dayPlan(s.training, "thursday").sessions.find(
    (se) => se.id === "athletics",
  );
  s.records.push({
    id: "legacy",
    startedAt: now,
    status: "complete",
    session,
    context: { level: "green", event: "normal", recovery: "normal" },
    followup: { normal: true },
    omissions: [],
    sets: session.rows.flatMap((e) =>
      Array.from({ length: e.sets }, () => ({ key: e.key, quality: "good" })),
    ),
  });
  assert.equal(athleticProgress(s).count, 1);
});
