// Guided optional training. The same dose mutation and eligibility checks power
// preview and save; viewing a proposal never changes the journal.
import { copy, dayPlan, athleticDose } from "./prescription.js";
import { allLoadedFailure, failureTrialPending } from "./failure-policy.js";
import { DOSE_STAGES } from "./dose.js";
import { programDays, scheduleTrialPending } from "./calendar.js";
import {
  scheduledDate,
  normal,
  successfulRow,
  planFor,
  contextFor,
} from "./training.js";
import { OPTIONAL_KINDS, applyChange, changeOptionalDose } from "./review.js";
import { fixedDay } from "./timeline.js";

export const optionalKind = (kind) => OPTIONAL_KINDS.includes(kind);
const athleticKind = (kind) => optionalKind(kind) && !kind.startsWith("cardio");
export const secondaryKind = (kind) =>
  [
    "athletic_second",
    "athletic_runs",
    "secondary_jump",
    "secondary_run",
  ].includes(kind);
export function doseText(a, secondary = false) {
  if (!a.enabled || (secondary && !a.secondary)) return "Not added";
  const d = secondary
    ? {
        jumps: a.secondaryJumps,
        runs: a.secondary >= 2 ? a.secondaryRuns : 0,
        meters: 10,
        effort: "85–90%",
      }
    : athleticDose(a.stage);
  const varied =
    !secondary && a.variation !== "none" && d.runs >= 4 && d.meters === 20;
  return (
    `${d.jumps} sets of 3 jumps (${d.jumps * 3} total)` +
    (d.runs
      ? `; ${d.runs} × ${d.meters} m runs at ${d.effort} effort`
      : "; no runs yet") +
    (varied
      ? `; on alternate sessions replace the last two runs with ${a.variation === "fly" ? "2 flying 10 m runs" : "2 sets of cuts, once each side"} at ${a.intensity}%`
      : "")
  );
}
export function changeLabel(t, kind) {
  const a = t.athletics,
    d = athleticDose(a.stage),
    next = athleticDose(a.stage + 1);
  const step =
    next.jumps !== d.jumps
      ? "Add 3 jumps to the main session"
      : next.meters !== d.meters
        ? `Extend the runs to ${next.meters} m`
        : next.effort !== d.effort
          ? "Increase running effort to 90–95%"
          : "Add 1 run to the main session";
  return {
    athletic_start:
      a.stage || a.secondary || a.variation !== "none"
        ? "Resume athletics at the saved dose"
        : "Start jumps & short runs",
    athletic_step: step,
    athletic_second: "Add a second day: 6 jumps only",
    athletic_runs: "Add 2 × 10 m runs to the second day",
    secondary_jump: "Add 3 jumps to the second day",
    secondary_run: "Add 1 run to the second day",
    fly: "Replace 2 runs with flying 10 m runs",
    cut: "Replace 2 runs with change-of-direction practice",
    variation_intensity: `Increase ${a.variation === "fly" ? "flying-run effort to 95%" : "cutting effort to 90%"}`,
    cardio_start: "Start two 20-minute walks or easy rides",
    cardio_step: `Add ${t.cardio.minutes < 60 ? 5 : 10} aerobic minutes per week`,
  }[kind];
}
export function nextOptionalChange(t, domain) {
  return domain === "cardio"
    ? t.cardio.enabled
      ? t.cardio.minutes < 300
        ? "cardio_step"
        : null
      : "cardio_start"
    : t.athletics.enabled
      ? t.athletics.stage < 50
        ? "athletic_step"
        : null
      : "athletic_start";
}
export function athleticAlternatives(t) {
  const a = t.athletics;
  if (!a.enabled) return [];
  return [
    ...(!a.secondary
      ? ["athletic_second"]
      : a.secondary === 1
        ? ["athletic_runs", "secondary_jump"]
        : ["secondary_jump", "secondary_run"]),
    ...(a.stage >= 7 ? ["fly", "cut"].filter((k) => k !== a.variation) : []),
    ...(a.variation !== "none" &&
    a.intensity < (a.variation === "fly" ? 95 : 90)
      ? ["variation_intensity"]
      : []),
  ];
}
export function weekdayFor(s, day) {
  return new Date(scheduledDate(s, day) + "T12:00:00Z").toLocaleDateString(
    "en-US",
    { weekday: "long", timeZone: "UTC" },
  );
}
export function introductionStatus(s) {
  const t = s.training;
  if (failureTrialPending(t)) {
    if (t.failureEntry < DOSE_STAGES)
      return {
        title: `Build up your lifting first · ${t.failureEntry} of ${DOSE_STAGES}`,
        text: "Finish this week, save the next-session recovery checks in History, then complete Weekly review. A complete week with normal lifting and recovery can advance the build-up. After the full workload is established, repeat it for two reviewed weeks before adding training.",
        action: "review",
      };
    return {
      title: `Confirm the full lifting workload · ${Math.min(2, t.failureWeeks.length)} of 2 weeks reviewed`,
      text: "Keep the workload steady. Save normal next-session recovery checks in History and complete Weekly review. Both full weeks must have normal lifting and recovery; a shortened or disrupted week does not count.",
      action: "review",
    };
  }
  if (scheduleTrialPending(t))
    return {
      title: `Check the new schedule · ${t.scheduleTrial.weeks.length} of 2 weeks reviewed`,
      text: "Keep the workload steady for two complete weeks. Compare the following Olympic sessions and save the Weekly review.",
      action: "review",
    };
  if (!allLoadedFailure(t) && t.entry < 3)
    return {
      title: `Build up your lifting first · ${t.entry} of 3`,
      text: "Complete the lifting build-up and two weeks with normal performance and recovery before adding training. Use Weekly review to record progress.",
      action: "review",
    };
  return {
    title: "Choose one useful change",
    text: "Keep the current plan if it is working. If several changes are useful, prioritize Olympic lifting or muscle development, then athletics, then extra aerobic work. You do not need to add every option.",
    action: null,
  };
}

