import test from "node:test";
import assert from "node:assert/strict";
import { loadStore, importData, validate, KEY } from "../src/storage.js";
import { fresh } from "../src/training.js";
import { dayPlan } from "../src/prescription.js";
import { estimateDay } from "../src/duration.js";
const old = () => ({
  revision: 6,
  ts: 100,
  records: [{ original: "untouched journal" }],
  activeWorkout: { original: "unfinished older session" },
  training: {
    cycle: 2,
    week: 6,
    onboarding: false,
    entryStage: 3,
    phaseGate: "B",
    split: true,
    anchors: { snatch: 165, cj: 215, clean: 225, jerk: 220 },
    increment: 2.5,
    cardio: { enabled: true, minutes: 150 },
    mobility: ["Bent-knee ankle wall stretch", "Front-rack wrist stretch"],
    mobilitySeconds: 45,
    mobilityDays: 4,
    athletics: {
      enabled: true,
      stage: 2,
      secondary: 0,
      day: "monday",
      variation: "cut",
      variationEffort: 80,
    },
    incline: "smith",
    lateral: "db",
    tricepsFallback: true,
    established: [
      {
        id: "old-trial",
        kind: "squat",
        day: "tuesday",
        squat: "front_squat",
        paused: false,
      },
    ],
    trial: { kind: "none" },
  },
});
const storage = (entries) => ({ getItem: (key) => entries[key] ?? null });
test("upgrading the published Revision 6 app preserves selected regimen and all original records", () => {
  const previous = old();
  const s = loadStore(storage({ oly_state: JSON.stringify(previous) })).state;
  assert.deepEqual(s.archives[0], previous);
  assert.equal(s.training.cycle, 2);
  assert.equal(s.training.week, 6);
  assert.equal(s.training.entry, 3);
  assert.equal(s.training.gate, "B");
  assert.equal(s.training.anchors.snatch, 165);
  assert.equal(s.training.split, true);
  assert.equal(s.training.equipment.incline, "smith");
  assert.equal(s.training.equipment.triceps, "pressdown");
  assert.equal(s.training.athletics.intensity, 80);
  assert.equal(s.training.trials[0].status, "retained");
  assert.equal(s.training.trials[0].exercise, "front_squat");
  assert.deepEqual(s.training.cardio, { enabled: true, minutes: 150 });
  for (const day of ["wednesday", "saturday", "sunday"]) {
    const p = dayPlan(s.training, day);
    assert.equal(p.sessions.find((x) => x.kind === "mobility").rows.length, 2);
    assert.ok(estimateDay(p, s.training).seconds[0] > 0);
  }
  assert.match(s.training.mobility[0], /^Ankle ·/);
  assert.equal(s.training.mobilitySeconds, 45);
  assert.equal(s.training.mobilityDays, 4);
  assert.deepEqual(s.reviews.at(-1).settingsToReview, []);
  assert.equal(
    s.active,
    null,
    "an older active prescription is archived intact, never silently rewritten",
  );
  assert.deepEqual(validate(s), s);
  assert.deepEqual(importData(previous).training, s.training);
});
test("the newest Revision 6 mirror wins; malformed settings cannot erase valid mobility or replace a new journal", () => {
  const older = old(),
    newer = old();
  newer.ts = 200;
  newer.training.mobility = ["Hip 90/90"];
  newer.training.anchors.snatch = -1;
  const entries = {
    oly_state: JSON.stringify(older),
    oly_rev6_backup: JSON.stringify(newer),
  };
  const s = loadStore(storage(entries)).state;
  assert.deepEqual(s.training.mobility, ["Hip rotation · supported 90/90"]);
  assert.deepEqual(s.reviews.at(-1).settingsToReview, ["anchors"]);
  assert.equal(s.archives.length, 2);
  const current = fresh("2026-09-14", "source");
  current.training.mobility = [
    "Front rack · supported wrist stretch or unloaded elbow lifts",
  ];
  entries[KEY] = JSON.stringify(current);
  assert.deepEqual(loadStore(storage(entries)).state, current);
});
