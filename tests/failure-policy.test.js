import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  planFor,
  startSession,
  logSet,
  nextRow,
  rowStatus,
  finishSession,
  stopSession,
  scheduledDate,
  localDate,
  advanceWeek,
  consumedBench,
  benchWindow,
  successfulRow,
  nextQualityRange,
  reassessActive,
  exposureHistory,
  fingerprint,
  monitoring,
} from "../src/training.js";
import { dayPlan, DAYS, describe, copy } from "../src/prescription.js";
import {
  allLoadedFailure,
  olympicFailure,
  failureReached,
  validReps,
  failureProgression,
  adoptFailurePolicy,
  failureTrialPending,
} from "../src/failure-policy.js";
import { programDays } from "../src/calendar.js";
import { validate, loadStore } from "../src/storage.js";
import { fixedSession, fixedDay } from "../src/timeline.js";
import { syncPacing, paceStage } from "../src/pacing.js";
import {
  applyChange,
  CHANGE_OPTIONS,
  sourceOlympicChange,
} from "../src/review.js";
import {
  prescriptionSignature,
  buildPlannerFeed,
  journalEntities,
  adoptJournalEntities,
} from "../src/planner-feed.js";

const base = () => fresh("2026-09-21", "weekday", "all-failure");
const ready = (s, date = scheduledDate(s, "tuesday")) => {
  s.readiness = { date, level: "green", event: "normal", local: "" };
  return Date.parse(date + "T15:00:00-05:00");
};
const start = () => {
  const s = base();
  const now = ready(s);
  startSession(s, "tuesday", "main", now);
  s.active.warmup = true;
  s.active.preparations = s.active.session.rows.map((e) => e.key);
  return { s, now };
};
const attempt = (s, now, fields = {}) =>
  logSet(
    s,
    { weight: 100, outcome: "make", grade: "A", effort: 9, ...fields },
    now,
  );
const sync = (w, now) =>
  syncPacing(
    w,
    Object.fromEntries(w.session.rows.map((e) => [e.key, rowStatus(w, e)])),
    now,
  );
const review = {
  action: "advance",
  green: true,
  recovery: "normal",
  buildReady: true,
  realizationReady: true,
  scheduleQuality: true,
  notes: "Synthetic complete, normal next-session review",
};
function completeWeek(s) {
  let count = 0;
  for (const day of programDays(s.training)) {
    if (!planFor(s, day).sessions.some((e) => e.id === "main")) continue;
    let now = ready(s, scheduledDate(s, day));
    if (
      planFor(s, day).sessions.some((se) =>
        se.rows.some((e) => e.id === "bench"),
      )
    )
      now = Math.max(now, benchWindow(s, now).eligibleAt || 0);
    s.readiness.date = localDate(new Date(now));
    startSession(s, day, "main", now);
    s.active.warmup = true;
    while (nextRow(s.active)) {
      const e = nextRow(s.active);
      s.active.preparations.push(e.key);
      now += 300000;
      if (olympicFailure(e)) {
        const weight = nextQualityRange(s.active, e)[0];
        const n = rowStatus(s.active, e).currentValidReps;
        attempt(s, now, {
          weight,
          outcome: n >= e.validRepRange[1] ? "miss" : "make",
        });
      } else
        logSet(
          s,
          { weight: 100, reps: e.repRange[0], endpoint: "failure" },
          now,
        );
    }
    finishSession(s, "Synthetic audit session", now + 1000);
    s.records.at(-1).followup = { normal: true };
    assert.equal(s.records.at(-1).status, "complete");
    assert.deepEqual(validate(s), s);
    count++;
  }
  return count;
}

test("all 52 weeks and readiness/event/regression configurations retain only failure-ended loaded work", () => {
  const s = base();
  s.training.entry = 3;
  s.training.failureEntry = 4;
  s.training.gate = "R";
  s.training.anchors.jerk = 215;
  const contexts = [
    {},
    { level: "amber" },
    { level: "red" },
    { event: "verification" },
    { event: "limited_later" },
    { event: "larger_later" },
    { sport: "game", rehearsal: true, level: "green" },
    { sport: "game_later" },
    { local: "upper" },
    { local: "lower" },
    { noProtection: true },
  ];
  for (let cycle = 1; cycle <= 4; cycle++)
    for (let week = 1; week <= 13; week++) {
      Object.assign(s.training, { cycle, week });
      const rows = DAYS.flatMap((day) =>
        dayPlan(s.training, day).sessions.flatMap((se) => se.rows),
      );
      const olympic = rows.filter((e) => e.kind === "quality");
      assert.equal(
        olympic.length,
        week === 13 ? 0 : week === 12 ? 4 : week >= 9 ? 8 : 9,
      );
      for (const ctx of contexts)
        for (const recovery of ["normal", "targeted", "reset", "restore"])
          for (const day of DAYS) {
            const config = { ...s.training, recovery };
            const p = dayPlan(config, day, ctx);
            for (const se of p.sessions.filter((se) => !se.skipped))
              for (const e of se.rows) {
                if (e.kind === "quality") {
                  assert(olympicFailure(e));
                  assert(e.sets >= 1 && e.sets <= 2);
                  assert.equal(e.effort, 10);
                  assert(!["amber", "red"].includes(ctx.level));
                  assert(!["targeted", "reset"].includes(recovery));
                  assert.notEqual(ctx.sport, "game_later");
                  assert.match(describe(e), /first miss\/invalid/);
                }
              }
            const time = fixedDay(p, config);
            assert(Number.isFinite(time.seconds[0]));
            assert.equal(time.seconds[0], time.seconds[1]);
          }
    }
  s.training.week = 3;
  for (const family of ["snatch", "clean", "jerk"])
    for (const mode of [
      "receive",
      "return",
      "turnover",
      "balance",
      "stance",
      "dip",
    ]) {
      const c = copy(s.training);
      c.technique[family] = mode;
      const rows = DAYS.flatMap((d) =>
        dayPlan(c, d).sessions.flatMap((se) => se.rows),
      );
      assert(
        !rows.some(
          (e) => e.kind === "quality" && (!olympicFailure(e) || e.regression),
        ),
      );
      if (family === "jerk")
        assert(!rows.some((e) => e.id === "cj" || e.id === "jerk"));
    }
});