function athleticSignature(rows) {
  return JSON.stringify(
    rows.map((e) => [e.id, e.sets, e.reps, e.effort || null]),
  );
}
// Count the changed session, not unrelated workouts or shortened return sessions.
export function athleticProgress(s, change = null) {
  const last =
    change ||
    s.reviews.findLast((r) => r.type === "change" && r.afterAthletics);
  const id = secondaryKind(last?.change.kind)
    ? "athletics-secondary"
    : "athletics";
  const t = copy(s.training);
  t.week = 5;
  t.recovery = "normal";
  const athleticSession = (context = {}) =>
    programDays(t)
      .flatMap((day) => dayPlan(t, day, context).sessions)
      .find((se) => se.id === id);
  const expected = athleticSession();
  const good = s.records.filter(
    (r) =>
      r.session.kind === "athletic" &&
      r.status === "complete" &&
      r.session.rows.length &&
      normal(r) &&
      r.session.rows.every((e) => successfulRow(r, e)),
  );
  const variationChange = ["fly", "cut", "variation_intensity"].includes(
    last?.change.kind,
  );
  const plain = athleticSession({ variation: false });
  const comparable = good.filter(
    (r) =>
      r.session.id === id &&
      r.startedAt >= (last?.at || 0) &&
      expected &&
      (athleticSignature(r.session.rows) === athleticSignature(expected.rows) ||
        (!variationChange &&
          plain &&
          athleticSignature(r.session.rows) === athleticSignature(plain.rows))),
  );
  return {
    count: comparable.length,
    totalPrimary: good.filter((r) => r.session.id === "athletics").length,
    session:
      id === "athletics" ? "main athletic session" : "second athletic session",
  };
}
export function observation(s) {
  const last = s.reviews.findLast(
    (r) => r.type === "change" && optionalKind(r.change?.kind),
  );
  if (
    !last ||
    s.reviews.some(
      (r) => r.at >= last.at && r.type === "Reverse interfering addition",
    )
  )
    return null;
  const laterDose = s.reviews.some(
    (r) => r.at > last.at && r.type === "change",
  );
  if (laterDose) return null;
  if (athleticKind(last.change.kind)) {
    const p = athleticProgress(s, last);
    return {
      ...p,
      required: 2,
      unit: "successful sessions",
      text: `${Math.min(2, p.count)} of 2 successful ${p.session}s since the last change. Complete all jumps/runs with good quality, then confirm normal recovery at the following lifting session in History.`,
      complete: p.count >= 2,
      action: "history",
    };
  }
  const weeks = [
    ...new Map(
      s.reviews
        .filter((r) => r.training && r.weekId && r.at > last.at)
        .map((r) => [r.weekId, r]),
    ).values(),
  ];
  let count = 0;
  for (const r of weeks) {
    if (
      r.green &&
      r.recovery === "normal" &&
      r.training.recovery === "normal" &&
      r.training.cardio.enabled &&
      r.training.cardio.minutes === s.training.cardio.minutes
    )
      count++;
    else count = 0;
  }
  return {
    count,
    required: 2,
    unit: "reviewed weeks",
    text: `${Math.min(2, count)} of 2 weeks reviewed since the aerobic change. Keep the workload steady and confirm normal lifting, athletic quality and recovery in Weekly review.`,
    complete: count >= 2,
    action: "review",
  };
}
export function optionalStatus(s, kind, now = Date.now()) {
  if (!optionalKind(kind))
    return { allowed: false, reason: "Choose a listed training change." };
  const intro = introductionStatus(s);
  if (failureTrialPending(s.training) || scheduleTrialPending(s.training))
    return {
      allowed: false,
      reason: `${intro.title}. ${intro.text}`,
      action: intro.action,
    };
  const pending = observation(s);
  if (pending && !pending.complete)
    return { allowed: false, reason: pending.text, action: pending.action };
  if (kind === "athletic_second" && athleticProgress(s).totalPrimary < 4)
    return {
      allowed: false,
      reason: `${athleticProgress(s).totalPrimary} of 4 successful main athletic sessions recorded. Confirm their next-session recovery in History before adding a second day.`,
      action: "history",
    };
  try {
    applyChange(
      copy(s),
      {
        kind,
        reason: "Preview only",
        ready: true,
        stable: true,
        fourPrimary: true,
        fullCycle: true,
      },
      now,
    );
    return {
      allowed: true,
      reason:
        "Review the proposed workout and confirm that performance and recovery stayed normal.",
    };
  } catch (e) {
    let reason = e.message,
      action = null;
    if (reason.includes("not eligible"))
      reason = `Week ${s.training.week} holds new additions. Keep established work during checkpoints (4/8), Realization (9–11), taper (12) and the recovery week (13). Additions resume in a normal Foundation or Build week after the lifting build-up.`;
    if (
      reason.includes("two green weeks") ||
      reason.includes("Normally introduce")
    ) {
      reason =
        "Record two weeks with normal lifting and recovery at the same workload in Weekly review before starting athletics. Changing the workload restarts that observation period.";
      action = "review";
    }
    if (reason.includes("existing controlled trial")) {
      reason =
        "Review the extra set or exercise change already in progress before adding another kind of training.";
      action = "trials";
    }
    if (reason.includes("current session")) {
      reason =
        "Finish or save your open workout first so it keeps the prescription you started with.";
      action = "resume";
    }
    if (reason.includes("successful comparable exposures")) {
      reason =
        "Repeat the current athletic workout twice with good quality and normal next-session recovery. Save those recovery checks in History.";
      action = "history";
    }
    return { allowed: false, reason, action };
  }
}
export function optionalPreview(s, kind, now = Date.now()) {
  const proposed = copy(s);
  changeOptionalDose(proposed.training, {
    kind,
    fourPrimary: true,
    fullCycle: true,
  });
  if (athleticKind(kind))
    proposed.reviews.push({
      at: now,
      type: "change",
      change: { kind },
      beforeAthletics: copy(s.training.athletics),
      afterAthletics: copy(proposed.training.athletics),
    });
  const days = programDays(s.training).flatMap((day) => {
    const before = planFor(s, day, false, now, false, true),
      after = planFor(proposed, day, false, now, false, true);
    const relevant = (p) =>
      p.sessions.filter(
        (se) => se.kind === (athleticKind(kind) ? "athletic" : "cardio"),
      );
    if (JSON.stringify(relevant(before)) === JSON.stringify(relevant(after)))
      return [];
    const oldTime = fixedDay(before, s.training),
      newTime = fixedDay(after, proposed.training);
    return [
      {
        day,
        label: weekdayFor(s, day),
        date: scheduledDate(s, day),
        sessions: relevant(after),
        beforeSeconds: oldTime.seconds[0],
        afterSeconds: newTime.seconds[0],
        addedSeconds: newTime.seconds[0] - oldTime.seconds[0],
      },
    ];
  });
  return {
    training: proposed.training,
    days,
    unchangedReason:
      s.training.week !== 12 &&
      ["fly", "cut", "variation_intensity"].includes(kind) &&
      contextFor(s, now).variation === false
        ? "Your next main athletic session keeps the ordinary runs. This replacement applies on the following alternating session; it does not add runs to the weekly total."
        : "This week’s phase temporarily omits this work. The saved dose resumes when the program permits it.",
  };
}
export function applyGuidedChange(s, change, now = Date.now()) {
  const status = optionalStatus(s, change.kind, now);
  if (!status.allowed) throw Error(status.reason);
  if (!change.confirmed)
    throw Error(
      "Confirm the performance and recovery check before adding this work.",
    );
  applyChange(
    s,
    { ...change, ready: true, stable: true, fourPrimary: true },
    now,
  );
}
