import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  scheduledDate,
  startSession,
  stopSession,
  omissionRecord,
  deferDay,
  advanceWeek,
  planFor,
  localDate,
  addDays,
  benchWindow,
  nextRow,
  logSet,
  finishSession,
  consumedBench,
} from "../src/training.js";
import { dayPlan, DAYS } from "../src/prescription.js";
import { programDays, scheduleTrialPending } from "../src/calendar.js";
import { validate, importData } from "../src/storage.js";
import { applyChange } from "../src/review.js";
import { fixedDay } from "../src/timeline.js";
import {
  buildPlannerFeed,
  journalEntities,
  adoptJournalEntities,
} from "../src/planner-feed.js";

const base = () => {
  const s = fresh("2026-09-14");
  Object.assign(s.training, { entry: 3, week: 3, gate: "R" });
  return s;
};
const ready = (s, date) => {
  s.readiness = { date, level: "green", event: "normal", local: "" };
  return Date.parse(date + "T15:00:00-05:00");
};
const resolve = (s, day, date = scheduledDate(s, day)) => {
  const now = ready(s, date);
  startSession(s, day, "main", now);
  stopSession(s, "Synthetic calendar test", now + 1000);
};
const review = {
  action: "advance",
  green: true,
  recovery: "normal",
  buildReady: true,
  realizationReady: true,
  notes: "Comparable quality reviewed",
  scheduleQuality: true,
};

test("new journals show B/C/rest/A/D/rest/rest and preserve single-visit timing preferences", () => {
  const s = fresh("2026-09-14");
  assert.deepEqual(programDays(s.training), [
    "tuesday",
    "thursday",
    "wednesday",
    "monday",
    "friday",
    "saturday",
    "sunday",
  ]);
  assert.deepEqual(
    programDays(s.training).map((d) => scheduledDate(s, d)),
    DAYS.map((_, i) => addDays("2026-09-14", i)),
  );
  assert.equal(s.training.split, false);
  assert.equal(s.training.timing.athleticsVisit, "same");
  assert.equal(s.training.athletics.enabled, false);
  assert.deepEqual(validate(s), s);
});

test("all 52 weeks preserve the source lifting rows, loads and rest under the new ordinary order", () => {
  for (let cycle = 1; cycle <= 4; cycle++)
    for (let week = 1; week <= 13; week++) {
      const s = base();
      Object.assign(s.training, { cycle, week });
      const source = { ...s.training, schedule: "source" };
      for (const day of DAYS) {
        const a = dayPlan(s.training, day).sessions.filter(
          (x) => x.kind === "lifting",
        );
        const b = dayPlan(source, day).sessions.filter(
          (x) => x.kind === "lifting",
        );
        assert.deepEqual(a, b, `cycle ${cycle} week ${week} ${day}`);
        const p = dayPlan(s.training, day),
          timing = fixedDay(p, s.training);
        assert(Number.isFinite(timing.seconds[0]));
      }
      assert.deepEqual(
        programDays(s.training),
        week === 12 ? DAYS : programDays(base().training),
      );
      assert.equal(scheduledDate(s, "friday"), "2026-09-18");
    }
});

test("runner starts B first, enforces C before A, rolls late sessions and preserves snapshots", () => {
  const s = base(),
    now = ready(s, "2026-09-14");
  assert.throws(
    () => startSession(s, "monday", "main", now),
    /scheduled later/,
  );
  assert.throws(
    () => startSession(s, "thursday", "main", ready(s, "2026-09-15")),
    /Resolve B/,
  );
  resolve(s, "tuesday");
  const before = structuredClone(s.records[0]);
  assert.throws(
    () => startSession(s, "monday", "main", ready(s, "2026-09-17")),
    /Resolve C/,
  );
  resolve(s, "thursday", "2026-09-16");
  assert.equal(scheduledDate(s, "monday"), "2026-09-18");
  assert.equal(scheduledDate(s, "friday"), "2026-09-19");
  assert.deepEqual(s.records[0], before);
  resolve(s, "monday");
  resolve(s, "friday");
  advanceWeek(s, review);
  assert.equal(s.weekStart, "2026-09-22");
  assert.equal(scheduledDate(s, "tuesday"), "2026-09-22");
  assert.equal(scheduledDate(s, "thursday"), "2026-09-23");
  assert.equal(scheduledDate(s, "monday"), "2026-09-25");
});

