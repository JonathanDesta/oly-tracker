// September 21 amendment. The exact Olympic dose is a practical inference,
// not a protocol demonstrated superior (or equivalent) in intervention trials.
export const FAILURE_POLICY = "first-invalid-v1";
export const allLoadedFailure = (c) => c?.workSetPolicy === "all-failure";
export const olympicFailure = (e) => e?.endpointPolicy === FAILURE_POLICY;
export const invalidAttempt = (r) => r.outcome !== "make" || r.grade === "C";
export const failureReached = (logs) =>
  !!logs.length &&
  invalidAttempt(logs.at(-1)) &&
  !["pain", "stop"].includes(logs.at(-1).endpoint);
export const validReps = (logs) =>
  logs.filter(
    (r) => !invalidAttempt(r) && !["pain", "stop"].includes(r.endpoint),
  ).length;

export function adoptFailurePolicy(t, now = Date.now()) {
  t.workSetPolicy = "all-failure";
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
  return s;
}
export const failureTrialPending = (c) =>
  allLoadedFailure(c) &&
  ((c.failureEntry || 1) < 3 || (c.failureWeeks || []).length < 2);

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
        sets: 1,
        validRepRange: range,
        reps: range[1] + 1,
        range: [percent, percent],
        resetSeconds: 15,
        recoveryAfter: 300,
        rest: 300,
        effort: 10,
        hold:
          [4, 8, 9, 10, 11, 12, 13].includes(c.week) ||
          (c.failureEntry || 1) < 3 ||
          c.entry < 3,
        benchmark: c.week === 12 && day === "friday",
        test: c.week === 12 && day === "friday",
        assessment: false,
        note: "One loaded work set at one fixed load. After each valid rep (a complete clean AND jerk for CJ), reset 15 seconds and repeat. End immediately at the FIRST miss or technically invalid rep (grade C); no retry or load change. The rep window guides the NEXT exposure, never the endpoint. Stop for pain or an unsafe situation and record an incomplete set. Rest at least 5 minutes before the next loaded exercise. Starting loads and reduced set counts are practical estimates, not a proven optimal Olympic-failure protocol.",
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
  const count = validReps(last.sets);
  if (count < e.validRepRange[0])
    return {
      weight: Math.max(
        increment,
        Math.floor((weight * 0.925) / increment) * increment,
      ),
      text: "Below the valid-rep window: reduce about 5–10% next exposure and review technique/recovery. No same-session retry.",
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
        failureReached(h.sets) &&
        validReps(h.sets) >= e.validRepRange[1] &&
        h.sets.every((r) => !r.overCap && r.weight === weight),
    );
  return {
    weight: weight + (earned ? increment : 0),
    text: earned
      ? "Two comparable, normal exposures reached the top of the valid-rep window before the terminal attempt. Add one plate increment; keep one failure-ended set."
      : "Repeat this load. An increase requires two comparable normal exposures at the top of the valid-rep window, each ending at the first miss/invalid rep, with normal subsequent recovery.",
  };
}
