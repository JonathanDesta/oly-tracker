import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  startSession,
  logSet,
  nextRow,
  rowStatus,
  successfulRow,
  nextQualityRange,
  stopSession,
  planFor,
  omitRow,
  finishSession,
  nextLoad,
  advanceWeek,
  omissionRecord,
  scheduledDate,
} from "../src/training.js";
import { dayPlan, DAYS, copy } from "../src/prescription.js";
import {
  doseLedger,
  DOSE_VERSION,
  MUSCLES,
  MUSCLE_DECISIONS,
  LEGACY_DOSE_VERSION,
} from "../src/dose.js";
import {
  FAILURE_POLICY,
  LEGACY_FAILURE_POLICY,
  failureSets,
  failureProgression,
} from "../src/failure-policy.js";
import { validate } from "../src/storage.js";
import { applyChange, reviewTrial } from "../src/review.js";
import { programDays } from "../src/calendar.js";
import { syncPacing } from "../src/pacing.js";
import { fixedSession } from "../src/timeline.js";
import {
  prescriptionSignature,
  buildPlannerFeed,
  journalEntities,
  adoptJournalEntities,
} from "../src/planner-feed.js";
const base = (stage = 4) => {
  const s = fresh("2026-09-21", "weekday", "all-failure");
  Object.assign(s.training, {
    entry: Math.min(stage, 3),
    failureEntry: stage,
    week: 3,
    failureWeeks: ["one", "two"],
    gate: "F",
  });
  s.training.scheduleTrial.weeks = ["one", "two"];
  return s;
};
const ledger = (s) => doseLedger(DAYS.map((d) => dayPlan(s.training, d)));
const now = Date.parse("2026-09-21T15:00:00-05:00");
function start(day = "tuesday") {
  const s = base();
  s.readiness = {
    date: "2026-09-21",
    level: "green",
    event: "normal",
    local: "",
  };
  if (day === "friday") {
    for (const prior of ["tuesday", "thursday"])
      omissionRecord(s, prior, "main", "Synthetic prerequisite", now);
    s.dates.friday = "2026-09-21";
  }
  startSession(s, day, "main", now);
  s.active.warmup = true;
  s.active.preparations = s.active.session.rows.map((e) => e.key);
  return s;
}
function rep(s, at, extra = {}) {
  return logSet(
    s,
    {
      weight: nextQualityRange(s.active, nextRow(s.active))[0],
      outcome: "make",
      grade: "A",
      effort: 8,
      ...extra,
    },
    at,
  );
}
function sync(s, at) {
  syncPacing(
    s.active,
    Object.fromEntries(
      s.active.session.rows.map((e) => [e.key, rowStatus(s.active, e)]),
    ),
    at,
  );
}
const change = (kind, exercise = "cj", day = "tuesday") => ({
  kind,
  exercise,
  day,
  reason: "Synthetic comparable performance/recovery review",
  ready: true,
  stable: true,
});

test("complete allocation migrates 7.17 gradually, without altering active or historical prescriptions", () => {
  const s = base();
  s.training.doseVersion = LEGACY_DOSE_VERSION;
  assert.equal(ledger(s).conventional, 56);
  s.readiness = {
    date: "2026-09-21",
    level: "green",
    event: "normal",
    local: "",
  };
  startSession(s, "tuesday", "main", now);
  const frozen = copy(s.active);
  const migrated = validate(s);
  assert.deepEqual(migrated.active, frozen);
  assert.equal(migrated.training.doseVersion, LEGACY_DOSE_VERSION);
  assert.equal(migrated.training.nextDoseVersion, DOSE_VERSION);
  stopSession(migrated, "Synthetic migration boundary", now + 1000);
  assert.equal(migrated.training.doseVersion, LEGACY_DOSE_VERSION);
  for (const day of programDays(migrated.training))
    if (
      dayPlan(migrated.training, day).sessions.some((s) => s.id === "main") &&
      !migrated.records.some(
        (r) => r.weekId === migrated.weekId && r.day === day,
      )
    )
      omissionRecord(
        migrated,
        day,
        "main",
        "Synthetic migration boundary",
        now,
      );
  advanceWeek(
    migrated,
    {
      action: "advance",
      green: true,
      recovery: "normal",
      scheduleQuality: true,
      notes: "Complete legacy week before changing the calendar",
    },
    now,
  );
  assert.equal(migrated.training.doseVersion, DOSE_VERSION);
  assert.equal(migrated.training.failureEntry, 2);
  assert.equal(ledger(migrated).conventional, 41);
  assert.deepEqual(migrated.records[0].session, frozen.session);
  assert.equal(migrated.training.failureWeeks.length, 0);
  assert.deepEqual(validate(migrated), migrated);
});

