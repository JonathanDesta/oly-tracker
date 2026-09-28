import { loadRecommendation } from "./load-progression.js";
// September 21 amendment. The exact Olympic dose is a practical inference,
// not a protocol demonstrated superior (or equivalent) in intervention trials.
import { DOSE_VERSION, DOSE_STAGES, olympicDose } from "./dose.js";
export const LEGACY_FAILURE_POLICY = "first-invalid-v1";
export const PREVIOUS_FAILURE_POLICY = "first-invalid-v2";
export const FAILURE_POLICY = "first-invalid-v3";
export const allLoadedFailure = (c) => c?.workSetPolicy === "all-failure";
export const olympicFailure = (e) =>
  [FAILURE_POLICY, PREVIOUS_FAILURE_POLICY, LEGACY_FAILURE_POLICY].includes(
    e?.endpointPolicy,
  );
export const invalidAttempt = (r) => r.outcome !== "make" || r.grade === "C";
export const failureReached = (logs) =>
  !!logs.length &&
  invalidAttempt(logs.at(-1)) &&
  !["pain", "stop", "fatigue"].includes(logs.at(-1).endpoint);
export const validReps = (logs) =>
  logs.filter(
    (r) =>
      !invalidAttempt(r) && !["pain", "stop", "fatigue"].includes(r.endpoint),
  ).length;

// A terminal attempt closes one set, not every set of a multi-set exercise.
export function failureSets(logs) {
  const sets = [];
  for (const r of logs) {
    if (!sets.length || failureReached(sets.at(-1))) sets.push([]);
    sets.at(-1).push(r);
  }
  return sets;
}
export function failureSetStatus(e, logs) {
  const sets = failureSets(logs),
    completedSets = sets.filter(failureReached).length;
  const current =
    sets.length && !failureReached(sets.at(-1)) ? sets.at(-1) : [];
  const terminals = sets.filter(failureReached).map((s) => s.at(-1));
  const unsafe = logs.some((r) => ["pain", "stop"].includes(r.endpoint));
  const fatigued = logs.some((r) => r.endpoint === "fatigue");
  const zero =
    e.endpointPolicy !== LEGACY_FAILURE_POLICY &&
    sets.some((s) => failureReached(s) && validReps(s) === 0);
  const repeated =
    e.endpointPolicy !== LEGACY_FAILURE_POLICY &&
    terminals.some(
      (r, i) =>
        i > 0 &&
        r.fault?.trim() &&
        r.fault.trim().toLowerCase() ===
          terminals[i - 1].fault?.trim().toLowerCase(),
    );
  const stop = unsafe || fatigued || zero || repeated;
  return {
    sets,
    completedSets,
    current,
    currentSet: Math.min(e.sets, completedSets + 1),
    done: stop || completedSets >= e.sets,
    stop,
    endpointReached: completedSets === e.sets && !unsafe && !fatigued,
    validReps: validReps(logs),
    currentValidReps: validReps(current),
    reason: unsafe
      ? "Safety stop; incomplete exercise. Review before resuming."
      : fatigued
        ? "Stopped because breathing or muscle burning limited the set. This is not logged as a missed rep. Review the load and recovery before the next session."
        : zero
          ? "No valid rep in a set: end this exercise and review the load/technique before the next exposure."
          : repeated
            ? "The same material fault ended two sets: end this exercise; review technique before the next exposure."
            : completedSets >= e.sets
              ? "Every prescribed set ended at its first miss/invalid rep."
              : completedSets && !current.length
                ? "Set ended. Recover at least 5 minutes before the next prescribed set; no extra retry sets."
                : "Keep this set at one fixed load until the first miss or invalid rep; the rep window is not a stopping rule.",
  };
}
export function adoptReviewedDose(t) {
  // Introduce the newly allocated work gradually, even after finishing the old ramp.
  if (t.doseVersion && t.doseVersion !== DOSE_VERSION)
    t.failureEntry = Math.min(t.failureEntry || 1, 2);
  t.doseVersion = DOSE_VERSION;
  t.split = false;
  if (t.timing) t.timing.athleticsVisit = "same";
  if (t.athletics) t.athletics.day = "thursday";
  // The allocation replaces the prior base; preserve trial records for review.
  for (const trial of t.trials || []) trial.paused = true;
  delete t.nextDoseVersion;
  t.failureWeeks = [];
  delete t.failureWorkload;
  if (t.scheduleTrial) t.scheduleTrial.weeks = [];
}

