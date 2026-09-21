import { allLoadedFailure, failureTrialPending } from "./failure-policy.js";
import { phaseFor, copy, dayPlan, sportEvent } from "./prescription.js";
import { scheduleTrialPending } from "./calendar.js";
import {
  uid,
  normal,
  localDate,
  successfulRow,
  fingerprint,
  contextFor,
} from "./training.js";
export const CHANGE_OPTIONS = {
  set: "Add one weekly conventional set",
  olympic_set: "Trial one additional weekly Olympic set",
  reduce_set: "Remove one weekly work set after review",
  squat: "Trial one support squat set",
  press: "Trial D overhead press substitution",
  pause_jerk: "Trial C pause-dip jerk substitution",
  pause_load: "Progress pause-dip jerk trial load",
  calf_partial: "Trial D fixed-range calf substitution",
  athletic_start: "Introduce athletics",
  athletic_step: "Advance primary athletics one step",
  athletic_second: "Trial second athletic exposure · jumps",
  athletic_runs: "Add secondary 2 × 10 m runs",
  secondary_jump: "Add 3 secondary jumps",
  secondary_run: "Add one secondary run",
  fly: "Trial flying 10 m replacement",
  cut: "Trial 45° cut replacement",
  variation_intensity: "Progress selected running variation intensity",
  cardio_start: "Introduce 2 × 20 min aerobics",
  cardio_step: "Increase weekly aerobic minutes",
  heavy_snatch: "Progress final D snatch",
  heavy_cj: "Progress final D CJ",
  extra_snatch: "Replace one more weekly snatch attempt above 90%",
  extra_cj: "Replace one more weekly CJ attempt above 90%",
  rack: "Progress rack-jerk working load",
  clean_assessment: "Replace B with full-clean assessment",
  jerk_assessment: "Replace C with rack-jerk assessment",
};
export const sourceOlympicChange = (kind) =>
  [
    "pause_jerk",
    "pause_load",
    "rack",
    "clean_assessment",
    "jerk_assessment",
  ].includes(kind) ||
  kind.startsWith("heavy_") ||
  kind.startsWith("extra_");