test("week 11 to taper to pivot preserves Friday testing, Saturday bench and real bench spacing", () => {
  const s = base();
  s.training.week = 11;
  for (const day of programDays(s.training))
    if (dayPlan(s.training, day).sessions.some((x) => x.id === "main"))
      resolve(s, day);
  advanceWeek(s, review);
  assert.equal(s.training.week, 12);
  assert.deepEqual(programDays(s.training), DAYS);
  assert.equal(scheduledDate(s, "monday"), "2026-09-21");
  assert.deepEqual(
    dayPlan(s.training, "monday")
      .sessions[0].rows.filter((e) => e.id === "bench")
      .map((e) => e.key),
    ["bench_low"],
  );
  assert.equal(scheduledDate(s, "friday"), "2026-09-25");
  assert.equal(scheduledDate(s, "saturday"), "2026-09-26");
  assert.equal(
    dayPlan(s.training, "thursday").sessions[0].rows.some(
      (e) => e.id === "bench",
    ),
    false,
  );
  assert.throws(
    () => startSession(s, "saturday", "main", ready(s, "2026-09-26")),
    /Resolve|test/,
  );
  for (const day of ["monday", "tuesday", "thursday", "friday", "saturday"])
    omissionRecord(
      s,
      day,
      "main",
      "Calendar fixture",
      ready(s, scheduledDate(s, day)),
    );
  const saturday = s.records.at(-1);
  saturday.sets.push({
    key: "bench_moderate",
    exerciseId: "bench",
    at: Date.parse("2026-09-26T17:00:00-05:00"),
  });
  advanceWeek(s, review);
  assert.equal(s.training.week, 13);
  assert.equal(scheduledDate(s, "tuesday"), "2026-09-28");
  assert.equal(
    benchWindow(s, Date.parse("2026-09-28T16:00:00-05:00")).ready,
    false,
  );
  assert.equal(
    benchWindow(s, Date.parse("2026-09-28T17:00:00-05:00")).ready,
    true,
  );
  assert.equal(
    buildPlannerFeed(s).entries.find((e) => e.day === "tuesday").notBefore,
    Date.parse("2026-09-28T17:00:00-05:00"),
  );
  assert(
    dayPlan(s.training, "tuesday").sessions[0].rows.every(
      (e) => e.kind === "failure",
    ),
  );
  assert(
    dayPlan(s.training, "thursday").sessions[0].rows.every(
      (e) => e.kind === "quality",
    ),
  );
});

test("athletics follows Tuesday C, secondary Thursday A, halves in week 11 and is absent in taper", () => {
  const s = base(),
    t = s.training;
  Object.assign(t.athletics, { enabled: true, stage: 7, secondary: 2 });
  const sessions = (d) =>
    dayPlan(t, d).sessions.filter((x) => x.kind === "athletic");
  assert.equal(sessions("thursday")[0].id, "athletics");
  assert.equal(sessions("monday")[0].id, "athletics-secondary");
  t.week = 11;
  assert.equal(sessions("monday").length, 0);
  assert.equal(sessions("thursday")[0].rows[0].sets, 3);
  assert.equal(sessions("thursday")[0].rows[1].sets, 2);
  t.week = 12;
  assert(DAYS.every((d) => sessions(d).length === 0));
  t.week = 13;
  assert.equal(sessions("thursday")[0].rows[0].sets, 5);
});

test("recovery-only days remain runnable and fourth mobility follows A without changing weekly dose", () => {
  const s = base(),
    t = s.training;
  t.mobility = ["Ankle · bent-knee calf stretch, heel down"];
  t.cardio = { enabled: true, minutes: 150 };
  t.mobilityDays = 4;
  let minutes = 0;
  for (const day of DAYS) {
    const p = dayPlan(t, day);
    minutes += p.sessions
      .flatMap((x) => x.rows)
      .filter((e) => e.kind === "aerobic")
      .reduce((n, e) => n + e.minutes, 0);
    if (["wednesday", "saturday", "sunday"].includes(day)) {
      assert(p.sessions.some((x) => x.kind === "mobility"));
      assert(fixedDay(p, t).seconds[0] > 0);
    }
  }
  assert.equal(minutes, 150);
  assert.equal(scheduledDate(s, "monday"), "2026-09-17");
  assert(dayPlan(t, "monday").sessions.some((x) => x.kind === "mobility"));
  t.cardio.enabled = false;
  startSession(s, "wednesday", "mobility", ready(s, "2026-09-16"));
  assert.equal(s.active.session.kind, "mobility");
  assert(s.active.pacing);
});

test("legacy empty weeks adopt immediately; active/completed/moved weeks retain their saved order until review", () => {
  const old = fresh("2026-09-14", "source");
  delete old.training.schedule;
  const migrated = importData(old);
  assert.equal(migrated.training.schedule, "weekday");
  assert.deepEqual(importData(migrated), migrated);
  const active = fresh("2026-09-14", "source");
  startSession(active, "monday", "main", ready(active, "2026-09-14"));
  delete active.training.schedule;
  const frozen = structuredClone(active.active),
    restored = validate(active);
  assert.equal(restored.training.schedule, "source");
  assert.equal(restored.training.nextSchedule, "weekday");
  assert.deepEqual(restored.active, frozen);
  stopSession(restored, "Fixture", Date.parse("2026-09-14T15:01:00-05:00"));
  advanceWeek(restored, { ...review, action: "hold" });
  assert.equal(restored.training.schedule, "weekday");
  assert.equal(restored.records[0].day, "monday");
  assert.equal(restored.records[0].date, "2026-09-14");
  assert.equal(restored.training.nextSchedule, undefined);
  const moved = fresh("2026-09-14", "source");
  deferDay(moved, "monday", "2026-09-15");
  delete moved.training.schedule;
  assert.deepEqual(validate(moved).dates, moved.dates);
  assert.equal(validate(moved).training.nextSchedule, "weekday");
});

