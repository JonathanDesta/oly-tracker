import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  dayPlan,
  failure,
  quality,
  loadRange,
  DAYS,
} from "../src/prescription.js";
import {
  fresh,
  planFor,
  startSession,
  nextRow,
  logSet,
  finishSession,
  reassessActive,
  advanceWeek,
  attempts,
  contextFor,
  nextLoad,
  nextQualityRange,
  monitoring,
  monitoringTotals,
  exposureHistory,
} from "../src/training.js";
import { applyChange, reviewTrial, trialExposures } from "../src/review.js";
import { validate } from "../src/storage.js";
const mon = new Date("2026-09-14T10:00:00").getTime();
const rows = (p) => p.sessions.flatMap((s) => (s.skipped ? [] : s.rows));
function ready(week = 3) {
  const s = fresh("2026-09-14");
  Object.assign(s.training, {
    week,
    entry: 3,
    gate: week < 5 ? "F" : week < 9 ? "B" : "R",
  });
  s.readiness = {
    date: "2026-09-14",
    level: "green",
    event: "normal",
    local: "",
  };
  return s;
}
function recorded(
  e,
  {
    day = "monday",
    weight = 100,
    at = mon - 7 * 86400000,
    context = {},
    sessionId = "main",
    ...extra
  } = {},
) {
  return {
    id: crypto.randomUUID(),
    weekId: crypto.randomUUID(),
    week: 3,
    cycle: 1,
    day,
    date: new Date(at).toISOString().slice(0, 10),
    startedAt: at,
    endedAt: at + 3600000,
    session: {
      id: sessionId,
      kind: "lifting",
      title: "Source fixture",
      rows: [structuredClone(e)],
    },
    context: {
      level: "green",
      event: "normal",
      recovery: "normal",
      ...context,
    },
    followup: { normal: true },
    omissions: [],
    status: "complete",
    sets: Array.from(
      { length: e.kind === "quality" ? attempts(e) : e.sets },
      (_, i) => ({
        key: e.key,
        exerciseId: e.id,
        at: at + i * 300000,
        weight,
        ...(e.kind === "quality"
          ? {
              reps: e.id === "cj" ? "1+1" : 1,
              outcome: "make",
              grade: "A",
              effort: 6,
            }
          : e.kind === "speed"
            ? { reps: e.reps, quality: "good" }
            : { reps: e.repRange[1], endpoint: "failure" }),
      }),
    ),
    ...extra,
  };
}
const change = (kind, extra = {}) => ({
  kind,
  ready: true,
  stable: true,
  reason: "Source audit eligibility observations",
  ...extra,
});
test("full audit p.18: checkpoint repeats the same day's Olympic work, never another day's heavier CJ", () => {
  const s = ready(4),
    a = rows(dayPlan({ ...s.training, week: 3 }, "monday")).find(
      (e) => e.id === "cj",
    ),
    d = rows(dayPlan({ ...s.training, week: 3 }, "friday")).find(
      (e) => e.id === "cj",
    );
  s.records = [
    recorded(a, { weight: 125 }),
    recorded(d, { day: "friday", weight: 170 }),
  ];
  const held = rows(planFor(s, "monday")).find((e) => e.id === "cj");
  assert.deepEqual(loadRange(held, s.training.anchors), [125, 125]);
});
test("full audit pp.17/18/24: stricter readiness wins over held loads and is idempotent", () => {
  const s = ready(4),
    e = rows(dayPlan(s.training, "monday")).find((e) => e.id === "cj");
  s.records = [recorded(e, { weight: 140 })];
  s.readiness.event = "verification";
  const verified = rows(planFor(s, "monday", true, mon)).find(
    (e) => e.id === "cj",
  );
  assert.ok(loadRange(verified, s.training.anchors)[1] <= 125);
  s.readiness.event = "normal";
  s.readiness.level = "amber";
  startSession(s, "monday", "main", mon);
  const before = structuredClone(s.active.session.rows);
  reassessActive(s, mon);
  reassessActive(s, mon);
  assert.deepEqual(s.active.session.rows, before);
});
test("full audit pp.14/34: reduced lower block plus partial calf substitution has one calf set", () => {
  const c = defaults();
  c.entry = 3;
  c.lowerDose = true;
  c.trials = [
    {
      id: "calf",
      kind: "calf_partial",
      day: "friday",
      paused: false,
      reviews: [],
    },
  ];
  assert.equal(
    rows(dayPlan(c, "friday"))
      .filter((e) => e.id === "calf")
      .reduce((n, e) => n + e.sets, 0),
    1,
  );
  c.equipment.calf = "seated";
  assert.ok(!rows(dayPlan(c, "friday")).some((e) => e.key === "calf_partial"));
});
test("full audit pp.4/23: visit 2 cannot replay a completed day's omitted blocks later", () => {
  const s = ready();
  s.training.split = true;
  const first = dayPlan(s.training, "tuesday").sessions.find(
    (e) => e.id === "main",
  );
  const r = recorded(first.rows[0], { day: "tuesday", at: mon - 86400000 });
  r.session = first;
  r.weekId = s.weekId;
  r.date = "2026-09-13";
  r.sets = [];
  s.records.push(r);
  s.weekStart = "2026-09-12";
  assert.throws(
    () => startSession(s, "tuesday", "accessories", mon),
    /same day|omitted blocks/i,
  );
});
test("full audit p.32: TECH, failed or over-cap trial outcomes do not count as comparable successes", () => {
  const s = ready(),
    t = { id: "press", kind: "press", day: "friday", reviews: [] };
  const e = failure("press", 1, 6, 10, 210, { trialId: t.id });
  const r = recorded(e, { day: "friday" });
  r.sets[0].endpoint = "tech";
  s.records = [r];
  assert.equal(trialExposures(s, t).length, 0);
  const q = quality("pause_jerk", 2, 1, [60, 75], "jerk", 7, 180, {
    trialId: t.id,
  });
  s.records = [recorded(q)];
  s.records[0].sets[1].outcome = "miss";
  assert.equal(trialExposures(s, t).length, 0);
});
test("full audit pp.15/32: a new weekly set cannot be retained before its two-week observation", () => {
  const s = ready(),
    t = {
      id: "set",
      kind: "set",
      day: "tuesday",
      exercise: "shrug",
      reviews: [],
      status: "testing",
      paused: false,
    };
  s.training.trials = [t];
  assert.throws(
    () => reviewTrial(s, t.id, "retain", "No observations yet", mon),
    /two|2/,
  );
  assert.equal(t.reviews.length, 0);
});
test("full audit p.28: Build heavy progression must establish 85–88 before 90–92", () => {
  const s = ready(5);
  applyChange(s, change("heavy_snatch"), mon);
  assert.equal(s.training.heavy.snatch, 88);
});
test("full audit p.29: future previews use the same relocation and alternate-exposure state as workouts", () => {
  const s = ready(5);
  Object.assign(s.training.athletics, {
    enabled: true,
    stage: 7,
    variation: "fly",
  });
  s.athleticDay = "thursday";
  const a = dayPlan(s.training, "monday").sessions.find(
    (x) => x.kind === "athletic",
  );
  const r = recorded(a.rows[0], { sessionId: "athletics" });
  r.session = a;
  s.records = [r];
  assert.ok(!planFor(s, "monday").sessions.some((x) => x.kind === "athletic"));
  const c = planFor(s, "thursday").sessions.find((x) => x.kind === "athletic");
  assert.ok(c);
  assert.ok(!c.rows.some((e) => e.id === "fly"));
});
function athleticRecord(s, at, secondary = false) {
  const day = secondary ? "thursday" : "monday";
  const se = dayPlan(s.training, day).sessions.find(
    (x) => x.id === (secondary ? "athletics-secondary" : "athletics"),
  );
  return recorded(se.rows[0], {
    at,
    day,
    session: se,
    sets: se.rows.flatMap((e) => recorded(e, { at }).sets),
  });
}
test("full audit p.29: interruption means off all athletics and requires two complete good returns", () => {
  const s = ready(5);
  Object.assign(s.training.athletics, {
    enabled: true,
    stage: 7,
    secondary: 2,
  });
  s.records = [
    athleticRecord(s, mon - 28 * 86400000),
    athleticRecord(s, mon - 7 * 86400000, true),
  ];
  assert.equal(contextFor(s, mon).athleticReturn, true); // first return after the old gap: only one good exposure
  s.records.push(athleticRecord(s, mon - 3 * 86400000, true));
  assert.equal(contextFor(s, mon).athleticReturn, false); // primary absence alone cannot trigger return
  const later = mon + 20 * 86400000;
  assert.equal(contextFor(s, later).athleticReturn, true);
  const partial = athleticRecord(s, later);
  partial.sets.pop();
  s.records.push(partial);
  assert.equal(contextFor(s, later + 1000).athleticReturn, true);
  s.records.push(athleticRecord(s, later + 86400000));
  assert.equal(contextFor(s, later + 2 * 86400000).athleticReturn, true);
  s.records.push(athleticRecord(s, later + 3 * 86400000));
  assert.equal(contextFor(s, later + 4 * 86400000).athleticReturn, false);
});
test("full audit p.29: return reverses the last component step, not an unrelated primary dose", () => {
  const s = ready(5);
  Object.assign(s.training.athletics, {
    enabled: true,
    stage: 7,
    variation: "fly",
    intensity: 90,
  });
  s.records = [athleticRecord(s, mon - 7 * 86400000)];
  applyChange(s, change("variation_intensity"), mon);
  const c = contextFor(s, mon + 20 * 86400000);
  assert.equal(c.returnAthletics.stage, 7);
  assert.equal(c.returnAthletics.variation, "fly");
  assert.equal(c.returnAthletics.intensity, 90);
  assert.throws(
    () => applyChange(s, change("athletic_step"), mon + 20 * 86400000),
    /two good exposures/,
  );
});
test("full audit p.29: one component waits for observed good exposures; Thursday trial holds primary", () => {
  const s = ready(5);
  Object.assign(s.training.athletics, { enabled: true, stage: 7 });
  applyChange(s, change("athletic_second", { fourPrimary: true }), mon);
  assert.throws(
    () => applyChange(s, change("athletic_step"), mon),
    /two complete/,
  );
  for (let i = 1; i <= 2; i++)
    s.records.push(athleticRecord(s, mon + i * 86400000, true));
  applyChange(s, change("athletic_runs"), mon + 3 * 86400000);
  assert.equal(s.training.athletics.secondary, 2);
  assert.throws(
    () => applyChange(s, change("secondary_run"), mon + 3 * 86400000),
    /two complete/,
  );
});
test("full audit pp.23/24: every combined event applies the stricter active rule", () => {
  for (const week of [3, 4, 9, 11, 12, 13])
    for (const day of DAYS)
      for (const sport of ["game", "game_defer", "game_later"])
        for (const event of [
          "normal",
          "limited_later",
          "verification",
          "unsafe",
        ]) {
          const c = defaults();
          Object.assign(c, { week, entry: 3, gate: "R" });
          c.athletics.enabled = true;
          c.cardio.enabled = true;
          const plan = dayPlan(c, day, {
            level: "green",
            sport,
            event,
            rehearsal: true,
          });
          const active = plan.sessions.filter((x) => !x.skipped);
          if (event === "unsafe" || sport === "game_defer")
            assert.equal(active.length, 0);
          else if (sport === "game")
            assert.ok(
              active.every(
                (x) =>
                  x.id === "rehearsal" &&
                  x.rows.every((e) => e.sets <= 3 && e.range[1] <= 60),
              ),
            );
          else
            assert.ok(
              active.every(
                (x) =>
                  x.kind !== "athletic" &&
                  x.rows.every((e) => e.kind !== "failure"),
              ),
            );
        }
});
test("full audit pp.17/20: within-session load reduction is not compounded at the next normal exposure", () => {
  const e = failure("incline", 3, 6, 10, 210);
  const h = [
    {
      normal: true,
      sets: [
        { weight: 100, reps: 4, endpoint: "failure" },
        { weight: 90, reps: 7, endpoint: "failure" },
        { weight: 90, reps: 6, endpoint: "failure" },
      ],
    },
  ];
  assert.equal(nextLoad(e, h).weight, 90);
  h[0].sets.at(-1).reps = 4;
  assert.equal(nextLoad(e, h).weight, 83.25);
});
test("full audit p.32: resumed assistance holds its secure load for two valid exposures", () => {
  const s = ready(5);
  const t = {
    id: "trial",
    kind: "press",
    day: "friday",
    paused: true,
    status: "testing",
    reviews: [],
  };
  s.training.trials = [t];
  reviewTrial(s, t.id, "resume", "Still useful after readiness review", mon);
  const press = () =>
    rows(planFor(s, "friday", false, mon)).find((e) => e.id === "press");
  assert.equal(press().hold, true);
  s.records.push(
    recorded(press(), { at: mon + 86400000, day: "friday", weight: 80 }),
  );
  assert.equal(press().hold, true);
  s.records.push(
    recorded(press(), { at: mon + 8 * 86400000, day: "friday", weight: 80 }),
  );
  assert.equal(!!press().hold, false);
});
test("full audit p.32: pause-jerk progression requires two new secure exposures, increment and RJ band", () => {
  const s = ready(5);
  s.training.anchors.jerk = 200;
  const t = {
    id: "pause",
    kind: "pause_jerk",
    day: "thursday",
    paused: false,
    status: "testing",
    reviews: [],
  };
  s.training.trials = [t];
  const e = rows(planFor(s, "thursday", false, mon)).find(
    (x) => x.key === "pause_jerk",
  );
  assert.throws(
    () => applyChange(s, change("pause_load", { load: 135 }), mon),
    /Two secure/,
  );
  s.records = [
    recorded(e, { weight: 130, day: "thursday" }),
    recorded(e, { weight: 130, day: "thursday", at: mon - 86400000 }),
  ];
  assert.throws(
    () => applyChange(s, change("pause_load", { load: 140 }), mon),
    /2.5–5/,
  );
  applyChange(s, change("pause_load", { load: 135 }), mon);
  assert.equal(t.load, 135);
  assert.deepEqual(
    loadRange(
      rows(planFor(s, "thursday", false, mon)).find(
        (x) => x.key === "pause_jerk",
      ),
      s.training.anchors,
    ),
    [135, 135],
  );
  assert.throws(
    () => applyChange(s, change("pause_load", { load: 140 }), mon),
    /Two secure/,
  );
  s.training.week = 9;
  assert.throws(
    () => applyChange(s, change("pause_load", { load: 140 }), mon),
    /not eligible/,
  );
});
test("full audit pp.17/18: restrictions cannot be escaped by changing readiness back mid-workout", () => {
  const s = ready();
  s.readiness.level = "amber";
  startSession(s, "monday", "main", mon);
  const original = structuredClone(s.active.session.rows);
  s.readiness.level = "green";
  reassessActive(s, mon);
  assert.deepEqual(s.active.session.rows, original);
});
test("full audit p.27: assessment records lower valid references while ordinary singles only raise them", () => {
  for (const [assessment, weight, expected] of [
    [true, 175, 175],
    [false, 175, 200],
    [false, 210, 210],
  ]) {
    const s = ready(5);
    s.training.anchors.jerk = 200;
    const e = quality("jerk", 1, 1, [80, 100], "jerk", 8, 180, { assessment });
    const r = recorded(e, { day: "thursday", weight, at: mon });
    r.anchors = structuredClone(s.training.anchors);
    s.active = r;
    finishSession(s, "Observed reference audit", mon + 3600000);
    assert.equal(s.training.anchors.jerk, expected);
    assert.equal(s.training.anchors.cj, 205);
    assert.equal(s.records[0].anchors.jerk, 200);
  }
});
test("full audit pp.4/18: split visit must be resolved before green advancement", () => {
  const s = ready();
  s.training.split = true;
  for (const day of ["monday", "tuesday", "thursday", "friday"]) {
    const e = rows(dayPlan(s.training, day))[0];
    s.records.push(recorded(e, { day, weekId: s.weekId }));
  }
  assert.throws(
    () =>
      advanceWeek(
        s,
        { action: "advance", recovery: "normal", green: true, notes: "Review" },
        mon,
      ),
    /visit 2/,
  );
});
test("full audit operability: malformed trial/settings/snapshot/date backups are rejected before replacement", () => {
  const baseline = ready();
  startSession(baseline, "monday", "main", mon);
  const changes = [
    (s) =>
      s.reviews.push({
        at: mon,
        type: "change",
        change: { kind: "athletic_step" },
        afterAthletics: structuredClone(s.training.athletics),
        beforeAthletics: null,
      }),
    (s) => {
      s.active.sets = [
        {
          key: "snatch",
          exerciseId: "snatch",
          at: mon,
          weight: 100,
          reps: 1,
          outcome: "make",
          grade: "A",
          effort: 7,
          fault: 42,
        },
      ];
    },
    (s) => {
      s.active.sets = [
        {
          key: "snatch",
          exerciseId: "snatch",
          at: mon,
          weight: 100,
          reps: 1,
          outcome: "make",
          grade: "A",
          effort: 7,
          heights: "broken",
        },
      ];
    },
    (s) =>
      s.training.trials.push({
        id: "x",
        kind: "squat",
        day: "tuesday",
        reviews: [],
      }),
    (s) => (s.training.athletics.intensity = 101),
    (s) => (s.training.athletics.secondaryRuns = 2.5),
    (s) => (s.training.equipment.calf = "unlisted"),
    (s) => (s.training.reduceA = "false"),
    (s) => (s.weekStart = "2026-02-31"),
    (s) => (s.active.baseSession.rows[0].range = [90, 10]),
    (s) => (s.active.anchors = null),
    (s) => s.reviews.push({ at: mon, type: "change", change: null }),
  ];
  for (const mutate of changes) {
    const s = structuredClone(baseline);
    mutate(s);
    assert.throws(() => validate(s), /Invalid backup/);
  }
  assert.deepEqual(validate(baseline), baseline);
});
test("full audit p.28: later Foundation can earn 90 without silently unlocking Build 92", () => {
  const s = ready();
  s.training.cycle = 2;
  applyChange(s, change("heavy_snatch"), mon);
  assert.equal(s.training.heavy.snatch, 88);
  applyChange(s, change("heavy_snatch"), mon);
  assert.equal(s.training.heavy.snatch, 90);
  let e = rows(dayPlan(s.training, "friday")).find((x) => x.id === "snatch");
  assert.deepEqual(e.sequence.at(-1), [85, 90]);
  s.training.week = 5;
  s.training.gate = "B";
  e = rows(dayPlan(s.training, "friday")).find((x) => x.id === "snatch");
  assert.deepEqual(e.sequence.at(-1), [88, 90]);
  assert.equal(e.finalEffort, 8);
  applyChange(s, change("heavy_snatch"), mon);
  assert.equal(s.training.heavy.snatch, 92);
});
test("full audit p.24: verification volume requires confirmation of the return and next warm-ups", () => {
  const s = ready();
  const e = quality("snatch", 3, 1, [60, 60], "snatch");
  s.records = [
    recorded(e, { context: { event: "verification" }, followup: null }),
  ];
  assert.equal(contextFor(s, mon).event, "verification");
  s.records[0].followup = { normal: true };
  assert.equal(contextFor(s, mon).event, "normal");
});
test("full audit pp.19/27: test attempts and component assessments use prior outcomes to bound progression", () => {
  const e = quality("snatch", 3, 1, [88, 92], "snatch", 10, 270, {
    test: true,
  });
  const w = { anchors: { snatch: 155 }, increment: 5, sets: [] };
  assert.deepEqual(nextQualityRange(w, e), [135, 140]);
  w.sets = [{ key: e.key, weight: 140, outcome: "miss", grade: "A" }];
  assert.deepEqual(nextQualityRange(w, e), [140, 140]);
  Object.assign(w.sets[0], { outcome: "make", easy: true });
  assert.deepEqual(nextQualityRange(w, e), [150, 155]);
  w.sets.push({ key: e.key, weight: 155, outcome: "make", grade: "A" });
  assert.deepEqual(nextQualityRange(w, e), [155, 160]);
  w.sets[1].outcome = "miss";
  assert.deepEqual(nextQualityRange(w, e), [155, 155]);
  const j = quality("jerk", 5, 1, null, null, 8, 210, { assessment: true });
  w.sets = [
    { key: j.key, weight: 165, outcome: "make", grade: "A", effort: 6 },
  ];
  assert.deepEqual(nextQualityRange(w, j), [165, 185]);
  w.sets[0].effort = 7;
  assert.deepEqual(nextQualityRange(w, j), [165, 175]);
});
test("full audit pp.17/28/30: monitoring counts actual heavy attempts and preserves review flags", () => {
  const s = ready();
  const e = quality("snatch", 1, 1, [80, 95]);
  for (let i = 0; i < 2; i++) {
    const r = recorded(e, { at: mon - (2 - i) * 86400000, weight: 145 });
    r.anchors = { snatch: 155, cj: 205 };
    r.followup.loadDrop = true;
    if (i === 0)
      Object.assign(r.sets[0], { outcome: "miss", preparation: true });
    s.records.push(r);
  }
  assert.equal(monitoringTotals(s).heavy.snatch, 2);
  assert.ok(monitoring(s).some((x) => x.includes("5%")));
  const cardio = {
    key: "aerobic",
    id: "aerobic",
    name: "Walk",
    kind: "aerobic",
    minutes: 20,
  };
  s.records.push(
    recorded(cardio, {
      session: { id: "cardio", kind: "cardio", rows: [cardio] },
      sets: [{ key: "aerobic", exerciseId: "aerobic", minutes: 20 }],
    }),
  );
  assert.ok(monitoring(s).some((x) => x.includes("5%")));
});