function requireFact(ok, message) {
  if (!ok) throw Error(message);
}
function currentWeek(s, r) {
  return r.weekId
    ? r.weekId === s.weekId
    : r.cycle === s.training.cycle &&
        r.week === s.training.week &&
        localDate(new Date(r.at)) >= s.weekStart;
}
function introductionWorkload(t) {
  // Compare discretionary dose, not the ordinary phase change or load progression.
  return JSON.stringify([
    t.entry,
    t.reduceA,
    t.reduceJerk,
    t.lowerDose,
    t.omitPull,
    t.trials
      .filter((x) => !x.paused)
      .map((x) => x.id)
      .sort(),
    t.cardio.enabled ? t.cardio.minutes : 0,
    t.heavy.extraSnatch,
    t.heavy.extraCj,
  ]);
}
function checkAthleticIntroduction(s, change) {
  const t = s.training;
  const position = s.reviews.findLastIndex(
    (r) => r.type === "Starting position",
  );
  const reviews = s.reviews.slice(position + 1);
  const weeks = [
    ...new Map(
      reviews.filter((r) => r.training && r.weekId).map((r) => [r.weekId, r]),
    ).values(),
  ].slice(-2);
  const stable = (r) =>
    r.green &&
    r.recovery === "normal" &&
    r.training.recovery === "normal" &&
    introductionWorkload(r.training) === introductionWorkload(t);
  requireFact(
    weeks.every(stable),
    "Athletics needs two green weeks at the current stable workload. The entry ramp or a recorded dose/recovery change interrupted that window; normally weeks 3 and 4 qualify, then introduce in week 5.",
  );
  const heldDose = weeks.length === 2 && weeks.every(stable);
  requireFact(
    heldDose ||
      (t.entry === 3 &&
        (t.cycle > 1 || t.week >= 5 || change.adapted === true)),
    "Normally introduce athletics in week 5 after two stable green weeks. An earlier start needs two reviewed weeks at the same lower dose, or confirmed prior adaptation to the current dose.",
  );
  requireFact(
    !s.reviews.some(
      (r) =>
        r.type === "change" &&
        !r.change.kind.endsWith("_assessment") &&
        r.change.kind !== "rack" &&
        currentWeek(s, r),
    ),
    "No other dose increase is allowed in the athletics introduction week.",
  );
}
export function applyChange(s, change, now = Date.now()) {
  requireFact(
    !s.active,
    "Finish the current session before changing prescriptions.",
  );
  requireFact(!s.completed, "The annual program is complete.");
  const t = s.training,
    { phase, additions, checkpoint } = phaseFor(t),
    kind = change.kind;
  requireFact(CHANGE_OPTIONS[kind], "Choose a listed program change.");
  if (kind === "reduce_set") {
    requireFact(
      allLoadedFailure(t),
      "Individual set reductions apply to the revised failure prescription.",
    );
    requireFact(
      change.reason?.trim(),
      "Record the performance/recovery reason for reducing this set.",
    );
    const row = dayPlan(t, change.day)
      .sessions.flatMap((se) => se.rows)
      .find(
        (e) =>
          e.id === change.exercise && ["quality", "failure"].includes(e.kind),
      );
    requireFact(
      row && row.sets > 1,
      "Choose an exercise with at least two work sets on that day. Use omission/readiness controls if all work must stop.",
    );
    const trial = t.trials.findLast(
      (x) =>
        !x.paused &&
        ["set", "olympic_set"].includes(x.kind) &&
        x.day === change.day &&
        x.exercise === change.exercise,
    );
    if (trial) {
      trial.paused = true;
      trial.reviews.push({
        at: now,
        count: trialExposures(s, trial).length,
        decision: "pause",
        reason: change.reason,
      });
    } else {
      t.setReductions ||= [];
      const reduction = t.setReductions.find(
        (x) => x.day === change.day && x.exercise === change.exercise,
      );
      if (reduction) reduction.sets++;
      else
        t.setReductions.push({
          day: change.day,
          exercise: change.exercise,
          sets: 1,
        });
    }
    t.workloadChangedAt = now;
    s.reviews.push({
      at: now,
      type: "change",
      weekId: s.weekId,
      week: t.week,
      cycle: t.cycle,
      change: copy(change),
    });
    return;
  }
  requireFact(
    !allLoadedFailure(t) || !sourceOlympicChange(kind),
    "The failure amendment uses fixed-load Olympic failure sets with rep-based progression. Source heavy-slot, extra-attempt and bounded-assessment changes do not apply.",
  );
  requireFact(
    !failureTrialPending(t),
    "First complete the failure introduction, then review two full green weeks at the same established workload with normal next-session recovery. Hold optional dose additions until then.",
  );
  requireFact(
    !scheduleTrialPending(t) ||
      ["clean_assessment", "jerk_assessment", "rack", "pause_load"].includes(
        kind,
      ),
    "First review two complete green weeks at the established dose with normal C/D quality under the weekday schedule. Hold dose additions while testing the new order.",
  );
  requireFact(
    change.reason?.trim(),
    "Record the target, baseline observations, and why this change is useful.",
  );
  requireFact(
    change.ready,
    "Confirm the listed eligibility conditions from your training log.",
  );
  requireFact(
    t.recovery === "normal",
    "Restore normal training before adding or assessing work.",
  );
  const current = contextFor(s, now);
  requireFact(
    !current.verificationPending,
    "Confirm the verification return and next warm-ups in History before adding work.",
  );
  if (s.readiness?.date === localDate(new Date(now)))
    requireFact(
      current.level === "green" &&
        !current.local &&
        sportEvent(current) === "normal" &&
        ["normal", "limited_return"].includes(current.event),
      "Hold changes while readiness or an active event restricts training.",
    );
  const assessment = kind.endsWith("_assessment"),
    rack = kind === "rack",
    pauseProgress = kind === "pause_load",
    heavy = kind.startsWith("heavy_") || kind.startsWith("extra_"),
    athleticStart = kind === "athletic_start";
  const athleticChange =
    kind.startsWith("athletic_") ||
    [
      "secondary_jump",
      "secondary_run",
      "fly",
      "cut",
      "variation_intensity",
    ].includes(kind);
  const beforeAthletics = athleticChange ? copy(t.athletics) : null;
  if (athleticChange && !athleticStart) {
    requireFact(
      !contextFor(s, now).athleticReturn,
      "After more than 14 days away, complete two good exposures one progression step lower before progressing athletics.",
    );
    const last = s.reviews.findLast(
      (r) => r.type === "change" && r.afterAthletics,
    );
    const good = s.records.filter(
      (r) =>
        r.session.kind === "athletic" &&
        normal(r) &&
        r.session.rows.every((e) => successfulRow(r, e)),
    );
    if (last) {
      const previous = last.change.kind;
      const secondary = [
        "athletic_second",
        "athletic_runs",
        "secondary_jump",
        "secondary_run",
      ].includes(previous);
      const variation = ["fly", "cut", "variation_intensity"].includes(
        previous,
      );
      const observed = good.filter(
        (r) =>
          r.startedAt >= last.at &&
          r.session.id === (secondary ? "athletics-secondary" : "athletics") &&
          (!variation ||
            r.session.rows.some((e) => e.id === t.athletics.variation)),
      );
      requireFact(
        observed.length >= 2,
        "Hold other athletic components until two complete, successful comparable exposures at the last changed dose (and normal subsequent recovery) are recorded.",
      );
    }
    if (
      kind === "athletic_second" &&
      s.reviews.some((r) => r.change?.kind === "athletic_start")
    )
      requireFact(
        good.filter((r) => r.session.id === "athletics").length >= 4,
        "Record four productive primary exposures before introducing secondary jumps.",
      );
  }
  if (!assessment && !rack)
    requireFact(
      !s.reviews.some(
        (r) =>
          r.type === "change" &&
          r.change.kind === "athletic_start" &&
          currentWeek(s, r),
      ),
      "No other dose increase is allowed in the athletics introduction week.",
    );
  if (athleticStart) checkAthleticIntroduction(s, change);
  requireFact(
    assessment
      ? ["F", "B"].includes(phase) && t.week < 9
      : heavy || rack
        ? ["F", "B", "R"].includes(phase) &&
          ![4, 8, 11, 12, 13].includes(t.week)
        : athleticStart
          ? [1, 2, 3, 5, 6, 7].includes(t.week)
          : additions,
    "This change is not eligible in the current phase/checkpoint/entry stage.",
  );
  if (!assessment && kind !== "rack" && !pauseProgress) {
    requireFact(
      !t.trials.some((x) => !x.paused && x.status === "testing"),
      "Finish the existing controlled trial review before adding another domain.",
    );
    requireFact(
      change.stable,
      "Confirm two green weeks at a stable workload, or the specified two successful exposures for this progression. Hold other changes.",
    );
  }
  if (assessment) {
    requireFact(
      change.stable,
      "Assessment requires two secure normal Olympic weeks and safe release competence.",
    );
    t.assessment = kind === "clean_assessment" ? "clean" : "jerk";
  } else if (
    [
      "set",
      "olympic_set",
      "squat",
      "press",
      "pause_jerk",
      "calf_partial",
    ].includes(kind)
  ) {
    if (kind === "olympic_set") {
      requireFact(
        allLoadedFailure(t),
        "Olympic failure-set trials require the failure amendment.",
      );
      const row = dayPlan(t, change.day)
        .sessions.flatMap((s) => s.rows)
        .find((e) => e.id === change.exercise && e.endpointPolicy);
      requireFact(
        row && row.sets < 20,
        "Choose an existing Olympic exercise on that day.",
      );
    }
    if (kind === "pause_jerk")
      requireFact(
        t.anchors.jerk && t.technique.jerk === "none" && !t.reduceJerk,
        "Pause-jerk assistance requires assessed RJ, stable technique and ordinary C jerk dose.",
      );
    if (["press", "pause_jerk", "calf_partial"].includes(kind))
      requireFact(
        !t.trials.some((x) => x.kind === kind && !x.paused),
        "That substitution is already active.",
      );
    if (kind === "squat")
      requireFact(
        ["front_squat", "back_squat"].includes(change.exercise),
        "Choose the squat most relevant to the observed limit.",
      );
    if (kind === "set")
      requireFact(
        [
          ...(allLoadedFailure(t)
            ? ["bench", "front_squat", "back_squat", "press"]
            : []),
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
        ].includes(change.exercise),
        "Choose an existing upper/lower block row.",
      );
    if (kind === "set")
      requireFact(
        dayPlan(t, change.day).sessions.some((s) =>
          s.rows.some((e) => e.id === change.exercise && e.kind === "failure"),
        ),
        "Choose a conventional exercise that exists on this day.",
      );
    if (kind === "calf_partial")
      requireFact(
        !t.equipment.calf,
        "The partial trial requires a familiar standing-calf setup.",
      );
    const day = ["press", "calf_partial"].includes(kind)
      ? "friday"
      : kind === "pause_jerk"
        ? "thursday"
        : change.day;
    requireFact(
      (kind === "olympic_set"
        ? ["monday", "tuesday", "thursday", "friday"]
        : ["tuesday", "friday", "thursday"]
      ).includes(day) &&
        (!["set", "squat"].includes(kind) || day !== "thursday"),
      "Use B or D for conventional additions.",
    );
    t.trials.push({
      id: uid(),
      kind,
      day,
      exercise: change.exercise,
      startedAt: now,
      reason: change.reason,
      baseline: change.baseline || change.reason,
      status: "testing",
      paused: false,
      reviews: [],
    });
  } else if (pauseProgress) {
    const trial = t.trials.find((x) => x.kind === "pause_jerk" && !x.paused);
    requireFact(
      trial && t.anchors.jerk && t.technique.jerk === "none" && !t.reduceJerk,
      "Use an active pause-jerk trial with assessed RJ and ordinary jerk quality.",
    );
    const good = trialExposures(s, trial).filter(
      (r) =>
        r.startedAt >= Math.max(trial.resumedAt || 0, trial.loadChangedAt || 0),
    );
    requireFact(
      change.stable && good.length >= 2,
      "Two secure comparable pause-jerk exposures are required before progressing.",
    );
    const prior =
      trial.load ||
      good
        .at(-1)
        .sets.filter((x) => x.key === "pause_jerk")
        .at(-1).weight;
    const weight = Number(change.load);
    requireFact(
      weight - prior >= 2.5 &&
        weight - prior <= 5 &&
        weight >= t.anchors.jerk * 0.6 &&
        weight <= t.anchors.jerk * 0.75,
      "Add 2.5–5 lb within 60–75% RJ; keep two singles and effort ≤7.",
    );
    trial.load = weight;
    trial.loadChangedAt = now;
  } else if (kind === "athletic_start") {
    requireFact(!t.athletics.enabled, "Athletics is already enabled.");
    t.athletics.enabled = true;
  } else if (kind === "athletic_step") {
    requireFact(t.athletics.enabled, "Introduce athletics first.");
    t.athletics.stage++;
  } else if (kind === "athletic_second") {
    requireFact(
      t.athletics.enabled && !t.athletics.secondary && change.fourPrimary,
      "Confirm four productive primary exposures before a second slot.",
    );
    t.athletics.secondary = 1;
  } else if (kind === "athletic_runs") {
    requireFact(
      t.athletics.secondary === 1,
      "Complete two green secondary jump exposures first.",
    );
    t.athletics.secondary = 2;
  } else if (kind === "secondary_jump") {
    requireFact(t.athletics.secondary > 0, "Start the secondary trial first.");
    t.athletics.secondaryJumps++;
  } else if (kind === "secondary_run") {
    requireFact(
      t.athletics.secondary >= 2,
      "Establish secondary running first.",
    );
    t.athletics.secondaryRuns++;
  } else if (["fly", "cut"].includes(kind)) {
    requireFact(t.athletics.stage >= 7, "First establish 4 × 20 m runs.");
    t.athletics.variation = kind;
    t.athletics.intensity = kind === "fly" ? 90 : 80;
  } else if (kind === "variation_intensity") {
    requireFact(
      t.athletics.variation !== "none" &&
        t.athletics.intensity < (t.athletics.variation === "fly" ? 95 : 90),
      "Choose and tolerate a variation first; its prescribed intensity progression can be applied once.",
    );
    t.athletics.intensity = t.athletics.variation === "fly" ? 95 : 90;
  } else if (kind === "cardio_start") {
    requireFact(!t.cardio.enabled, "Aerobic work is already enabled.");
    t.cardio.enabled = true;
    t.cardio.minutes = 40;
  } else if (kind === "cardio_step") {
    requireFact(t.cardio.enabled, "Introduce aerobics first.");
    requireFact(
      t.cardio.minutes < 300,
      "The program permits progression toward 300 moderate minutes, not beyond.",
    );
    if (t.cardio.minutes >= 150)
      requireFact(
        change.fullCycle,
        "Beyond 150 minutes requires a full cycle of good tolerance at 150.",
      );
    t.cardio.minutes = Math.min(
      300,
      t.cardio.minutes + (t.cardio.minutes < 60 ? 5 : 10),
    );
  } else if (heavy) {
    const id = kind.endsWith("snatch") ? "snatch" : "cj",
      key = kind.startsWith("extra_")
        ? id === "snatch"
          ? "extraSnatch"
          : "extraCj"
        : id;
    requireFact(t.entry === 3, "Finish entry before heavier practice.");
    if (kind.startsWith("extra_")) {
      requireFact(
        ["B", "R"].includes(phase) && t.heavy[id] >= 92,
        "Establish the final D heavy attempt first in B/R.",
      );
      const capacity =
        id === "snatch" ? (phase === "B" ? 11 : 9) : phase === "B" ? 9 : 8;
      requireFact(
        t.heavy[key] < capacity,
        "Every permitted replacement slot is already used; keep at least one light A set.",
      );
      t.heavy[key]++;
    } else {
      const n = t.heavy[key];
      if (phase === "F") {
        requireFact(
          n < (t.cycle === 1 ? 88 : 90),
          "The Foundation cap is already earned: 88% in cycle 1, 90% in later Foundation cycles.",
        );
        t.heavy[key] = t.cycle > 1 && n >= 88 ? 90 : 88;
      } else if (n < 88) t.heavy[key] = 88;
      else if (n < 92) t.heavy[key] = 92;
      else {
        requireFact(
          phase === "R" && n < 95,
          "93–95% is available in Realization after two secure exposures.",
        );
        t.heavy[key] = 95;
      }
    }
  } else if (kind === "rack") {
    requireFact(
      t.anchors.jerk,
      "Assess RJ before direct rack-jerk progression.",
    );
    requireFact(
      change.stable,
      "Two C exposures with every rep secure are required.",
    );
    const weight = Number(change.load),
      prior = t.rackLoad || Number(change.baselineLoad);
    requireFact(
      prior > 0 && weight - prior >= 2.5 && weight - prior <= 5,
      "Use the last secure working load plus 2.5–5 lb.",
    );
    t.rackLoad = weight;
  }
  t.workloadChangedAt = now;
  s.reviews.push({
    at: now,
    type: "change",
    weekId: s.weekId,
    week: s.training.week,
    cycle: s.training.cycle,
    change: copy(change),
    ...(athleticChange
      ? { beforeAthletics, afterAthletics: copy(t.athletics) }
      : {}),
  });
}
export function trialExposures(s, trial) {
  const current = dayPlan(s.training, trial.day)
    .sessions.flatMap((x) => x.rows)
    .find((e) => e.trialId === trial.id || e.trialIds?.includes(trial.id));
  return s.records.filter(
    (r) =>
      r.session.rows.some(
        (e) =>
          (e.trialId === trial.id || e.trialIds?.includes(trial.id)) &&
          (!current || fingerprint(e) === fingerprint(current)) &&
          successfulRow(r, e),
      ) && normal(r),
  );
}
export function reviewTrial(s, id, decision, reason, now = Date.now()) {
  if (s.active)
    throw Error("Finish the active session before changing a trial.");
  const t = s.training.trials.find((x) => x.id === id);
  if (!t) throw Error("Trial not found.");
  if (
    allLoadedFailure(s.training) &&
    sourceOlympicChange(t.kind) &&
    !["remove", "pause"].includes(decision)
  )
    throw Error(
      "This source Olympic trial is superseded by the failure amendment. Pause or remove it; Olympic progression now uses valid reps.",
    );
  if (!reason?.trim())
    throw Error(
      "Record target observations, next-session response and rationale.",
    );
  if (
    !["retain", "continue", "extend", "remove", "pause", "resume"].includes(
      decision,
    )
  )
    throw Error("Choose a trial decision.");
  if (
    decision === "resume" &&
    (!phaseFor(s.training).additions || s.training.recovery !== "normal")
  )
    throw Error("Resume in normal F/B after readiness review.");
  if (decision === "resume") {
    requireFact(
      !failureTrialPending(s.training),
      "Complete the failure introduction and stable-dose review before resuming additions.",
    );
    requireFact(
      !scheduleTrialPending(s.training),
      "Finish the two-week schedule review before resuming an added-dose trial.",
    );
    const current = s.readiness;
    if (
      current?.date === localDate(new Date(now)) &&
      (current.level !== "green" ||
        current.local ||
        sportEvent(current) !== "normal" ||
        !["normal", "limited_return"].includes(current.event))
    )
      throw Error(
        "Resume only with normal readiness and no active event restriction.",
      );
    if (
      ["press", "pause_jerk", "calf_partial"].includes(t.kind) &&
      s.training.trials.some(
        (x) => x.id !== t.id && x.kind === t.kind && !x.paused,
      )
    )
      throw Error(
        "That substitution already has an active trial. Resolve it before resuming another.",
      );
    if (t.kind === "calf_partial" && s.training.equipment.calf)
      throw Error("Resume partials only in the familiar standing-calf setup.");
  }
  const count = trialExposures(s, t).length;
  if (
    decision === "retain" &&
    ["set", "olympic_set"].includes(t.kind) &&
    new Set(trialExposures(s, t).map((r) => r.weekId)).size < 2
  )
    throw Error(
      "Hold the added weekly set for two normal green weeks before retention.",
    );
  if (
    decision === "retain" &&
    count < 4 &&
    !["set", "olympic_set"].includes(t.kind)
  )
    throw Error(
      "Review early benefit after four comparable exposures; tolerance alone is not benefit.",
    );
  t.reviews.push({ at: now, count, decision, reason });
  if (decision === "remove") {
    t.paused = true;
    t.status = "removed";
  } else if (decision === "pause") t.paused = true;
  else if (decision === "resume") {
    t.paused = false;
    t.status = "testing";
    t.resumedAt = now;
  } else if (decision === "retain") {
    t.status = "retained";
  } else if (decision === "extend") t.reviewAt = count + 4;
}