test("forearm rows execute strict failure sets with warm-ups, full rests, station reuse, storage and readiness", () => {
  const s = start("friday"),
    ids = ["hammer_curl", "wrist_curl", "wrist_extension"];
  const rows = s.active.session.rows.filter((e) => ids.includes(e.id));
  assert.deepEqual(
    rows.map((e) => e.sets),
    [1, 1, 1],
  );
  const time = fixedSession(s.active.session, s.training);
  assert.equal(
    time.rows.find((e) => e.key === "hammer_curl").parts.waiting[0],
    120,
  );
  for (const e of rows) {
    assert(e.amendment);
    assert.match(e.note, /both|together/);
    const parts = time.rows.find((r) => r.key === e.key).parts;
    assert(parts.ramp[0] > 0);
    assert.equal(parts.rest[0], (e.sets - 1) * e.rest);
    if (e.id !== "hammer_curl") assert.equal(parts.waiting[0], 0);
  }
  for (const e of s.active.session.rows.filter((e) => !ids.includes(e.id)))
    omitRow(s, e.key, "Synthetic regional runner check", now);
  let at = now + 1000;
  for (const e of rows)
    for (let set = 0; set < e.sets; set++) {
      assert.equal(nextRow(s.active).id, e.id);
      logSet(s, { weight: 10, reps: e.repRange[1], endpoint: "failure" }, at);
      sync(s, at);
      assert.deepEqual(validate(s), s);
      at += (e.rest + 60) * 1000;
    }
  assert.equal(nextRow(s.active), undefined);
  finishSession(s, "Regional execution fixture", at);
  assert.equal(s.records.at(-1).sets.length, 3);
  for (const e of rows) assert(successfulRow(s.records.at(-1), e));
  assert.deepEqual(validate(s), s);
  const restricted = dayPlan(s.training, "tuesday", {
    local: "upper",
    event: "normal",
    level: "green",
  });
  assert(
    !restricted.sessions
      .flatMap((se) => se.rows)
      .some((e) => ids.includes(e.id)),
  );
  const verification = dayPlan(s.training, "friday", { event: "verification" });
  assert(
    verification.sessions
      .flatMap((se) => se.rows)
      .filter((e) => ids.includes(e.id))
      .every((e) => e.sets === 1),
  );
  const source = fresh();
  assert(!ledger(source).exercises.some((e) => ids.includes(e.id)));
});

test("regional additions, equipment-specific muscle counts and Planner signatures remain coherent", () => {
  for (const id of ["hammer_curl", "wrist_curl", "wrist_extension"]) {
    const s = base();
    applyChange(s, change("set", id, "friday"), now);
    assert.deepEqual(validate(s), s);
    assert.equal(ledger(s).conventional, 57);
    const limited = dayPlan(s.training, "tuesday", { event: "limited_later" });
    assert.equal(doseLedger([limited]).conventional, 20);
  }
  const s = base(),
    before = planFor(s, "friday").sessions[0];
  const wrist = before.rows.find((e) => e.id === "wrist_extension");
  const suggestion = nextLoad(
    wrist,
    Array.from({ length: 2 }, () => ({
      normal: true,
      sets: Array.from({ length: 1 }, () => ({
        weight: 5,
        reps: 20,
        endpoint: "failure",
      })),
    })),
    5,
  );
  assert.equal(suggestion.weight, 5);
  assert.match(suggestion.text, /barbell plate setting does not apply/);
  s.training.doseVersion = LEGACY_DOSE_VERSION;
  const previous = planFor(s, "friday").sessions[0];
  assert.notEqual(
    prescriptionSignature(before, s.training),
    prescriptionSignature(previous, s.training),
  );
  s.training.doseVersion = DOSE_VERSION;
  s.training.equipment.calf = "seated";
  assert.equal(ledger(s).muscles.gastrocnemius.direct, 0);
  assert.equal(ledger(s).muscles.soleus.direct, 4);
});

