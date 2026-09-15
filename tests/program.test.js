import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import {
  defaults,
  dayPlan,
  DAYS,
  phaseFor,
  athleticDose,
  loadRange,
} from "../src/prescription.js";
const config = (week = 3) => ({
  ...defaults(),
  week,
  entry: 3,
  gate: "R",
  anchors: { snatch: 155, cj: 205, jerk: 200, clean: 220 },
});
const rows = (c, d, ctx = {}) =>
  dayPlan(c, d, ctx).sessions.flatMap((s) => (s.skipped ? [] : s.rows));
const count = (c) =>
  DAYS.flatMap((d) => rows(c, d))
    .filter((e) => e.kind === "failure")
    .reduce((n, e) => n + e.sets, 0);
const e = (c, d, id) => rows(c, d).find((e) => e.id === id);
test("bundled source is byte-identical to its provenance hash and has all 43 pages", () => {
  const meta = JSON.parse(fs.readFileSync("program/source.json")),
    pages = JSON.parse(fs.readFileSync("program/pages.json"));
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync("program/revision-6.pdf"))
      .digest("hex"),
    meta.sha256,
  );
  assert.equal(pages.length, 43);
  assert.match(pages[29].text, /2,064/);
  assert.match(pages[33].text, /ONE Friday calf set/);
});
test("p.7 independently transcribed phase rows match every normal day", () => {
  const expected = {
    F: {
      monday: [
        ["snatch", 6, 2, 65, 75, 7],
        ["cj", 3, "1+1", 60, 70, 7],
      ],
      tuesday: [
        ["cj", 6, "1+1", 65, 75, 7],
        ["hang", 3, 2, 55, 65, 7],
      ],
      thursday: [
        ["snatch", 6, 1, 70, 80, 7],
        ["jerk", 3, 2, 75, 85, 7],
        ["pull", 2, 3, 90, 100, 7],
      ],
      friday: [
        ["snatch", 4, 1, 75, 85, 8],
        ["cj", 4, "1+1", 75, 85, 8],
      ],
    },
    B: {
      monday: [
        ["snatch", 6, 2, 70, 80, 8],
        ["cj", 3, "1+1", 65, 75, 8],
      ],
      tuesday: [
        ["cj", 6, "1+1", 72, 82, 8],
        ["hang", 3, 2, 60, 70, 8],
      ],
      thursday: [
        ["snatch", 5, 1, 75, 85, 8],
        ["jerk", 4, 1, 85, 95, 8],
        ["pull", 2, 3, 95, 105, 7],
      ],
      friday: [
        ["snatch", 4, 1, 80, 90, 8],
        ["cj", 4, "1+1", 80, 90, 8],
      ],
    },
    R: {
      monday: [
        ["snatch", 5, 1, 78, 85, 8],
        ["cj", 3, "1+1", 70, 78, 8],
      ],
      tuesday: [
        ["cj", 5, "1+1", 78, 85, 8],
        ["hang", 3, 1, 65, 75, 8],
      ],
      thursday: [
        ["snatch", 4, 1, 75, 82, 8],
        ["jerk", 3, 1, 90, 100, 8],
      ],
      friday: [
        ["snatch", 4, 1, 80, 90, 8],
        ["cj", 4, "1+1", 80, 90, 8],
      ],
    },
  };
  for (const [p, days] of Object.entries(expected))
    for (const [d, expectedRows] of Object.entries(days)) {
      const c = config({ F: 3, B: 6, R: 9 }[p]);
      assert.deepEqual(
        rows(c, d)
          .filter((e) => e.kind === "quality")
          .map((e) => [e.id, e.sets, e.reps, ...e.range, e.effort]),
        expectedRows,
      );
    }
});
test("pp.13–15 order, per-row dose, rep ranges, rests and 9+13 split", () => {
  const expected = [
    ["incline", 3, 6, 10, 210],
    ["lateral", 4, 12, 20, 150],
    ["row", 2, 8, 12, 180],
    ["pulldown", 1, 8, 12, 180],
    ["shrug", 1, 10, 15, 150],
    ["rear_delt", 1, 12, 20, 150],
    ["curl", 1, 8, 12, 150],
    ["triceps", 1, 10, 15, 150],
    ["leg_curl", 2, 8, 12, 150],
    ["calf", 2, 10, 15, 150],
    ["leg_ext", 1, 10, 15, 150],
    ["crunch", 1, 10, 15, 150],
  ];
  for (const d of ["tuesday", "friday"]) {
    const c = config();
    assert.deepEqual(
      rows(c, d)
        .filter((e) => e.kind === "failure")
        .slice(2)
        .map((e) => [e.id, e.sets, ...e.repRange, e.rest]),
      expected,
    );
    c.split = true;
    assert.deepEqual(
      dayPlan(c, d).sessions.map((s) =>
        s.rows
          .filter((e) => e.kind === "failure")
          .reduce((n, e) => n + e.sets, 0),
      ),
      [9, 13],
    );
  }
});
test("p.5 first-entry ramp and p.30 independent annual totals", () => {
  let annual = 0,
    cycleTotals = [];
  for (let cycle = 1; cycle <= 4; cycle++) {
    let sum = 0;
    for (let week = 1; week <= 13; week++) {
      const c = {
        ...config(week),
        cycle,
        entry: cycle === 1 && week < 3 ? week : 3,
      };
      sum += count(c);
      const bench = DAYS.flatMap((d) =>
        rows(c, d)
          .filter((e) => e.id === "bench")
          .map((e) => [d, e.repRange]),
      );
      assert.deepEqual(
        bench,
        week === 12
          ? [
              ["monday", [3, 5]],
              ["saturday", [6, 8]],
            ]
          : [
              ["tuesday", [3, 5]],
              ["friday", [6, 8]],
            ],
      );
    }
    cycleTotals.push(sum);
    annual += sum;
  }
  assert.deepEqual(cycleTotals, [498, 522, 522, 522]);
  assert.equal(annual, 2064);
  const c = defaults();
  assert.equal(e(c, "monday", "snatch").sets, 4);
  assert.deepEqual(e(c, "monday", "snatch").range, [65, 65]);
  assert.equal(count(c), 28);
  c.entry = 2;
  assert.equal(count(c), 36);
});
test("pp.6,18,19 phase gates, checkpoints, week 11, taper and pivot", () => {
  let c = config(6);
  c.gate = "F";
  assert.equal(phaseFor(c).phase, "F");
  assert.equal(e(c, "tuesday", "front_squat").reps, "4–6");
  c = config(9);
  c.gate = "B";
  assert.equal(phaseFor(c).phase, "B");
  c = config(11);
  assert.equal(count(c), 36);
  assert.ok(
    rows(c, "friday")
      .filter((e) => e.kind === "failure")
      .every((e) => e.sets === 1),
  );
  c = config(12);
  assert.equal(count(c), 2);
  assert.equal(e(c, "friday", "snatch").sets, 3);
  assert.equal(e(c, "thursday", "snatch").rest, 120);
  assert.equal(e(c, "tuesday", "snatch").rest, 180);
  assert.equal(rows(c, "friday").length, 2);
  c = config(13);
  assert.deepEqual(
    rows(c, "thursday").map((e) => [
      e.id,
      e.sets,
      e.reps,
      e.range,
      e.effort,
      e.rest,
    ]),
    [
      ["snatch", 4, 1, [60, 70], 6, 120],
      ["cj", 3, "1+1", [60, 70], 6, 120],
    ],
  );
  assert.ok(rows(c, "tuesday").every((e) => e.kind === "failure"));
  assert.equal(count(c), 44);
});
test("pp.16,27 regressions, unassessed RJ and assessments replace work", () => {
  const c = config();
  c.anchors.jerk = null;
  assert.deepEqual(
    [
      e(c, "thursday", "jerk").sets,
      e(c, "thursday", "jerk").reps,
      e(c, "thursday", "jerk").range,
      e(c, "thursday", "jerk").anchor,
    ],
    [3, 2, [50, 70], "cj"],
  );
  c.technique.jerk = "dip";
  const j = e(c, "thursday", "pause_jerk");
  assert.deepEqual(
    [j.sets, j.reps, j.range, j.anchor, j.effort, j.rest],
    [3, 2, [40, 60], "cj", 6, 90],
  );
  c.technique.jerk = "none";
  c.assessment = "jerk";
  assert.equal(e(c, "thursday", "jerk").sets, 5);
  assert.equal(e(c, "thursday", "jerk").effort, 8);
  c.assessment = "clean";
  assert.deepEqual(
    rows(c, "tuesday")
      .slice(0, 3)
      .map((e) => [e.id, e.sets]),
    [
      ["cj", 3],
      ["clean", 3],
      ["hang", 3],
    ],
  );
  c.assessment = "none";
  c.technique.snatch = "receive";
  assert.equal(e(c, "monday", "snatch").effort, 4);
  assert.equal(e(c, "monday", "snatch").rest, 90);
  c.technique.snatch = "balance";
  assert.equal(rows(c, "monday")[0].sets, 2);
  assert.equal(rows(c, "monday")[0].reps, 1);
});
test("pp.17–18 stricter rules never restore phase-omitted work", () => {
  let checked = 0;
  for (let week = 1; week <= 13; week++)
    for (const entry of [1, 2, 3])
      for (const day of DAYS)
        for (const recovery of ["normal", "targeted", "reset", "restore"])
          for (const level of ["green", "amber", "red"])
            for (const event of [
              "normal",
              "verification",
              "unsafe",
              "game",
              "larger_later",
              "game_later",
            ]) {
              const c = { ...config(week), entry, recovery };
              const p = dayPlan(c, day, { level, event });
              checked++;
              for (const s of p.sessions) {
                assert.equal(
                  new Set(s.rows.map((e) => e.key)).size,
                  s.rows.length,
                );
                if (s.skipped) continue;
                for (const e of s.rows) {
                  assert.ok(
                    e.minutes > 0 || (Number.isInteger(e.sets) && e.sets > 0),
                  );
                  if (level === "amber") assert.notEqual(e.kind, "failure");
                  if (level === "red" || event === "unsafe" || event === "game")
                    assert.fail("Unsafe session still active");
                  if (week === 12)
                    assert.ok(e.kind === "quality" || e.id === "bench");
                }
              }
            }
  assert.equal(checked, 19656);
});
test("pp.21,29 exact athletic progression and taper retention", () => {
  const expected = [
    [2, 3, 10, "85–90%"],
    [3, 3, 10, "85–90%"],
    [3, 3, 15, "85–90%"],
    [3, 3, 15, "90–95%"],
    [4, 3, 15, "90–95%"],
    [4, 3, 20, "90–95%"],
    [5, 3, 20, "90–95%"],
    [5, 4, 20, "90–95%"],
  ];
  for (let i = 0; i < 8; i++) {
    const d = athleticDose(i);
    assert.deepEqual([d.jumps, d.runs, d.meters, d.effort], expected[i]);
  }
  const c = config(11);
  c.athletics = { ...c.athletics, enabled: true, stage: 7, secondary: 2 };
  assert.deepEqual(
    dayPlan(c, "monday")
      .sessions.find((s) => s.kind === "athletic")
      .rows.map((e) => e.sets),
    [3, 2],
  );
  assert.ok(
    !dayPlan(c, "thursday").sessions.some((s) => s.kind === "athletic"),
  );
  c.week = 12;
  assert.ok(!dayPlan(c, "monday").sessions.some((s) => s.kind === "athletic"));
  c.week = 13;
  assert.equal(
    dayPlan(c, "monday").sessions.find((s) => s.kind === "athletic").rows[0]
      .sets,
    5,
  );
});
test("p.22 aerobic allocation sums actual minutes; all days after priority work; no taper work", () => {
  for (const minutes of [40, 45, 50, 55, 60, 70, 150, 160, 300]) {
    const c = config();
    c.cardio = { enabled: true, minutes };
    assert.equal(
      DAYS.flatMap((d) => rows(c, d))
        .filter((e) => e.id === "aerobic")
        .reduce((n, e) => n + e.minutes, 0),
      minutes,
    );
    c.week = 12;
    assert.ok(DAYS.flatMap((d) => rows(c, d)).every((e) => e.id !== "aerobic"));
  }
});
test("pp.28,31–34 heavy attempts replace, support substitutes, week 11 and paused trials", () => {
  const c = config(9);
  c.heavy = { snatch: 95, cj: 92, extraSnatch: 3, extraCj: 2 };
  const a = e(c, "monday", "snatch");
  assert.equal(a.repSequence.at(-1), 1);
  assert.equal(a.sequence.at(-1)[1], 92);
  assert.equal(e(c, "friday", "snatch").sequence.at(-1)[1], 95);
  c.week = 3;
  c.trials = [
    { id: "press1", kind: "press", day: "friday" },
    { id: "calf1", kind: "calf_partial", day: "friday" },
  ];
  assert.equal(count(c), 44);
  assert.equal(e(c, "friday", "incline").sets, 2);
  assert.equal(rows(c, "friday").filter((e) => e.id === "calf").length, 2);
  c.week = 11;
  assert.ok(!e(c, "friday", "incline"));
  assert.equal(e(c, "friday", "press").sets, 1);
  assert.equal(rows(c, "friday").filter((e) => e.id === "calf").length, 1);
  c.week = 13;
  assert.ok(!e(c, "friday", "press"));
  assert.equal(e(c, "friday", "incline").sets, 3);
});
test("p.5 rounding and independent anchors", () => {
  const c = config(),
    sn = e(c, "friday", "snatch");
  assert.deepEqual(loadRange(sn, c.anchors, 0, 5), [115, 130]);
  c.anchors.cj = 100;
  assert.deepEqual(loadRange(sn, c.anchors, 0, 5), [115, 130]);
});
