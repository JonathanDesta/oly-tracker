import { fresh, SCHEMA } from "./training.js";
import { defaults, DAYS } from "./prescription.js";
import { EXERCISES } from "./catalog.js";
import { TIME_DEFAULTS, validTimeProfile } from "./duration.js";
import { validPacing } from "./pacing.js";
import { validMobilityTrace, preparationElapsed } from "./routines.js";
export const KEY = "oly_program_v7",
  BACKUP = "oly_program_v7_backup";
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
const finite = (x, min, max) => Number.isFinite(x) && x >= min && x <= max;
const athleticSnapshot = (a) =>
  object(a) &&
  typeof a.enabled === "boolean" &&
  Number.isInteger(a.stage) &&
  finite(a.stage, 0, 50) &&
  [0, 1, 2].includes(a.secondary) &&
  ["monday", "thursday"].includes(a.day) &&
  ["none", "fly", "cut"].includes(a.variation) &&
  finite(a.intensity, 75, 95) &&
  ["secondaryJumps", "secondaryRuns"].every(
    (k) => Number.isInteger(a[k]) && finite(a[k], 2, 50),
  );
function assert(ok, msg) {
  if (!ok) throw Error("Invalid backup: " + msg);
}
export function validate(data) {
  assert(object(data) && data.schema === SCHEMA, "unrecognized format.");
  if (data.calibration !== undefined) {
    assert(
      object(data.calibration) &&
        Array.isArray(data.calibration.excludedRecordIds) &&
        data.calibration.excludedRecordIds.every(
          (x) => typeof x === "string",
        ) &&
        Array.isArray(data.calibration.observations) &&
        data.calibration.observations.every(
          (o) =>
            object(o) &&
            typeof o.id === "string" &&
            typeof o.signature === "string" &&
            finite(o.seconds, 1, 36000) &&
            typeof o.includesChange === "boolean" &&
            typeof o.source === "string",
        ),
      "scheduling calibration.",
    );
  }
  const s = structuredClone(data),
    t = s.training,
    b = defaults();
  assert(object(t), "missing training configuration.");
  assert(
    t.timing === undefined || validTimeProfile(t.timing),
    "time planning settings.",
  );
  for (const k of [
    "split",
    "omitPull",
    "reduceA",
    "reduceJerk",
    "lowerDose",
    "omitLastLower",
  ])
    assert(
      t[k] === undefined || typeof t[k] === "boolean",
      "boolean dose setting.",
    );
  assert(
    Number.isInteger(t.week) &&
      finite(t.week, 1, 13) &&
      Number.isInteger(t.cycle) &&
      finite(t.cycle, 1, 4),
    "program position.",
  );
  assert(
    [1, 2, 3].includes(t.entry) &&
      ["F", "B", "R"].includes(t.gate) &&
      ["normal", "targeted", "reset", "restore"].includes(t.recovery),
    "phase configuration.",
  );
  assert(
    object(t.anchors) &&
      ["snatch", "cj"].every((k) => finite(t.anchors[k], 1, 2000)) &&
      ["clean", "jerk"].every(
        (k) => t.anchors[k] === null || finite(t.anchors[k], 1, 2000),
      ),
    "lift anchors.",
  );
  assert([2.5, 5].includes(t.increment), "plate increment.");
  assert(
    object(t.heavy) &&
      ["snatch", "cj"].every((k) => [0, 88, 90, 92, 95].includes(t.heavy[k])) &&
      ["extraSnatch", "extraCj"].every(
        (k) => Number.isInteger(t.heavy[k]) && finite(t.heavy[k], 0, 20),
      ),
    "heavy practice.",
  );
  assert(
    object(t.technique) &&
      ["snatch", "clean", "jerk"].every((k) =>
        [
          "none",
          "receive",
          "return",
          "turnover",
          "balance",
          "stance",
          "dip",
        ].includes(t.technique[k]),
      ),
    "technique.",
  );
  assert(
    Array.isArray(t.trials) &&
      t.trials.every(
        (x) =>
          object(x) &&
          typeof x.id === "string" &&
          ["set", "squat", "press", "pause_jerk", "calf_partial"].includes(
            x.kind,
          ) &&
          ["tuesday", "thursday", "friday"].includes(x.day) &&
          Array.isArray(x.reviews),
      ),
    "trials.",
  );
  assert(
    new Set(t.trials.map((x) => x.id)).size === t.trials.length,
    "duplicate trial identities.",
  );
  for (const x of t.trials) {
    assert(
      x.paused === undefined || typeof x.paused === "boolean",
      "trial pause.",
    );
    assert(
      x.status === undefined ||
        ["testing", "retained", "removed"].includes(x.status),
      "trial status.",
    );
    assert(x.load === undefined || finite(x.load, 1, 2000), "trial load.");
    if (x.kind === "set")
      assert(
        [
          "incline",
          "lateral",
          "row",
          "pulldown",
          "shrug",
          "rear_delt",
          "curl",
          "triceps",
          "leg_curl",
          "calf",
          "leg_ext",
          "crunch",
        ].includes(x.exercise) && ["tuesday", "friday"].includes(x.day),
        "added-set exercise/day.",
      );
    if (x.kind === "squat")
      assert(
        ["front_squat", "back_squat"].includes(x.exercise) &&
          ["tuesday", "friday"].includes(x.day),
        "support squat exercise/day.",
      );
    if (["press", "calf_partial", "pause_jerk"].includes(x.kind)) {
      assert(
        x.day === (x.kind === "pause_jerk" ? "thursday" : "friday"),
        "substitution day.",
      );
      assert(
        x.paused ||
          t.trials.filter((y) => !y.paused && y.kind === x.kind).length === 1,
        "duplicate active substitution.",
      );
    }
    assert(x.reviews.every(object), "trial review.");
  }
  assert(
    object(t.athletics) &&
      Number.isInteger(t.athletics.stage) &&
      finite(t.athletics.stage, 0, 50) &&
      [0, 1, 2].includes(t.athletics.secondary) &&
      ["monday", "thursday"].includes(t.athletics.day) &&
      ["none", "fly", "cut"].includes(t.athletics.variation),
    "athletics.",
  );
  assert(
    typeof t.athletics.enabled === "boolean" &&
      finite(t.athletics.intensity, 75, 95) &&
      (t.athletics.variation !== "fly" ||
        [90, 95].includes(t.athletics.intensity)) &&
      (t.athletics.variation !== "cut" || t.athletics.intensity <= 90),
    "athletic effort.",
  );
  assert(
    Number.isInteger(t.athletics.secondaryJumps) &&
      finite(t.athletics.secondaryJumps, 2, 50) &&
      Number.isInteger(t.athletics.secondaryRuns) &&
      finite(t.athletics.secondaryRuns, 2, 50),
    "secondary athletics.",
  );
  assert(
    object(t.cardio) &&
      typeof t.cardio.enabled === "boolean" &&
      finite(t.cardio.minutes, 40, 300),
    "aerobic dose.",
  );
  assert(
    Array.isArray(t.mobility) &&
      t.mobility.length <= 2 &&
      t.mobility.every((x) => typeof x === "string" && x.length < 300) &&
      [30, 45].includes(t.mobilitySeconds) &&
      [3, 4].includes(t.mobilityDays),
    "mobility.",
  );
  assert(
    object(t.equipment) &&
      object(t.setup) &&
      ["none", "clean", "jerk"].includes(t.assessment) &&
      (t.rackLoad === null || finite(t.rackLoad, 1, 2000)),
    "exercise configuration.",
  );
  const equipment = {
    incline: ["", "smith", "db"],
    lateral: ["", "db"],
    row: ["", "machine"],
    leg_curl: ["", "lying"],
    calf: ["", "press", "seated"],
    leg_ext: ["", "upright"],
    crunch: ["", "cable"],
    triceps: ["", "pressdown"],
  };
  assert(
    Object.entries(t.equipment).every(([k, v]) => equipment[k]?.includes(v)),
    "equipment option.",
  );
  assert(
    Object.entries(t.setup).every(
      ([k, v]) => EXERCISES[k] && Number.isInteger(v) && v >= 0,
    ),
    "setup identity.",
  );
  const validDate = (x) =>
    typeof x === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(x) &&
    !Number.isNaN(Date.parse(x)) &&
    new Date(x).toISOString().slice(0, 10) === x;
  assert(
    validDate(s.weekStart) &&
      object(s.dates) &&
      Object.entries(s.dates).every(
        ([k, v]) => DAYS.includes(k) && validDate(v),
      ),
    "schedule.",
  );
  for (const k of [
    "records",
    "reviews",
    "events",
    "archives",
    "benchReservations",
  ])
    assert(Array.isArray(s[k]), k);
  assert(
    s.reviews.every(
      (r) =>
        object(r) &&
        finite(r.at, 0, 1e15) &&
        (r.previousLoad === undefined ||
          r.previousLoad === null ||
          finite(r.previousLoad, 1, 2000)) &&
        (r.type !== "change" ||
          (object(r.change) && typeof r.change.kind === "string")) &&
        (!r.afterAthletics ||
          (athleticSnapshot(r.afterAthletics) &&
            athleticSnapshot(r.beforeAthletics))) &&
        (!r.training ||
          (object(r.training) &&
            Array.isArray(r.training.trials) &&
            r.training.trials.every(
              (x) => object(x) && typeof x.id === "string",
            ) &&
            object(r.training.cardio) &&
            object(r.training.heavy))),
    ),
    "review history.",
  );
  assert(
    s.events.every((r) => object(r) && finite(r.at, 0, 1e15)),
    "event history.",
  );
  assert(
    s.benchReservations.every(
      (r) =>
        object(r) &&
        typeof r.weekId === "string" &&
        ["bench_low", "bench_moderate"].includes(r.slot) &&
        (r.sessionId === undefined || typeof r.sessionId === "string"),
    ),
    "bench reservations.",
  );
  const context = (r) =>
    assert(
      object(r) &&
        ["green", "amber", "red", "unchecked"].includes(r.level) &&
        [
          "normal",
          "limited_later",
          "limited_return",
          "larger_later",
          "verification",
          "unsafe",
          "game",
          "game_defer",
          "game_later",
        ].includes(r.event) &&
        (!r.local || ["upper", "lower"].includes(r.local)) &&
        (!r.sport ||
          ["normal", "game", "game_defer", "game_later"].includes(r.sport)),
      "readiness context.",
    );
  if (s.readiness) {
    context(s.readiness);
    assert(validDate(s.readiness.date), "readiness date.");
  }
  function record(r, active = false) {
    assert(
      object(r) &&
        typeof r.id === "string" &&
        typeof r.weekId === "string" &&
        DAYS.includes(r.day) &&
        object(r.session) &&
        typeof r.session.id === "string" &&
        typeof r.session.title === "string" &&
        ["lifting", "athletic", "cardio", "mobility"].includes(
          r.session.kind,
        ) &&
        Array.isArray(r.session.rows) &&
        Array.isArray(r.sets) &&
        Array.isArray(r.omissions),
      "session.",
    );
    if (r.pacing !== undefined)
      assert(validPacing(r.pacing), "session pacing timer.");
    if (r.context) context(r.context);
    if (r.timeConfig !== undefined) {
      const c = r.timeConfig;
      assert(
        object(c) &&
          validTimeProfile(c.timing) &&
          object(c.equipment) &&
          object(c.anchors) &&
          ["snatch", "cj"].every((k) => finite(c.anchors[k], 1, 2000)) &&
          ["clean", "jerk"].every(
            (k) => c.anchors[k] === null || finite(c.anchors[k], 1, 2000),
          ) &&
          [2.5, 5].includes(c.increment) &&
          typeof c.continuation === "boolean",
        "session time planning snapshot.",
      );
    }
    assert(
      r.session.rows.every(
        (e) =>
          object(e) &&
          Object.hasOwn(EXERCISES, e.id) &&
          typeof e.key === "string" &&
          typeof e.name === "string" &&
          ["quality", "failure", "speed", "aerobic", "mobility"].includes(
            e.kind,
          ) &&
          (e.kind === "aerobic"
            ? finite(e.minutes, 1, 300)
            : Number.isInteger(e.sets) && finite(e.sets, 1, 100)) &&
          (e.kind !== "failure" ||
            (Array.isArray(e.repRange) && e.repRange.length === 2)),
      ),
      "session prescription.",
    );
    const keys = new Set(r.session.rows.map((e) => e.key));
    const aerobicTimer = (t) =>
      object(t) &&
      r.session.rows.some((e) => e.key === t.key && e.kind === "aerobic") &&
      finite(t.startedAt, 0, 1e15) &&
      (t.pausedAt === null || finite(t.pausedAt, t.startedAt, 1e15)) &&
      finite(
        t.pausedMs,
        0,
        t.pausedAt === null ? 1e15 : t.pausedAt - t.startedAt,
      );
    if (r.aerobicRun) assert(aerobicTimer(r.aerobicRun), "aerobic timer.");
    if (r.aerobicPartials !== undefined)
      assert(
        Array.isArray(r.aerobicPartials) &&
          r.aerobicPartials.every(
            (t) =>
              aerobicTimer(t) &&
              finite(t.stoppedAt, t.pausedAt ?? t.startedAt, 1e15) &&
              typeof t.reason === "string" &&
              finite(t.movingSeconds, 0, 1e15) &&
              t.movingSeconds === preparationElapsed(t, t.stoppedAt),
          ),
        "partial aerobic timer.",
      );
    if (r.preparationTimer) {
      const t = r.preparationTimer;
      assert(
        object(t) &&
          (["general", "rewarm"].includes(t.key) || keys.has(t.key)) &&
          finite(t.startedAt, 0, 1e15) &&
          (t.pausedAt === null || finite(t.pausedAt, t.startedAt, 1e15)) &&
          finite(t.pausedMs, 0, 1e15),
        "preparation timer.",
      );
    }
    if (r.preparationLog !== undefined)
      assert(
        Array.isArray(r.preparationLog) &&
          r.preparationLog.every(
            (x) =>
              object(x) &&
              typeof x.name === "string" &&
              (["general", "rewarm"].includes(x.key) || keys.has(x.key)) &&
              ["timed", "confirmed", "interrupted"].includes(x.method) &&
              (x.startedAt === null || finite(x.startedAt, 0, 1e15)) &&
              finite(x.endedAt, x.startedAt || 0, 1e15) &&
              (x.seconds === null || finite(x.seconds, 0, 1e15)),
          ),
        "preparation log.",
      );
    if (r.mobilityRun) {
      const m = r.mobilityRun;
      assert(
        object(m) &&
          r.session.rows.some(
            (e) => e.key === m.key && e.kind === "mobility",
          ) &&
          Number.isInteger(m.index) &&
          finite(m.index, 0, 7) &&
          validMobilityTrace(
            r.session.rows.find((e) => e.key === m.key),
            m.steps,
            m.index,
          ) &&
          finite(m.startedAt, 0, 1e15) &&
          finite(m.stepStartedAt, m.startedAt, 1e15),
        "mobility timer.",
      );
    }
    if (r.mobilityPartials !== undefined)
      assert(
        Array.isArray(r.mobilityPartials) &&
          r.mobilityPartials.every(
            (m) =>
              object(m) &&
              r.session.rows.some(
                (e) => e.key === m.key && e.kind === "mobility",
              ) &&
              Number.isInteger(m.index) &&
              finite(m.index, 0, 7) &&
              typeof m.reason === "string" &&
              validMobilityTrace(
                r.session.rows.find((e) => e.key === m.key),
                m.steps,
                m.index,
              ) &&
              finite(m.startedAt, 0, 1e15) &&
              finite(m.stepStartedAt, m.startedAt, 1e15) &&
              finite(m.stoppedAt, m.stepStartedAt, 1e15),
          ),
        "partial mobility trace.",
      );
    assert(keys.size === r.session.rows.length, "duplicate exercise keys.");
    assert(
      r.sets.every(
        (e) =>
          object(e) &&
          keys.has(e.key) &&
          Object.hasOwn(EXERCISES, e.exerciseId) &&
          finite(e.at, 0, 1e15),
      ),
      "set log.",
    );
    assert(
      r.omissions.every(
        (e) => object(e) && keys.has(e.key) && typeof e.reason === "string",
      ),
      "omissions.",
    );
    assert(
      finite(r.startedAt, 0, 1e15) &&
        (!r.endedAt || finite(r.endedAt, r.startedAt, 1e15)),
      "timestamps.",
    );
    assert(
      (r.timingIncludesChange === undefined ||
        typeof r.timingIncludesChange === "boolean") &&
        (r.timingExcluded === undefined ||
          typeof r.timingExcluded === "boolean"),
      "calibration record flags.",
    );
    for (const e of r.session.rows) {
      if (e.kind === "mobility")
        assert(
          e.id === "mobility" &&
            e.sets === 1 &&
            e.reps === 5 &&
            [30, 45].includes(e.holdSeconds) &&
            e.rest === 15 &&
            ["upper", "lower"].includes(e.region),
          "mobility prescription.",
        );
      if (e.kind === "quality") {
        assert(
          e.sequence === undefined ||
            e.sequence === null ||
            (Array.isArray(e.sequence) && e.sequence.length === e.sets),
          "per-slot loads.",
        );
        assert(
          finite(e.effort, 1, 10) && finite(e.rest, 0, 3600),
          "quality effort/rest.",
        );
        assert(
          (Number.isInteger(e.reps) && finite(e.reps, 1, 20)) ||
            e.reps === "1+1",
          "quality reps.",
        );
        for (const range of [e.range, ...(e.sequence || [])].filter(Boolean))
          assert(
            Array.isArray(range) &&
              range.length === 2 &&
              range.every((n) => finite(n, 0, 500)) &&
              range[0] <= range[1],
            "percentage range.",
          );
        if (e.repSequence)
          assert(
            Array.isArray(e.repSequence) &&
              e.repSequence.length === e.sets &&
              e.repSequence.every(
                (n) => n === "1+1" || (Number.isInteger(n) && finite(n, 1, 20)),
              ),
            "per-slot reps.",
          );
      }
      if (e.kind === "failure")
        assert(
          e.repRange.every((n) => Number.isInteger(n) && finite(n, 1, 200)) &&
            e.repRange[0] <= e.repRange[1],
          "failure rep range.",
        );
    }
    for (const log of r.sets) {
      assert(
        log.fault === undefined ||
          log.fault === null ||
          typeof log.fault === "string",
        "logged fault.",
      );
      assert(
        log.heights === undefined ||
          (Array.isArray(log.heights) &&
            log.heights.every((x) => finite(x, 0.01, 100000))),
        "jump measurements.",
      );
      assert(
        log.seconds === undefined ||
          log.seconds === null ||
          finite(log.seconds, 0.001, 86400),
        "run timing.",
      );
      const row = r.session.rows.find((e) => e.key === log.key);
      assert(row.id === log.exerciseId, "exercise identity.");
      if (["quality", "failure"].includes(row.kind))
        assert(finite(log.weight, 0.1, 2000), "logged load.");
      if (row.kind === "failure")
        assert(
          Number.isInteger(log.reps) &&
            finite(log.reps, 0, 200) &&
            ["failure", "tech", "pain", "stop"].includes(log.endpoint),
          "failure endpoint/reps.",
        );
      if (row.kind === "quality")
        assert(
          ["make", "miss", "clean_miss", "jerk_miss"].includes(log.outcome) &&
            ["A", "B", "C"].includes(log.grade) &&
            finite(log.effort, 1, 10),
          "Olympic outcome.",
        );
      if (row.kind === "speed")
        assert(["good", "stop"].includes(log.quality), "athletic quality.");
      if (row.kind === "aerobic")
        assert(finite(log.minutes, 0.1, 300), "moving minutes.");
      if (row.kind === "aerobic" && log.timingMethod !== undefined) {
        assert(
          ["timed-confirmed", "confirmed"].includes(log.timingMethod) &&
            typeof log.shortened === "boolean" &&
            log.shortened === log.minutes < row.minutes,
          "aerobic completion.",
        );
        if (log.timingMethod === "timed-confirmed")
          assert(
            finite(log.timerStartedAt, r.startedAt, log.at) &&
              log.timerEndedAt === log.at &&
              finite(log.timedSeconds, 0, 1e15) &&
              finite(log.pausedSeconds, 0, 1e15) &&
              Math.abs(
                log.timedSeconds +
                  log.pausedSeconds -
                  (log.timerEndedAt - log.timerStartedAt) / 1000,
              ) < 0.001,
            "confirmed aerobic timing.",
          );
      }
      if (row.kind === "mobility")
        assert(
          log.holds === 4 &&
            log.holdSeconds === row.holdSeconds &&
            log.activeReps === 5 &&
            log.endpoint === "complete" &&
            finite(log.elapsedSeconds, 0, 1e15) &&
            validMobilityTrace(row, log.stepLog),
          "mobility outcome.",
        );
    }
    if (active) {
      for (const snapshot of [r.originalSession, r.baseSession].filter(Boolean))
        record({ ...r, session: snapshot, sets: [], omissions: [] });
      if (r.initialContext) context(r.initialContext);
      assert(
        !r.readinessChanges ||
          (Array.isArray(r.readinessChanges) &&
            r.readinessChanges.every((x) => object(x) && object(x.context))),
        "readiness changes.",
      );
      assert(
        object(r.context) &&
          object(r.anchors) &&
          ["snatch", "cj"].every((k) => finite(r.anchors[k], 1, 2000)) &&
          [2.5, 5].includes(r.increment) &&
          Array.isArray(r.preparations) &&
          r.preparations.every((k) => keys.has(k)),
        "exercise preparation.",
      );
    }
  }
  s.records.forEach((r) => record(r));
  assert(
    new Set(s.records.map((r) => r.id)).size === s.records.length,
    "duplicate session identities.",
  );
  if (s.active) record(s.active, true);
  assert(
    typeof s.weekId === "string" &&
      Number.isInteger(s.version) &&
      s.version >= 0,
    "state identity.",
  );
  // Restore only optional defaults; malformed required data is rejected before replacing storage.
  s.training = { ...b, ...t, timing: { ...TIME_DEFAULTS, ...t.timing } };
  return s;
}
export function importData(data) {
  if (data?.schema === SCHEMA) return validate(data);
  if (
    object(data) &&
    ((data.revision === 6 &&
      object(data.training) &&
      Array.isArray(data.records)) ||
      object(data.log) ||
      object(data.maxes))
  ) {
    const s = fresh();
    s.archives = [structuredClone(data)];
    return restoreRevision6Settings(s, data);
  }
  throw Error("This file is not a recognized Oly Tracker backup.");
}
function restoreRevision6Settings(state, previous) {
  if (previous?.revision !== 6 || !object(previous.training)) return state;
  const old = previous.training,
    retained = [],
    skipped = [];
  const mobilityNames = {
    "Bent-knee ankle wall stretch": "Ankle · bent-knee calf stretch, heel down",
    "Bench lat stretch · ribs controlled":
      "Overhead shoulder · hands-on-bench lat stretch, ribs controlled",
    "Front-rack wrist stretch":
      "Front rack · supported wrist stretch or unloaded elbow lifts",
    "Hip 90/90": "Hip rotation · supported 90/90",
  };
  const mapped = {
    ...Object.fromEntries(
      [
        "cycle",
        "week",
        "recovery",
        "split",
        "anchors",
        "increment",
        "technique",
        "heavy",
        "rackLoad",
        "assessment",
        "omitPull",
        "lowerDose",
        "omitLastLower",
        "cardio",
        "mobilitySeconds",
        "mobilityDays",
      ]
        .filter((key) => old[key] !== undefined)
        .map((key) => [key, old[key]]),
    ),
    entry:
      old.onboarding === false || old.cycle > 1 ? 3 : (old.entryStage ?? 1),
    gate: old.phaseGate ?? "F",
    reduceA: old.reduceMondaySnatch ?? false,
    reduceJerk: old.reduceCJerk ?? false,
    mobility: Array.isArray(old.mobility)
      ? old.mobility.map((name) => mobilityNames[name] || name)
      : [],
    equipment: {
      incline: { machine: "", smith: "smith", db: "db" }[old.incline] ?? "",
      lateral: old.lateral === "db" ? "db" : "",
      row: old.supportedRow === "machine" ? "machine" : "",
      leg_curl: old.legCurl === "lying" ? "lying" : "",
      calf: old.calfFallback ? "seated" : "",
      leg_ext: old.legExtUpright ? "upright" : "",
      crunch: old.crunch === "cable" ? "cable" : "",
      triceps: old.tricepsFallback ? "pressdown" : "",
    },
    ...(object(old.athletics)
      ? {
          athletics: {
            ...defaults().athletics,
            ...old.athletics,
            intensity: old.athletics.variationEffort ?? 90,
          },
        }
      : {}),
    trials: [
      ...(Array.isArray(old.established) ? old.established : []),
      ...(old.trial?.kind && old.trial.kind !== "none" ? [old.trial] : []),
    ].map((trial, i) => ({
      ...trial,
      id: trial.id || `revision6-trial-${i}`,
      exercise:
        trial.kind === "squat"
          ? trial.squat ||
            (trial.day === "tuesday" ? "front_squat" : "back_squat")
          : trial.exercise,
      status: i < (old.established?.length || 0) ? "retained" : "testing",
      reviews: Array.isArray(trial.reviews) ? trial.reviews : [],
    })),
  };
  // Validate each compatible setting without allowing an invalid old field to
  // erase unrelated selections. Original data always remains in the archive.
  for (const [key, value] of Object.entries(mapped)) {
    const candidate = structuredClone(state);
    candidate.training[key] = structuredClone(value);
    try {
      state = validate(candidate);
      retained.push(key);
    } catch {
      skipped.push(key);
    }
  }
  state.reviews.push({
    type: "Revision 6 app upgrade",
    at: Date.now(),
    notes: `Preserved compatible program settings, including selected mobility and optional work. Earlier logs and any unfinished older workout remain intact in Previous-program archives. Recheck readiness before training.${skipped.length ? ` Settings requiring review: ${skipped.join(", ")}; original values remain in the archive.` : ""}`,
    retainedSettings: retained,
    settingsToReview: skipped,
  });
  return state;
}
export function loadStore(storage) {
  const errors = [];
  for (const key of [KEY, BACKUP]) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      return {
        state: validate(JSON.parse(raw)),
        recovered: key === BACKUP,
        error: errors.join(" "),
      };
    } catch (e) {
      errors.push(`${key}: ${e.message}`);
    }
  }
  if (errors.length)
    return {
      state: null,
      error:
        "Saved data could not be read. Existing storage is intact. Import a valid backup to recover. " +
        errors.join(" "),
    };
  let state = fresh();
  for (const key of ["oly_state", "oly_rev6_backup", "oly_before_rev6"]) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      if (!state.archives.some((a) => JSON.stringify(a) === raw))
        state.archives.push(data);
    } catch {
      state.archives.push({ unparsedStorageKey: key, raw });
    }
  }
  // One-time recovery from the former Planner mirror, only when Oly has no
  // current journal or valid backup. This is never an ongoing storage bridge.
  try {
    const mirrored = JSON.parse(storage.getItem("day_cache_v1"))?.olyState
      ?.data;
    if (object(mirrored)) {
      if (mirrored.schema === SCHEMA && !state.archives.length) {
        const recovered = validate(mirrored);
        storage.setItem("oly_before_planner_sync", JSON.stringify(mirrored));
        storage.setItem(KEY, JSON.stringify(recovered));
        return { state: recovered, recovered: true, error: "" };
      }
      if (
        !state.archives.some(
          (a) => JSON.stringify(a) === JSON.stringify(mirrored),
        )
      )
        state.archives.push(mirrored);
    }
  } catch {
    // Planner retains its original data; an invalid mirror never replaces Oly.
  }
  const previous = state.archives
    .filter((x) => x?.revision === 6 && object(x.training))
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))[0];
  state = restoreRevision6Settings(state, previous);
  return { state, recovered: false, error: "" };
}
export function saveStore(storage, state, expectedVersion = state.version) {
  const existing = storage.getItem(KEY);
  if (existing) {
    let parsed;
    try {
      parsed = validate(JSON.parse(existing));
    } catch {
      /* Recovery may replace corrupt primary after validated backup. */
    }
    if (parsed?.schema === SCHEMA && parsed.version !== expectedVersion)
      throw Error(
        "Another tab changed this journal. Reload to use its latest data before editing.",
      );
  }
  const next = structuredClone(state);
  next.version = expectedVersion + 1;
  next.updatedAt = Date.now();
  validate(next);
  // Keep the last valid state, never replace a good backup with a corrupt primary.
  if (existing) {
    try {
      validate(JSON.parse(existing));
      storage.setItem(BACKUP, existing);
    } catch (e) {
      if (e.name === "QuotaExceededError") throw e;
    }
  }
  storage.setItem(KEY, JSON.stringify(next));
  return next;
}