test("restart stages and established per-day exercise counts match the reviewed allocation", () => {
  for (const [stage, olympic, conventional] of [
    [1, 6, 31],
    [2, 6, 41],
    [3, 9, 46],
    [4, 12, 56],
  ]) {
    const s = base(stage),
      l = ledger(s);
    assert.equal(l.olympic, olympic);
    assert.equal(l.conventional, conventional);
    assert.deepEqual(validate(s), s);
  }
  const s = base(),
    days = Object.fromEntries(
      DAYS.map((d) => [d, doseLedger([dayPlan(s.training, d)])]),
    );
  assert.deepEqual(
    ["tuesday", "thursday", "monday", "friday"].map((d) => [
      days[d].olympic,
      days[d].conventional,
    ]),
    [
      [4, 20],
      [4, 16],
      [0, 0],
      [4, 20],
    ],
  );
  assert.deepEqual(
    days.tuesday.exercises.filter((e) => !e.olympic).map((e) => [e.id, e.sets]),
    [
      ["front_squat", 2],
      ["bench", 2],
      ["incline", 3],
      ["lateral", 4],
      ["leg_curl", 2],
      ["calf", 2],
      ["leg_ext", 1],
      ["crunch", 1],
      ["triceps", 1],
      ["rear_delt", 1],
      ["shrug", 1],
    ],
  );
  Object.assign(s.training, { week: 9, gate: "R" });
  assert.equal(ledger(s).olympic, 12);
  s.training.week = 11;
  assert.equal(ledger(s).conventional, 31);
  s.training.week = 12;
  assert.deepEqual([ledger(s).olympic, ledger(s).conventional], [4, 2]);
  s.training.week = 13;
  assert.deepEqual([ledger(s).olympic, ledger(s).conventional], [0, 31]);
});

test("muscle accounting separates direct, indirect and unquantified contributions; totals reconcile", () => {
  const s = base(),
    l = ledger(s);
  const expected = {
    chest: 10,
    upper_chest: 6,
    front_delts: 5,
    side_delts: 8,
    rear_delts: 4,
    traps: 4,
    upper_back: 6,
    lats: 6,
    biceps: 6,
    triceps: 7,
    quads: 6,
    glutes: 4,
    hamstrings: 4,
    calves: 4,
    abs: 2,
    adductors: 0,
    erectors: 0,
    forearms: 0,
    wrist_flexors: 2,
    wrist_extensors: 2,
    brachialis: 1,
    brachioradialis: 1,
    gastrocnemius: 4,
    soleus: 4,
    pronators: 0,
    obliques: 0,
    hip_abductors: 0,
    hip_flexors: 0,
    tibialis: 0,
    foot: 0,
    cuff: 0,
    serratus: 0,
    lower_traps: 0,
    neck: 0,
  };
  assert.deepEqual(Object.keys(expected).sort(), Object.keys(MUSCLES).sort());
  assert.deepEqual(
    Object.keys(MUSCLE_DECISIONS).sort(),
    Object.keys(MUSCLES).sort(),
  );
  for (const [id, total] of Object.entries(expected)) {
    assert.equal(l.muscles[id].fractional, total, id);
    assert.equal(
      l.muscles[id].fractional,
      l.muscles[id].direct + l.muscles[id].indirect / 2,
    );
    assert.equal(
      DAYS.reduce(
        (n, d) =>
          n + doseLedger([dayPlan(s.training, d)]).muscles[id].fractional,
        0,
      ),
      total,
    );
  }
  assert(l.muscles.traps.additional.includes("Full snatch from floor"));
  assert(l.muscles.upper_chest.additional.includes("Flat barbell bench press"));
  assert(l.muscles.erectors.additional.length);
  assert(!l.exercises.some((e) => /thrust|glute bridge/i.test(e.name)));
  const restricted = doseLedger([
    dayPlan(s.training, "tuesday", { level: "amber" }),
  ]);
  assert.equal(restricted.olympic + restricted.conventional, 0);
  const verified = doseLedger([
    dayPlan(s.training, "tuesday", { event: "verification" }),
  ]);
  assert(verified.exercises.every((e) => e.sets === 1));
});