test("rep targets and timers cannot complete Olympic work; first miss or C ends immediately with no retry", () => {
  for (const end of [
    { outcome: "miss" },
    { outcome: "clean_miss" },
    { outcome: "jerk_miss" },
    { grade: "C", fault: "Unstable lockout" },
  ]) {
    const { s, now } = start();
    const w = s.active,
      e = nextRow(w);
    for (let i = 0; i < e.reps + 2; i++) attempt(s, now + 60000 * i);
    assert.equal(nextRow(w).key, e.key);
    assert.equal(rowStatus(w, e).done, false);
    assert.equal(rowStatus(w, e).validReps, e.reps + 2);
    assert.throws(() => attempt(s, now + 500000, { weight: 95 }), /same load/);
    sync(w, now + 500000);
    assert(
      w.pacing.plan.some((step) => step.id === `${e.key}:work:${e.reps + 2}`),
    );
    assert(
      w.pacing.plan.some(
        (step) =>
          step.id === `${e.key}:within:${e.reps + 1}` && step.seconds === 15,
      ),
    );
    attempt(s, now + 600000, end);
    assert.equal(rowStatus(w, e).endpointReached, true);
    assert.notEqual(nextRow(w).key, e.key);
    assert.equal(rowStatus(w, e).validReps, e.reps + 2);
    assert.equal(successfulRow(w, e), true);
    sync(w, now + 600000);
    assert(
      !w.pacing.plan.some((step) => step.id === `${e.key}:work:${e.reps + 3}`),
    );
    assert(
      w.pacing.plan.some(
        (step) => step.role === "recovery" && step.seconds === 300,
      ),
    );
    assert.deepEqual(validate(s), s);
  }
});

test("early terminal attempts shorten pacing; zero valid reps do not earn progression; safety/voluntary stops remain incomplete", () => {
  const { s, now } = start();
  const w = s.active,
    e = nextRow(w);
  attempt(s, now + 1000, { outcome: "miss" });
  sync(w, now + 1000);
  assert.equal(rowStatus(w, e).validReps, 0);
  assert(!successfulRow(w, e));
  assert(
    !w.pacing.plan.some(
      (step) =>
        step.id === `${e.key}:work:1` || step.id === `${e.key}:within:0`,
    ),
  );
  const malformed = copy(s);
  malformed.active.sets.push({ ...malformed.active.sets[0], id: "retry" });
  assert.throws(() => validate(malformed), /first invalid/);
  w.sets.pop();
  sync(w, now + 2000);
  assert.equal(nextRow(w).key, e.key);
  assert(w.pacing.plan.some((step) => step.id === `${e.key}:work:4`));
  attempt(s, now + 3000, { endpoint: "pain" });
  finishSession(s, "Pain stop", now + 4000);
  assert.equal(s.records.at(-1).status, "partial");
  const voluntary = start();
  attempt(voluntary.s, voluntary.now + 1000);
  stopSession(voluntary.s, "Stopped before endpoint", voluntary.now + 2000);
  assert.equal(voluntary.s.records[0].status, "partial");
});

