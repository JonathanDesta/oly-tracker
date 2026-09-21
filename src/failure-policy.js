// September 21 amendment. The exact Olympic dose is a practical inference,
// not a protocol demonstrated superior (or equivalent) in intervention trials.
import { DOSE_VERSION, DOSE_STAGES, olympicDose } from "./dose.js";
export const LEGACY_FAILURE_POLICY = "first-invalid-v1";
export const FAILURE_POLICY = "first-invalid-v2";
export const allLoadedFailure = (c) => c?.workSetPolicy === "all-failure";
export const olympicFailure = (e) =>
  [FAILURE_POLICY, LEGACY_FAILURE_POLICY].includes(e?.endpointPolicy);
export const invalidAttempt = (r) => r.outcome !== "make" || r.grade === "C";
export const failureReached = (logs) =>
  !!logs.length &&
  invalidAttempt(logs.at(-1)) &&
  !["pain", "stop"].includes(logs.at(-1).endpoint);
export const validReps = (logs) =>
  logs.filter(
    (r) => !invalidAttempt(r) && !["pain", "stop"].includes(r.endpoint),
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
  const zero =
    e.endpointPolicy === FAILURE_POLICY &&
    sets.some((s) => failureReached(s) && validReps(s) === 0);
  const repeated =
    e.endpointPolicy === FAILURE_POLICY &&
    terminals.some(
      (r, i) =>
        i > 0 &&
        r.fault?.trim() &&
        r.fault.trim().toLowerCase() ===
          terminals[i - 1].fault?.trim().toLowerCase(),
    );
  const stop = unsafe || zero || repeated;
  return {
    sets,
    completedSets,
    current,
    currentSet: Math.min(e.sets, completedSets + 1),
    done: stop || completedSets >= e.sets,
    stop,
    endpointReached: completedSets === e.sets && !unsafe,
    validReps: validReps(logs),
    currentValidReps: validReps(current),
    reason: unsafe
      ? "Safety stop; incomplete exercise. Review before resuming."
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
  return s;
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
  const start = { F: 80, B: 85, R: 88 }[effectivePhase];
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
      const percent =
        e.id === "hang"
          ? start - 10
          : e.id === "pull"
            ? start + 10
            : ["jerk", "pause_jerk"].includes(e.id) && !c.anchors.jerk
              ? 65
              : start;
      const row = {
        ...e,
        endpointPolicy: FAILURE_POLICY,
        sets: olympicDose(e.id, day, c),
        validRepRange: range,
        reps: range[1] + 1,
        range: [percent, percent],
        resetSeconds: 15,
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
        note: "Each prescribed set uses one fixed load. After each valid rep (a complete clean AND jerk for CJ), reset 15 seconds and repeat. The FIRST miss or technically invalid rep ends that set. Recover at least 5 minutes before the next prescribed set; never add retries or replacement sets. End the exercise after a zero-valid-rep set or the same material fault in two sets; stop the session for pain/unsafe symptoms. The rep window guides future load, never the endpoint. Exact Olympic failure set counts are a monitored inference, not a proven optimum.",
      };
      for (const field of [
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

export function failureProgression(e, history, increment = 5) {
  const last = history.at(-1);
  if (!last)
    return {
      weight: null,
      text: "First exposure: use the starting estimate only if warm-ups are secure. Count valid reps before the first miss or invalid rep. Review a zero-valid-rep set; do not retry.",
    };
  const weight = last.sets[0]?.weight;
  if (!weight)
    return { weight: null, text: "No comparable loaded exposure yet." };
  const count = validReps(failureSets(last.sets)[0] || []);
  if (count < e.validRepRange[0])
    return {
      weight: Math.max(
        increment,
        Math.floor((weight * 0.925) / increment) * increment,
      ),
      text: "Below the valid-rep window: reduce about 5–10% next exposure and review technique/recovery. Do not add retry sets.",
    };
  if (e.hold || e.checkpoint)
    return {
      weight,
      text: "Hold the last comparable work load during introduction, checkpoint or Realization/taper. Recovery still governs whether to train.",
    };
  const recent = history.slice(-2);
  const earned =
    recent.length === 2 &&
    recent.every(
      (h) =>
        h.normal &&
        !h.record.omissions.some((o) => o.key === e.key) &&
        failureSetStatus(e, h.sets).completedSets === e.sets &&
        failureSets(h.sets).every(
          (set) => failureReached(set) && validReps(set) >= e.validRepRange[1],
        ) &&
        h.sets.every((r) => !r.overCap && r.weight === weight),
    );
  return {
    weight: weight + (earned ? increment : 0),
    text: earned
      ? "Two comparable, normal exposures reached the top of the valid-rep window before the terminal attempt. Add one plate increment; keep the prescribed set count."
      : "Repeat this load. An increase requires two comparable normal exposures at the top of the valid-rep window, each ending at the first miss/invalid rep, with normal subsequent recovery.",
  };
}