test("multiple Olympic failure sets keep independent endpoints and enforced recovery, variable pacing and undo", () => {
  const s = start(),
    e = nextRow(s.active);
  assert.equal(e.sets, 2);
  rep(s, now + 1000);
  rep(s, now + 31000, { outcome: "miss" });
  sync(s, now + 31000);
  assert.equal(rowStatus(s.active, e).done, false);
  assert.equal(rowStatus(s.active, e).completedSets, 1);
  assert.equal(nextRow(s.active).key, e.key);
  assert.equal(s.restEnd, now + 331000);
  assert.throws(() => rep(s, now + 32000), /5 minutes/);
  const rest = s.active.pacing.plan.find((x) => x.id === "cj:rest:0");
  assert.equal(rest.seconds, 300);
  assert.equal(rest.afterAttempt, 1);
  assert(!s.active.pacing.plan.some((x) => x.id === "cj:within:1"));
  rep(s, now + 331000);
  for (let i = 0; i < 5; i++) rep(s, now + 361000 + i * 30000);
  sync(s, now + 511000);
  assert(s.active.pacing.plan.some((x) => x.id === "cj:work:8"));
  rep(s, now + 541000, { grade: "C", fault: "Unstable overhead" });
  sync(s, now + 541000);
  assert.equal(rowStatus(s.active, e).done, true);
  assert.equal(rowStatus(s.active, e).completedSets, 2);
  assert(successfulRow(s.active, e));
  assert.deepEqual(
    failureSets(s.active.sets.filter((x) => x.key === e.key)).map(
      (set) => set.length,
    ),
    [2, 7],
  );
  assert.deepEqual(validate(s), s);
  s.active.sets.pop();
  sync(s, now + 542000);
  assert.equal(rowStatus(s.active, e).done, false);
  assert.equal(rowStatus(s.active, e).currentSet, 2);
  assert(s.active.pacing.plan.some((x) => x.id === "cj:work:8"));
  assert.deepEqual(validate(s), s);
});

test("zero valid reps and repeated material faults stop remaining Olympic sets", () => {
  const s = start(),
    e = nextRow(s.active);
  rep(s, now + 1000, { outcome: "miss" });
  sync(s, now + 1000);
  assert.equal(rowStatus(s.active, e).done, true);
  assert.equal(rowStatus(s.active, e).endpointReached, false);
  assert(!s.active.pacing.plan.some((x) => x.id === "cj:rest:0"));
  assert(!successfulRow(s.active, e));
  const other = start(),
    row = nextRow(other.active);
  row.sets = 3;
  rep(other, now + 1000);
  rep(other, now + 31000, { grade: "C", fault: "Press out" });
  rep(other, now + 331000);
  rep(other, now + 361000, { grade: "C", fault: "press out" });
  assert.equal(rowStatus(other.active, row).done, true);
  assert.match(rowStatus(other.active, row).reason, /same material fault/);
  assert.equal(rowStatus(other.active, row).endpointReached, false);
});

test("load increases require every prescribed set, not only a successful first set", () => {
  const e = dayPlan(base().training, "tuesday").sessions[0].rows[0];
  e.hold = false;
  const set = (n) => [
    ...Array.from({ length: n }, () => ({
      weight: 100,
      outcome: "make",
      grade: "A",
    })),
    { weight: 100, outcome: "miss", grade: "C" },
  ];
  const history = (sets) =>
    [1, 2].map(() => ({ normal: true, sets, record: { omissions: [] } }));
  assert.equal(failureProgression(e, history(set(4)), 5).weight, 100);
  assert.equal(
    failureProgression(e, history([...set(4), ...set(2)]), 5).weight,
    100,
  );
  assert.equal(
    failureProgression(e, history([...set(4), ...set(4)]), 5).weight,
    105,
  );
});