test("migration is immediate for unstarted work, freezes active prescriptions, and preserves old records and comparison keys", () => {
  const s = fresh("2026-09-21");
  delete s.training.workSetPolicy;
  const migrated = validate(s);
  assert(allLoadedFailure(migrated.training));
  assert.equal(migrated.training.failureEntry, 1);
  assert.deepEqual(validate(migrated), migrated);
  const source = fresh("2026-09-21");
  const now = ready(source);
  startSession(source, "tuesday", "main", now);
  delete source.training.workSetPolicy;
  const original = copy(source.active);
  const pending = validate(source);
  assert.equal(pending.training.nextWorkSetPolicy, "all-failure");
  assert.deepEqual(pending.active, original);
  stopSession(pending, "End old session", now + 1000);
  assert(allLoadedFailure(pending.training));
  assert.deepEqual(pending.records[0].session, original.session);
  assert(!pending.records[0].session.rows.some(olympicFailure));
  const next = planFor(pending, "thursday").sessions[0].rows.find(
    olympicFailure,
  );
  assert.equal(exposureHistory(pending, next).length, 0);
  const empty = loadStore({ getItem: () => null }).state;
  assert(allLoadedFailure(empty.training));
  assert.notEqual(
    fingerprint(next),
    fingerprint({ ...next, endpointPolicy: undefined }),
  );
});

test("progression needs two comparable normal terminal sets and honors holds, same-load comparisons and rep-loss review", () => {
  const { s } = start(),
    e = nextRow(s.active);
  e.hold = false;
  const history = (count, normal = true, weight = 100) => ({
    normal,
    record: { omissions: [] },
    sets: [
      ...Array.from({ length: count }, () => ({
        weight,
        outcome: "make",
        grade: "A",
      })),
      { weight, outcome: "miss", grade: "A" },
    ],
  });
  assert.equal(failureProgression(e, [history(4), history(4)], 5).weight, 105);
  assert.equal(
    failureProgression(e, [history(4), history(4, false)], 5).weight,
    100,
  );
  assert.equal(
    failureProgression(e, [history(4, true, 95), history(4)], 5).weight,
    100,
  );
  assert.equal(
    failureProgression({ ...e, hold: true }, [history(4), history(4)], 5)
      .weight,
    100,
  );
  assert.equal(failureProgression(e, [history(0)], 5).weight, 90);
  assert.equal(failureReached(history(4).sets), true);
  assert.equal(validReps(history(4).sets), 4);
  for (const kind of Object.keys(CHANGE_OPTIONS).filter(sourceOlympicChange))
    assert.throws(() => applyChange(base(), { kind }), /failure amendment/);
  assert.throws(
    () => applyChange(base(), { kind: "athletic_start" }),
    /failure introduction/,
  );
});

test("mid-set readiness changes omit failure work even after more than the nominal attempt budget", () => {
  const { s, now } = start(),
    e = nextRow(s.active);
  for (let i = 0; i < 7; i++) attempt(s, now + i * 60000);
  reassessActive(s, now + 450000);
  assert.equal(nextRow(s.active).key, e.key);
  s.readiness.level = "amber";
  reassessActive(s, now + 500000);
  assert.equal(rowStatus(s.active, e).done, true);
  assert(s.active.omissions.some((o) => o.key === e.key));
  assert.equal(rowStatus(s.active, e).endpointReached, false);
});

test("failure time signatures do not reuse quality-session calibration and survive the Planner/cloud round trip", () => {
  const s = base(),
    session = planFor(s, "tuesday").sessions[0];
  const source = copy(session);
  source.rows.forEach((e) => {
    delete e.endpointPolicy;
    delete e.validRepRange;
    delete e.resetSeconds;
    delete e.recoveryAfter;
  });
  assert.notEqual(
    prescriptionSignature(session, s.training),
    prescriptionSignature(source, s.training),
  );
  const feed = buildPlannerFeed(s);
  assert(feed);
  const restored = adoptJournalEntities(fresh(), journalEntities(s));
  assert(allLoadedFailure(restored.training));
  assert.deepEqual(restored.training, s.training);
  const clock = fixedSession(session, s.training);
  assert.equal(
    clock.seconds[0],
    clock.stages.reduce((sum, step) => sum + step.seconds, 0),
  );
});

test("52-week runner completes the amended taper/pivot, all failure endpoints and both correctly spaced bench exposures", () => {
  const s = base();
  let sessions = 0;
  for (let yearWeek = 1; yearWeek <= 52; yearWeek++) {
    sessions += completeWeek(s);
    assert(consumedBench(s, "bench_low"));
    assert(consumedBench(s, "bench_moderate"));
    const benches = s.records
      .map((r) => r.sets.filter((x) => x.exerciseId === "bench"))
      .filter((sets) => sets.length);
    for (let i = 1; i < benches.length; i++)
      assert(benches[i][0].at - benches[i - 1].at(-1).at >= 48 * 3600000);
    advanceWeek(s, review);
    if (yearWeek === 1) assert.equal(s.training.failureEntry, 2);
    if (yearWeek === 2) assert.equal(s.training.failureEntry, 3);
    if (yearWeek === 3) assert.equal(s.training.failureEntry, 3);
    if (yearWeek === 4) assert.equal(s.training.failureEntry, 4);
    if (yearWeek === 6) assert.equal(failureTrialPending(s.training), false);
  }
  assert.equal(sessions, 196);
  assert(s.completed);
  assert(!monitoring(s).some((flag) => flag.includes("below 90%")));
});