test("schedule trial blocks new doses, requires two complete full-dose reviewed weeks, and cannot count repeated reviews", () => {
  const s = base();
  const change = {
    kind: "set",
    exercise: "shrug",
    day: "friday",
    stable: true,
    ready: true,
    reason: "Review",
  };
  assert.throws(() => applyChange(s, change), /two complete green weeks/);
  advanceWeek(s, { ...review, action: "hold" });
  assert.deepEqual(s.training.scheduleTrial.weeks, []);
  for (let i = 0; i < 2; i++) {
    for (const day of ["tuesday", "thursday", "monday", "friday"]) {
      omissionRecord(
        s,
        day,
        "main",
        "Synthetic completed-session fixture",
        ready(s, scheduledDate(s, day)),
      );
      s.records.at(-1).status = "complete";
    }
    advanceWeek(s, review);
    assert.equal(s.training.scheduleTrial.weeks.length, i + 1);
  }
  assert.equal(scheduleTrialPending(s.training), false);
  applyChange(s, change);
  assert.equal(s.training.trials.length, 1);
});

test("an interrupted or changed workload restarts the schedule observation window; rejected reviews preserve it", () => {
  const s = base();
  const completeWeek = () => {
    for (const day of ["tuesday", "thursday", "monday", "friday"]) {
      omissionRecord(
        s,
        day,
        "main",
        "Synthetic completed-session fixture",
        ready(s, scheduledDate(s, day)),
      );
      s.records.at(-1).status = "complete";
    }
  };
  completeWeek();
  advanceWeek(s, review);
  assert.equal(s.training.scheduleTrial.weeks.length, 1);
  const before = structuredClone(s);
  assert.throws(() => advanceWeek(s, review), /Resolve B/);
  assert.deepEqual(s, before);
  completeWeek();
  advanceWeek(s, { ...review, green: false, action: "hold" });
  assert.equal(s.training.scheduleTrial.weeks.length, 0);
  completeWeek();
  advanceWeek(s, review);
  assert.equal(s.training.scheduleTrial.weeks.length, 1);
  // Week 4 to week 5 changes the actual workload phase.
  completeWeek();
  advanceWeek(s, review);
  assert.equal(s.training.scheduleTrial.weeks.length, 1);
  completeWeek();
  advanceWeek(s, review);
  assert.equal(scheduleTrialPending(s.training), false);
});

test("Planner and cloud round trips retain chronology and include test-week Saturday bench", () => {
  const s = base();
  const before = structuredClone(s),
    feed = buildPlannerFeed(s);
  assert.deepEqual(
    feed.entries.map((e) => e.label),
    ["Workout B", "Workout C", "Workout A", "Workout D"],
  );
  assert.deepEqual(
    feed.entries.map((e) => e.date),
    ["2026-09-14", "2026-09-15", "2026-09-17", "2026-09-18"],
  );
  assert.deepEqual(feed.repeatDays, programDays(s.training));
  assert.deepEqual(s, before);
  assert.deepEqual(
    validate(adoptJournalEntities(s, journalEntities(s))).training,
    s.training,
  );
  s.training.week = 12;
  const taper = buildPlannerFeed(s);
  assert.equal(taper.entries.length, 5);
  assert.equal(taper.entries.at(-1).label, "Moderate bench");
  assert.equal(taper.entries.at(-1).date, "2026-09-19");
  assert.equal(taper.repeatStart, "2026-09-21");
});

test("52-week weekday execution completes every prescribed lift and both bench exposures without duplicate or compressed sessions", () => {
  const s = fresh("2026-09-14");
  let sessions = 0;
  for (let year = 1; year <= 52; year++) {
    assert.equal((s.training.cycle - 1) * 13 + s.training.week, year);
    for (const day of programDays(s.training)) {
      if (!dayPlan(s.training, day).sessions.some((x) => x.id === "main"))
        continue;
      let now = ready(s, scheduledDate(s, day));
      if (
        dayPlan(s.training, day).sessions.some((se) =>
          se.rows.some((e) => e.id === "bench"),
        )
      )
        now = Math.max(now, benchWindow(s, now).eligibleAt);
      s.readiness.date = localDate(new Date(now));
      startSession(s, day, "main", now);
      s.active.warmup = true;
      while (nextRow(s.active)) {
        const e = nextRow(s.active);
        s.active.preparations.push(e.key);
        now += 300000;
        logSet(
          s,
          e.kind === "quality"
            ? { weight: 45, outcome: "make", grade: "A", effort: 5 }
            : { weight: 100, reps: e.repRange[0], endpoint: "failure" },
          now,
        );
      }
      finishSession(s, "Synthetic full-year calendar audit", now + 1000);
      s.records.at(-1).followup = { normal: true };
      sessions++;
      validate(s);
    }
    assert(consumedBench(s, "bench_low"));
    assert(consumedBench(s, "bench_moderate"));
    advanceWeek(s, review);
  }
  assert(s.completed);
  assert.equal(sessions, 212);
  assert.equal(scheduleTrialPending(s.training), false);
});