test("reviewed additions and reductions apply to the chosen existing exercise/day and survive cloud import", () => {
  const s = base();
  applyChange(s, change("olympic_set"), now);
  assert.equal(dayPlan(s.training, "tuesday").sessions[0].rows[0].sets, 3);
  assert.equal(
    dayPlan(s.training, "friday").sessions[0].rows.find((e) => e.id === "cj")
      .sets,
    2,
  );
  assert.equal(
    dayPlan(s.training, "tuesday", { event: "limited_later" }).sessions[0]
      .rows[0].sets,
    2,
  );
  assert.throws(
    () => applyChange(s, change("set", "incline"), now),
    /existing controlled trial/,
  );
  assert.throws(
    () => reviewTrial(s, s.training.trials[0].id, "retain", "Tolerated", now),
    /two normal green weeks/,
  );
  applyChange(s, change("reduce_set"), now + 1000);
  assert(s.training.trials[0].paused);
  applyChange(s, change("reduce_set"), now + 2000);
  assert.equal(dayPlan(s.training, "tuesday").sessions[0].rows[0].sets, 1);
  assert.throws(
    () => applyChange(s, change("reduce_set"), now + 3000),
    /at least two/,
  );
  const restored = adoptJournalEntities(fresh(), journalEntities(s));
  assert.deepEqual(restored.training.setReductions, s.training.setReductions);
  assert.deepEqual(validate(s), s);
  const conv = base();
  applyChange(conv, change("set", "bench"), now);
  assert.equal(
    dayPlan(conv.training, "tuesday").sessions[0].rows.find(
      (e) => e.id === "bench",
    ).sets,
    3,
  );
  assert.throws(
    () => applyChange(base(), change("set", "back_squat"), now),
    /exists on this day/,
  );
  assert.throws(
    () => applyChange(base(), change("olympic_set", "jerk", "monday"), now),
    /existing Olympic/,
  );
});

test("new dose migration freezes a legacy active prescription and invalidates old duration calibration", () => {
  const s = start();
  s.training.failureEntry = 3;
  delete s.training.doseVersion;
  delete s.active.timeConfig.doseVersion;
  for (const session of [
    s.active.session,
    s.active.baseSession,
    s.active.originalSession,
  ])
    for (const row of session.rows.filter((e) => e.endpointPolicy)) {
      row.endpointPolicy = LEGACY_FAILURE_POLICY;
      row.sets = 1;
    }
  const frozen = copy(s.active),
    migrated = validate(s);
  assert.equal(migrated.training.nextDoseVersion, DOSE_VERSION);
  assert.deepEqual(migrated.active, frozen);
  stopSession(migrated, "Synthetic old-session stop", now + 1000);
  assert.equal(migrated.training.nextDoseVersion, DOSE_VERSION);
  assert.equal(migrated.training.doseVersion, undefined);
  assert.equal(
    migrated.records[0].session.rows[0].endpointPolicy,
    LEGACY_FAILURE_POLICY,
  );
  const current = base(),
    newSession = planFor(current, "tuesday").sessions[0],
    old = copy(newSession);
  old.rows
    .filter((e) => e.endpointPolicy)
    .forEach((e) => {
      e.endpointPolicy = LEGACY_FAILURE_POLICY;
      e.sets = 1;
    });
  assert.notEqual(
    prescriptionSignature(old, current.training),
    prescriptionSignature(newSession, current.training),
  );
  assert(buildPlannerFeed(current));
  const time = fixedSession(newSession, current.training);
  assert.equal(
    time.seconds[0],
    time.stages.reduce((n, x) => n + x.seconds, 0),
  );
});

test("a renewed source entry dose and reductions never hide trial sets or produce zero-set rows", () => {
  const s = base();
  s.training.entry = 2;
  assert.equal(ledger(s).conventional, 41);
  assert.equal(ledger(s).olympic, 6);
  s.training.entry = 3;
  s.training.setReductions = [{ day: "tuesday", exercise: "cj", sets: 1 }];
  applyChange(s, change("olympic_set"), now);
  s.training.failureEntry = 3;
  const ordinary = dayPlan(s.training, "tuesday").sessions[0].rows[0];
  const limited = dayPlan(s.training, "tuesday", { event: "limited_later" })
    .sessions[0].rows[0];
  assert.equal(ordinary.sets, 2);
  assert.equal(limited.sets, 1);
  assert.equal(limited.trialIds.length, 0);
  assert.deepEqual(validate(s), s);
});
