import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  dayPlan,
  failure,
  describe,
  loadRange,
} from "../src/prescription.js";
import {
  fresh,
  startSession,
  nextRow,
  logSet,
  nextLoad,
  startingEstimate,
} from "../src/training.js";
import { applyChange } from "../src/review.js";
import { validate } from "../src/storage.js";
const monday = new Date("2026-09-14T10:00:00").getTime();
const rows = (c, day, ctx = {}) =>
  dayPlan(c, day, ctx).sessions.flatMap((s) => s.rows);
function profile() {
  const s = fresh("2026-09-14", "source");
  s.training.entry = 3;
  s.readiness = {
    date: "2026-09-14",
    level: "green",
    event: "normal",
    local: "",
  };
  return s;
}
function change(s, kind) {
  applyChange(
    s,
    {
      kind,
      ready: true,
      stable: true,
      reason:
        "Required secure exposures and normal next-session recovery confirmed.",
    },
    monday,
  );
}
test("report 1: amber A snatch and B hang actually start a three-minute between-set timer", () => {
  for (const [day, id] of [
    ["monday", "snatch"],
    ["tuesday", "hang"],
  ]) {
    const c = { ...defaults(), entry: 3 };
    const prescription = rows(c, day, { level: "amber" }).find(
      (e) => e.id === id,
    );
    assert.equal(prescription.rest, 180);
    const s = profile();
    s.readiness.level = "amber";
    startSession(s, "monday", "main", monday);
    s.active.session.rows = [prescription];
    s.active.preparations = [prescription.key];
    s.active.warmup = true;
    logSet(s, { weight: 45, outcome: "make", grade: "A", effort: 5 }, monday);
    assert.equal(
      s.restEnd - monday,
      15000,
      "short reset stays between reps of the double",
    );
    logSet(
      s,
      { weight: 45, outcome: "make", grade: "A", effort: 5 },
      monday + 20000,
    );
    assert.equal(s.restEnd - (monday + 20000), 180000);
  }
});
test("report 2: first Foundation review earns 85–88; later Foundation can retain 85–90", () => {
  for (const id of ["snatch", "cj"]) {
    const s = profile();
    change(s, "heavy_" + id);
    assert.equal(s.training.heavy[id], 88);
    assert.deepEqual(
      rows(s.training, "friday")
        .find((e) => e.id === id)
        .sequence.at(-1),
      [85, 88],
    );
    // Storage retains an earned stage across phase/position changes. The effective
    // first-cycle Foundation cap still applies even to an older 90/95 stage.
    for (const stage of [90, 95]) {
      s.training.heavy[id] = stage;
      validate(s);
      assert.deepEqual(
        rows(s.training, "friday")
          .find((e) => e.id === id)
          .sequence.at(-1),
        [85, 88],
      );
    }
    s.training.cycle = 2;
    assert.deepEqual(
      rows(s.training, "friday")
        .find((e) => e.id === id)
        .sequence.at(-1),
      [85, 90],
    );
  }
});
test("report 3: earned Friday work uses source bands and keeps other attempts/caps intact", () => {
  for (const id of ["snatch", "cj"])
    for (const [week, gate, stage, expected] of [
      [5, "B", 92, [90, 92]],
      [9, "R", 92, [90, 92]],
      [9, "R", 95, [93, 95]],
      [5, "B", 95, [90, 92]],
      [5, "B", 88, [85, 88]],
    ]) {
      const c = { ...defaults(), entry: 3, week, gate };
      c.heavy[id] = stage;
      const row = rows(c, "friday").find((e) => e.id === id);
      assert.deepEqual(row.sequence.at(-1), expected);
      assert.equal(row.sets, 4);
      assert.equal(row.effort, 8);
      assert.equal(row.finalEffort, stage < 90 ? 8 : 9);
      assert.ok(row.sequence.slice(0, -1).every((r) => r[1] <= 90));
      assert.match(describe(row), new RegExp(expected.join("–")));
      assert.deepEqual(
        loadRange(row, { [id]: 200 }, 3, 2.5),
        expected.map((p) => Math.floor((200 * p) / 100 / 2.5) * 2.5),
      );
      const amber = rows(c, "friday", { level: "amber" }).find(
        (e) => e.id === id,
      );
      assert.equal(amber.finalEffort, null);
      assert.ok(amber.effort <= 7);
    }
});
test("report 4: cut/fly introduction resets effort atomically and preserves other dose components", () => {
  for (const [kind, initial, progressed] of [
    ["cut", 80, 90],
    ["fly", 90, 95],
  ]) {
    const s = profile();
    s.training.week = 5;
    s.training.gate = "B";
    s.training.athletics = {
      ...s.training.athletics,
      enabled: true,
      stage: 7,
      intensity: 95,
    };
    const before = structuredClone(s.training.athletics);
    change(s, kind);
    validate(s);
    assert.deepEqual(s.training.athletics, {
      ...before,
      variation: kind,
      intensity: initial,
    });
    const row = rows(s.training, "monday").find((e) => e.id === kind);
    assert.equal(row.effort, `${initial}%`);
    assert.equal(row.sets, 2);
    assert.throws(() => change(s, "variation_intensity"), /two complete/);
    const session = dayPlan(s.training, "monday").sessions.find(
      (x) => x.id === "athletics",
    );
    for (let i = 0; i < 2; i++)
      s.records.push({
        id: `ath-${i}`,
        weekId: `week-${i}`,
        day: "monday",
        date: "2026-09-14",
        startedAt: monday + i * 1000,
        endedAt: monday + i * 1000 + 1,
        session: structuredClone(session),
        omissions: [],
        context: { level: "green", event: "normal", recovery: "normal" },
        followup: { normal: true },
        sets: session.rows.flatMap((e) =>
          Array.from({ length: e.sets }, () => ({
            key: e.key,
            exerciseId: e.id,
            quality: "good",
            at: monday + i * 1000,
          })),
        ),
      });
    change(s, "variation_intensity");
    assert.equal(s.training.athletics.intensity, progressed);
  }
});
test("report 5: entry estimates include source numbers, stale-max/high-bar caveats and review thresholds", () => {
  const cases = [
    [
      failure("bench", 1, 3, 5, 270, { key: "bench_low" }),
      ["245–250", "285", "stale", "no preliminary max test", "Fewer than 3"],
    ],
    [
      failure("front_squat", 1, 4, 6, 270),
      ["260–265", "provisional", "Fewer than 4"],
    ],
    [
      failure("back_squat", 1, 4, 6, 270),
      [
        "320–325",
        "ONLY",
        "385",
        "same high-bar depth/setup",
        "unknown squat style",
        "Fewer than 4",
      ],
    ],
  ];
  for (const [e, phrases] of cases) {
    const suggestion = nextLoad(e, []);
    for (const phrase of phrases)
      assert.ok(suggestion.text.includes(phrase), phrase);
    assert.equal(
      suggestion.weight,
      undefined,
      "provisional estimates must not auto-fill an unsafe load",
    );
    assert.ok(
      !nextLoad(e, [
        {
          normal: true,
          sets: [{ weight: 100, reps: e.repRange[0], endpoint: "failure" }],
        },
      ]).text.includes("First exposure only"),
    );
  }
  assert.equal(
    startingEstimate(
      failure("front_squat", 1, 3, 5, 270, { key: "support_trial" }),
    ),
    null,
  );
  assert.equal(
    startingEstimate(failure("bench", 1, 6, 8, 210, { key: "bench_moderate" })),
    null,
  );
});
test("report 5: a first bench/squat undershoot records a review flag without creating extra work", () => {
  for (const e of [
    failure("bench", 1, 3, 5, 270, { key: "bench_low" }),
    failure("front_squat", 1, 4, 6, 270),
    failure("back_squat", 1, 4, 6, 270),
  ]) {
    const s = profile();
    startSession(s, "monday", "main", monday);
    s.active.session.rows = [e];
    s.active.warmup = true;
    s.active.preparations = [e.key];
    const result = logSet(
      s,
      { weight: 200, reps: e.repRange[0] - 1, endpoint: "failure" },
      monday,
    );
    assert.match(result.reviewFlag, /estimate needs review/);
    assert.match(result.reviewFlag, /no extra calibration set/);
    assert.equal(s.active.sets.length, 1);
    assert.equal(nextRow(s.active), undefined);
  }
});