export function adoptFailurePolicy(t, now = Date.now()) {
  t.workSetPolicy = "all-failure";
  adoptEquipment(t);
  adoptReviewedDose(t);
  delete t.nextWorkSetPolicy;
  t.failureEntry = 1;
  t.failureWeeks = [];
  delete t.failureWorkload;
  t.failureStartedAt = now;
  t.heavy = { snatch: 0, cj: 0, extraSnatch: 0, extraCj: 0 };
  t.rackLoad = null;
  t.assessment = "none";
  for (const trial of t.trials || [])
    if (["pause_jerk", "pause_load", "rack"].includes(trial.kind))
      trial.paused = true;
  if (t.scheduleTrial) t.scheduleTrial.weeks = [];
}
export function migrateFailurePolicy(s) {
  if (!s.training.workSetPolicy) {
    s.training.workSetPolicy = "source";
    if (!s.completed) s.training.nextWorkSetPolicy = "all-failure";
  }
  if (!s.active && s.training.nextWorkSetPolicy)
    adoptFailurePolicy(
      s.training,
      s.updatedAt || Date.parse(s.weekStart + "T12:00:00Z"),
    );
  if (
    allLoadedFailure(s.training) &&
    s.training.doseVersion !== DOSE_VERSION &&
    !s.completed
  ) {
    if (
      s.active ||
      s.records.some((r) => r.weekId === s.weekId) ||
      Object.keys(s.dates || {}).length
    )
      s.training.nextDoseVersion = DOSE_VERSION;
    else adoptReviewedDose(s.training);
  }
  if (allLoadedFailure(s.training)) adoptEquipment(s.training);
  return s;
}
function adoptEquipment(t) {
  // September 25: the user confirmed using incline-bench dumbbell rows.
  // Set the future preference once; never rewrite saved/active prescriptions.
  if (t.rowEquipmentRevision !== 1) {
    t.equipment.row = "db";
    t.rowEquipmentRevision = 1;
  }
  // September 28: dumbbells are capped and no shrug machine is available.
  // Change future sessions once; retain history, active sessions and later choices.
  if (t.shrugEquipmentRevision !== 1) {
    t.equipment.shrug = "barbell";
    t.shrugEquipmentRevision = 1;
  }
}
export const failureTrialPending = (c) =>
  allLoadedFailure(c) &&
  ((c.failureEntry || 1) < (c.doseVersion === DOSE_VERSION ? DOSE_STAGES : 3) ||
    (c.failureWeeks || []).length < 2);

export function failureOlympics(rows, c, phase, day) {
  // A pivot with no Olympic loading and a taper with two exposures reduce
  // volume without falsely labeling submaximal work as failure training.
  if (c.week === 13 || (c.week === 12 && ["tuesday", "thursday"].includes(day)))
    return [];
  const effectivePhase = ["T", "P"].includes(phase) ? c.gate : phase;
  const targets = { F: [2, 4], B: [1, 3], R: [1, 2] }[effectivePhase];
  const hasPause = rows.some((e) => e.id === "pause_jerk");
  return rows
    .filter(
      (e) =>
        !e.regression &&
        !(["snatch", "hang"].includes(e.id) && c.technique.snatch !== "none") &&
        !(["cj", "clean"].includes(e.id) && c.technique.clean !== "none") &&
        !(
          ["jerk", "pause_jerk"].includes(e.id) && c.technique.jerk !== "none"
        ) &&
        !(e.id === "cj" && c.technique.jerk !== "none") &&
        !(hasPause && e.id === "jerk") &&
        !(c.reduceA && day === "monday" && e.id === "snatch") &&
        !(c.reduceJerk && ["jerk", "pause_jerk"].includes(e.id)),
    )
    .map((e) => {
      const range = e.id === "pull" ? [3, 5] : [...targets];
      const row = {
        ...e,
        endpointPolicy: FAILURE_POLICY,
        sets: olympicDose(e.id, day, c),
        validRepRange: range,
        reps: range[1] + 1,
        resetSeconds: 40,
        loadIsEstimate: !(c.week === 12 && day === "friday"),
        selfSelectedLoad: true,
        warmupVersion: "brief-v1",
        recoveryAfter: 300,
        rest: 300,
        effort: 10,
        hold:
          [4, 8, 9, 10, 11, 12, 13].includes(c.week) ||
          (c.failureEntry || 1) <
            (c.doseVersion === DOSE_VERSION ? DOSE_STAGES : 3) ||
          c.entry < 3,
        benchmark: c.week === 12 && day === "friday",
        test: c.week === 12 && day === "friday",
        assessment: false,
        warmup:
          "Do the general warm-up once. For the first Olympic lift: a short light-bar check, then 50%, 70% and 85% of today's working weight for one rep each. For the second lift: check its catch with a light bar, then 60% and 85% for one rep each. Each clean & jerk rep includes both lifts. Skip duplicate loads, add a light step if needed, and rest until ready. Warm-ups should prepare you, not tire you out.",
        note: "Use one weight for the whole set. Catch every snatch and clean in a full squat; each clean & jerk rep includes a jerk. Put the bar down and rest 40 seconds between reps. End at the first miss OR change that breaks the prescribed form, including switching to a power catch because you are tired. Do not keep going to chase a miss. If breathing or burning stops you first, record that honestly. Rest 5 minutes between work sets. Stop for pain; no extra retry sets.",
      };
      for (const field of [
        "range",
        "sequence",
        "repSequence",
        "finalEffort",
        "workingLoad",
        "heldLoads",
        "afterRest",
        "trialId",
        "trialIds",
      ])
        delete row[field];
      row.baseSets = row.sets;
      const trials = (c.trials || []).filter(
        (t) =>
          t.kind === "olympic_set" &&
          !t.paused &&
          t.day === day &&
          t.exercise === e.id &&
          c.week < 12,
      );
      row.sets += trials.length;
      if (trials.length) row.trialIds = trials.map((t) => t.id);
      return row;
    });
}

export function failureProgression(e, history) {
  const last = history.at(-1);
  if (!last)
    return {
      weight: null,
      text: `Choose your working weight. Aim for a weight that allows about ${e.validRepRange.join("–")} good reps before the first miss or form breakdown. That range guides weight selection; it is not a required stopping point. Use warm-ups to check the weight, and do not turn the set into a conditioning test.`,
    };
  const sets = failureSets(last.sets);
  return loadRecommendation(
    e,
    sets.map((set) => ({
      weight: set.at(-1)?.weight,
      reps: validReps(set),
      valid:
        failureReached(set) &&
        !set.some((r) => ["fatigue", "pain", "stop"].includes(r.endpoint)),
    })),
    {
      complete:
        sets.length === (last.row?.sets ?? e.sets) &&
        !last.record?.omissions?.some(
          (o) => o.key === (last.row?.key || e.key),
        ) &&
        !last.sets.some((r) => r.overCap),
    },
  );
}
