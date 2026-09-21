import { DOSE_STAGES } from "./dose.js";
import {
  allLoadedFailure,
  olympicFailure,
  failureReached,
  failureSets,
  failureSetStatus,
  validReps,
  failureProgression,
  adoptFailurePolicy,
  migrateFailurePolicy,
  failureTrialPending,
} from "./failure-policy.js";
import {
  copy,
  defaults,
  dayPlan,
  phaseFor,
  loadRange,
  failure,
  session,
  DAYS,
  restrictions,
  sportEvent,
} from "./prescription.js";
import { timeProfile } from "./duration.js";
import {
  programDays,
  slotOffset,
  slotLabel,
  setSchedule,
  scheduleTrialPending,
} from "./calendar.js";
import { createPacing, closePacing } from "./pacing.js";
import {
  mobilitySteps,
  validMobilityTrace,
  interruptPreparation,
  preparationElapsed,
} from "./routines.js";
export const SCHEMA = 7;
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const chicagoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const localDate = (d = new Date()) => {
  const p = Object.fromEntries(
    chicagoDate.formatToParts(d).map((part) => [part.type, part.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
};
export function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monday(date = localDate()) {
  const d = new Date(date + "T12:00:00Z");
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}
export function fresh(
  date = localDate(),
  schedule = "weekday",
  workSetPolicy = "source",
) {
  const state = {
    schema: SCHEMA,
    version: 0,
    updatedAt: 0,
    training: defaults(),
    weekId: uid(),
    weekStart: monday(date),
    dates: {},
    records: [],
    active: null,
    reviews: [],
    events: [],
    benchReservations: [],
    archives: [],
    readiness: null,
    restEnd: 0,
    completed: false,
  };
  setSchedule(
    state.training,
    schedule,
    Date.parse(state.weekStart + "T12:00:00Z"),
  );
  state.training.workSetPolicy = workSetPolicy;
  if (workSetPolicy === "all-failure")
    adoptFailurePolicy(
      state.training,
      Date.parse(state.weekStart + "T12:00:00Z"),
    );
  return state;
}
export function fingerprint(e) {
  return [
    e.key,
    e.name,
    e.repRange?.join("-") || e.reps,
    e.setup || 0,
    ...(olympicFailure(e)
      ? [e.endpointPolicy, e.validRepRange.join("-"), e.resetSeconds]
      : []),
  ].join("|");
}
const normalContext = (c) =>
  c?.level === "green" &&
  ["normal", "limited_later", "limited_return"].includes(c.event) &&
  sportEvent(c) === "normal" &&
  !c.local &&
  c.recovery === "normal";
export const normal = (r) =>
  normalContext(r.context) &&
  (!r.initialContext || normalContext(r.initialContext)) &&
  (r.readinessChanges || []).every((x) => normalContext(x.context)) &&
  r.followup?.normal === true;
export function successfulRow(r, e) {
  const logs = r.sets.filter((x) => x.key === e.key);
  if (olympicFailure(e))
    return (
      !r.omissions.some((o) => o.key === e.key) &&
      failureSetStatus(e, logs).completedSets === e.sets &&
      !failureSetStatus(e, logs).stop &&
      failureSets(logs).every((set) => validReps(set) > 0) &&
      logs.every((x) => !x.overCap && !["pain", "stop"].includes(x.endpoint))
    );
  return (
    !r.omissions.some((o) => o.key === e.key) &&
    logs.length ===
      (e.kind === "quality"
        ? attempts(e)
        : e.kind === "aerobic"
          ? 1
          : e.sets) &&
    logs.every(
      (x) =>
        !x.overCap &&
        (e.kind === "quality"
          ? x.outcome === "make" &&
            x.grade !== "C" &&
            x.effort <=
              ((slotAt(e, logs.indexOf(x)) === e.sets - 1 && e.finalEffort) ||
                e.effort)
          : e.kind === "failure"
            ? x.endpoint === "failure"
            : e.kind === "speed"
              ? x.quality === "good"
              : e.kind === "mobility"
                ? x.endpoint === "complete"
                : x.minutes === e.minutes),
    )
  );
}
export function attempts(e) {
  return e.repSequence
    ? e.repSequence.reduce((n, r) => n + (typeof r === "number" ? r : 1), 0)
    : e.sets * (typeof e.reps === "number" ? e.reps : 1);
}
export function slotAt(e, index) {
  let offset = 0;
  for (let i = 0; i < e.sets; i++) {
    offset +=
      typeof (e.repSequence?.[i] ?? e.reps) === "number"
        ? (e.repSequence?.[i] ?? e.reps)
        : 1;
    if (index < offset) return i;
  }
  return e.sets - 1;
}
export function nextQualityRange(w, e) {
  const logs = w.sets.filter((x) => x.key === e.key),
    last = logs.at(-1);
  if (olympicFailure(e))
    return logs.length
      ? [logs[0].weight, logs[0].weight]
      : loadRange(e, w.anchors, 0, w.increment);
  if (e.assessment && last) {
    const increase = e.id === "clean" ? 10 : last.effort <= 6 ? 20 : 10;
    return [last.weight, last.weight + increase];
  }
  if (e.test && !e.benchmark && logs.length) {
    const valid =
      last.outcome === "make" && last.grade !== "C" && !last.overCap;
    const anchor = w.anchors[e.anchor],
      step = w.increment;
    if (logs.length === 1 && valid && last.easy === true)
      return [
        Math.floor((anchor * 0.97) / step) * step,
        Math.floor(anchor / step) * step,
      ];
    if (logs.length === 2 && valid)
      return [
        Math.floor(anchor / step) * step,
        Math.floor(anchor / step) * step + step,
      ];
    return [last.weight, last.weight];
  }
  return loadRange(e, w.anchors, slotAt(e, logs.length), w.increment);
}
export function qualityStatus(e, logs) {
  if (olympicFailure(e))
    return { ...failureSetStatus(e, logs), reduceAt: -1, cap: null };
  let consecutiveMiss = 0,
    consecutiveFault = 0,
    lastFault = "",
    reduceAt = -1,
    stop = false,
    reason = "";
  logs.forEach((r, i) => {
    const bad = r.outcome !== "make" || r.grade === "C";
    consecutiveMiss = r.outcome !== "make" ? consecutiveMiss + 1 : 0;
    const fault = r.fault?.trim();
    consecutiveFault =
      bad && fault ? (fault === lastFault ? consecutiveFault + 1 : 1) : 0;
    lastFault = bad ? fault : "";
    if (e.assessment && (bad || r.effort >= 8)) {
      stop = true;
      reason =
        "Assessment ends at effort 8 or the first material error. No retry.";
    }
    if (r.endpoint === "pain" || r.endpoint === "stop") {
      stop = true;
      reason = "Safety stop. Reassess before resuming.";
    }
    if (e.id === "pull" && bad) {
      stop = true;
      reason = "Pull speed or position deteriorated: end the pull.";
    }
    if (reduceAt >= 0 && i > reduceAt && i <= reduceAt + 2 && bad) {
      stop = true;
      reason =
        "Poor attempt after reduction: end this lift. No missed-rep debt.";
    }
    if (reduceAt < 0 && (consecutiveMiss >= 2 || consecutiveFault >= 2))
      reduceAt = i;
  });
  return {
    done: stop || logs.length >= attempts(e),
    stop,
    reduceAt,
    cap: reduceAt >= 0 ? logs[reduceAt].weight * 0.925 : null,
    reason:
      reason ||
      (reduceAt >= 0
        ? "Rest fully; reduce 5–10%. Either of the next two attempts poor: stop."
        : ""),
  };
}
export function rowStatus(w, e) {
  const logs = w.sets.filter((s) => s.key === e.key),
    omission = w.omissions.find((o) => o.key === e.key);
  const q = e.kind === "quality" ? qualityStatus(e, logs) : null;
  const stop =
    logs.some((r) => ["tech", "pain", "stop"].includes(r.endpoint)) ||
    logs.some((r) => r.quality === "stop");
  return {
    logs,
    count: logs.length,
    endpointReached: q?.endpointReached,
    validReps: q?.validReps,
    completedSets: q?.completedSets,
    currentSet: q?.currentSet,
    currentValidReps: q?.currentValidReps,
    planned:
      e.kind === "quality" ? attempts(e) : e.kind === "aerobic" ? 1 : e.sets,
    done:
      !!omission ||
      stop ||
      (q ? q.done : logs.length >= (e.kind === "aerobic" ? 1 : e.sets)),
    reason:
      omission?.reason ||
      q?.reason ||
      (stop ? "Stopped; review the cause before next exposure." : ""),
    cap: q?.cap,
  };
}
export function nextRow(w) {
  return w.session.rows.find((e) => !rowStatus(w, e).done);
}
export function exposureHistory(state, e) {
  return state.records
    .flatMap((r) => {
      const comparableDay =
        e.kind !== "quality" || !e.comparisonDay || r.day === e.comparisonDay;
      const comparableVisit =
        !e.comparisonVisit ||
        (r.session.id === "accessories" ? "second" : "first") ===
          e.comparisonVisit;
      const row =
        comparableDay &&
        comparableVisit &&
        r.session.rows.find((x) => fingerprint(x) === fingerprint(e));
      return row
        ? [
            {
              normal: normal(r),
              record: r,
              sets: r.sets.filter((s) => s.key === row.key),
              row,
            },
          ]
        : [];
    })
    .filter((r) => r.sets.length);
}
// Page 5 estimates apply only to the first base-strength exposure at its entry
// rep range. They are guidance, never an automatically selected work weight.
export function startingEstimate(e) {
  if (e.key === "bench_low")
    return {
      minimum: 3,
      text: "First exposure only (p.5): about 245–250 lb for 3–5 valid reps is an initial estimate from the reported 285 lb bench. Select lower if warm-ups show that maximum is stale; no preliminary max test. Fewer than 3 valid reps means the estimate needs review. Use safe termination, adjust next exposure, and do not add a calibration failure set.",
    };
  if (e.key === e.id && e.repRange?.[0] === 4) {
    const estimate = {
      front_squat: "Front squat 260–265 lb for 4–6 valid reps is provisional.",
      back_squat:
        "Back squat 320–325 lb for 4–6 valid reps is an estimate ONLY if the reported 385 lb used the same high-bar depth/setup. Otherwise choose a conservative familiar high-bar load; do not convert an unknown squat style.",
    }[e.id];
    if (estimate)
      return {
        minimum: 4,
        text: `First exposure only (p.5): ${estimate} Never keep a heavy number just because it is listed. Fewer than 4 valid reps means the estimate needs review. Use safe termination and adjust next exposure; extra calibration sets are not owed.`,
      };
  }
  return null;
}
export function nextLoad(e, history, increment = 2.5) {
  const last = history.at(-1),
    lo = e.repRange[0],
    hi = e.repRange[1];
  if (!last)
    return {
      text:
        startingEstimate(e)?.text ||
        "Choose a conservative familiar load; log the actual endpoint. No calibration failure set is owed.",
    };
  const sets = last.sets,
    weight = sets.at(-1).weight;
  const valid = (r) =>
    r?.normal &&
    r.sets.length === e.sets &&
    r.sets.every((s) => s.endpoint === "failure");
  if (sets.at(-1).endpoint === "failure" && sets.at(-1).reps < lo)
    return {
      weight: weight * 0.925,
      text: "Below the rep window: reduce about 5–10%; keep the prescribed range.",
    };
  if (!valid(last))
    return {
      weight: e.hold || e.checkpoint ? e.heldWeight || weight : weight,
      text: "Hold or reassess. Progression needs complete valid failure sets and confirmed normal next-session recovery.",
    };
  if (sets.some((s) => s.reps < lo))
    return {
      weight,
      text: "The load was already reduced within the last exposure and its final set reached the range. Repeat that load; do not compound the reduction.",
    };
  const special = e.id.endsWith("squat") || e.key === "bench_low";
  // Rep-window correction is explicitly allowed in held weeks, including support trials.
  if (special && sets.every((s) => s.reps > hi))
    return {
      weight: weight + Math.min(5, increment),
      text: "Above the rep window: correct by +2.5–5 lb next eligible exposure. No repeat overshoot needed.",
    };
  if (e.hold || e.checkpoint)
    return {
      weight: e.heldWeight || weight,
      text: "Hold the most recent secure load. Rep-window corrections and reductions remain allowed.",
    };
  const allTop = (r) =>
    r.sets.every((s) => s.reps >= hi && s.weight === weight);
  if (
    allTop(last) &&
    ((e.sets > 1 && !special) ||
      (valid(history.at(-2)) && allTop(history.at(-2))))
  )
    return {
      weight: weight + (special ? Math.min(5, increment) : increment),
      text: "Increase by the smallest available increment; squat/low bench use 2.5–5 lb.",
    };
  return {
    weight,
    text: allTop(last)
      ? "Upper bound once: repeat successfully before increasing."
      : "Keep the load while valid reps build within the target range.",
  };
}
export function benchWindow(state, now = Date.now()) {
  const times = [
    ...state.records,
    ...(state.active ? [state.active] : []),
  ].flatMap((r) =>
    r.sets.filter((s) => s.exerciseId === "bench").map((s) => s.at),
  );
  const pending = [...state.archives],
    seen = new Set();
  while (pending.length) {
    const archive = pending.pop();
    if (!archive || typeof archive !== "object" || seen.has(archive)) continue;
    seen.add(archive);
    const records = [
      ...(Array.isArray(archive.records) ? archive.records : []),
      ...Object.values(archive.log || {}),
      ...(archive.activeWorkout ? [archive.activeWorkout] : []),
      ...(archive.active ? [archive.active] : []),
    ];
    for (const r of records) {
      if (!r || typeof r !== "object") continue;
      const sets = [
        ...(Array.isArray(r.sets) ? r.sets : []),
        ...Object.values(r.setsLogged || {}).flat(),
      ];
      for (const entry of sets) {
        if (
          !entry ||
          !["bench", "bench_press"].includes(entry.exerciseId || entry.exId)
        )
          continue;
        times.push(
          Number(
            entry.at ||
              entry.ts ||
              entry.timestamp ||
              r.endedAt ||
              r.completedAt,
          ) || new Date(r.date + "T23:59:59").getTime(),
        );
      }
    }
    pending.push(
      archive.legacy,
      ...(Array.isArray(archive.legacyArchives) ? archive.legacyArchives : []),
      ...(Array.isArray(archive.archives) ? archive.archives : []),
    );
  }
  const last = Math.max(0, ...times.filter(Number.isFinite));
  return {
    last,
    eligibleAt: last ? last + 48 * 3600000 : 0,
    ready: !last || now >= last + 48 * 3600000,
  };
}
export const weekRecords = (s) =>
  s.records.filter((r) => r.weekId === s.weekId);
export const consumedBench = (s, key) =>
  weekRecords(s).some((r) =>
    r.sets.some((e) => e.benchSlot === key || e.key === key),
  );
export function scheduledDate(s, day) {
  return s.dates[day] || addDays(s.weekStart, slotOffset(s.training, day));
}
export function contextFor(s, now = Date.now()) {
  const r =
    s.readiness?.date === localDate(new Date(now))
      ? copy(s.readiness)
      : {
          date: localDate(new Date(now)),
          level: "unchecked",
          event: "normal",
          local: "",
        };
  r.recovery = s.training.recovery;
  delete r.returnAthletics;
  delete r.verificationPending;
  const lastReturn = s.records.findLast(
    (x) => x.session.kind === "lifting" && x.sets.length,
  );
  if (
    ["normal", "limited_return", "limited_later"].includes(r.event) &&
    lastReturn?.context?.event === "verification" &&
    lastReturn.followup?.normal !== true
  ) {
    r.event = "verification";
    r.verificationPending = true;
  }
  const field = s.records
    .filter((r) => r.session.id.startsWith("athletics") && r.sets.length)
    .sort((a, b) => a.startedAt - b.startedAt);
  let returnIndex = -1;
  for (let i = 1; i < field.length; i++)
    if (field[i].startedAt - field[i - 1].endedAt > 14 * 86400000)
      returnIndex = i;
  r.athleticReturn =
    !!field.length &&
    (now - field.at(-1).endedAt > 14 * 86400000 ||
      (returnIndex >= 0 &&
        field
          .slice(returnIndex)
          .filter(
            (x) =>
              normal(x) && x.session.rows.every((e) => successfulRow(x, e)),
          ).length < 2));
  if (r.athleticReturn) {
    const lastChange = s.reviews.findLast(
      (x) =>
        x.afterAthletics &&
        JSON.stringify(x.afterAthletics) ===
          JSON.stringify(s.training.athletics),
    );
    const a = copy(lastChange?.beforeAthletics || s.training.athletics);
    if (!lastChange) {
      if (
        a.variation !== "none" &&
        a.intensity > (a.variation === "fly" ? 90 : 80)
      )
        a.intensity = a.variation === "fly" ? 90 : 80;
      else if (a.variation !== "none") a.variation = "none";
      else if (a.secondaryRuns > 2) a.secondaryRuns--;
      else if (a.secondaryJumps > 2) a.secondaryJumps--;
      else if (a.secondary > 0) a.secondary--;
      else a.stage = Math.max(0, a.stage - 1);
    }
    a.enabled = s.training.athletics.enabled;
    r.returnAthletics = a;
  }
  r.variation =
    field.filter((x) => x.session.id === "athletics").length % 2 === 0;
  r.athleticDay = s.athleticDay;
  return r;
}
export function planFor(
  s,
  day,
  actual = false,
  now = Date.now(),
  unrestricted = false,
) {
  const observed = contextFor(s, now);
  const context = actual
    ? observed
    : {
        athleticReturn: observed.athleticReturn,
        returnAthletics: observed.returnAthletics,
        variation: observed.variation,
        athleticDay: observed.athleticDay,
      };
  context.restoreCaps = {};
  for (const r of s.records.filter((r) => r.day === day)) {
    const caps = {};
    for (const e of r.session.rows) {
      const complete = successfulRow(r, e);
      caps[e.key] = Math.max(
        1,
        (r.omissions.some((o) => o.key === e.key) ? 0 : e.sets || 1) +
          (complete &&
          r.followup?.normal === true &&
          r.context?.level === "green" &&
          !r.context?.local &&
          ["normal", "limited_return", "limited_later"].includes(
            r.context?.event,
          ) &&
          sportEvent(r.context) === "normal"
            ? 1
            : 0),
      );
    }
    context.restoreCaps[r.session.id] = caps;
  }
  const p = dayPlan(s.training, day, { ...context, deferRestrictions: true });
  for (const session of p.sessions) {
    session.rows = session.rows.filter(
      (e) =>
        e.id !== "bench" ||
        (!consumedBench(s, e.key) &&
          !s.benchReservations.some(
            (b) => b.weekId === s.weekId && b.slot === e.key,
          )),
    );
    // A separately missed low slot takes Friday's place; moderate remains available for rescue.
    if (
      day === "friday" &&
      s.training.week !== 12 &&
      !consumedBench(s, "bench_low")
    ) {
      const b = session.rows.find((e) => e.key === "bench_moderate");
      if (b)
        Object.assign(
          b,
          failure("bench", 1, 3, 5, 270, { key: "bench_low", page: 20 }),
        );
    }
    for (const e of session.rows) {
      if (e.kind === "mobility") continue;
      if (e.kind === "quality") e.comparisonDay = day;
      if (
        e.kind === "failure" &&
        e.key !== "bench_low" &&
        e.key !== "bench_moderate"
      )
        e.comparisonVisit = session.id === "accessories" ? "second" : "first";
      e.checkpoint = [4, 8].includes(s.training.week);
      const trial = s.training.trials.find(
        (t) =>
          !t.paused &&
          (e.trialId === t.id || e.trialIds?.includes(t.id)) &&
          t.resumedAt,
      );
      if (
        trial &&
        s.records.filter(
          (r) =>
            r.startedAt >= trial.resumedAt &&
            normal(r) &&
            r.session.rows.some(
              (x) =>
                (x.trialId === trial.id || x.trialIds?.includes(trial.id)) &&
                fingerprint(x) === fingerprint(e) &&
                successfulRow(r, x),
            ),
        ).length < 2
      ) {
        e.hold = true;
        e.note +=
          " After resuming, hold a secure load for two comparable normal exposures before progressing (p.32).";
      }
      if (olympicFailure(e)) {
        e.hold ||=
          s.training.recovery !== "normal" ||
          !!context.local ||
          ["verification", "larger_later"].includes(context.event);
        const suggestion = failureProgression(
          e,
          exposureHistory(s, e),
          s.training.increment,
        );
        if (suggestion.weight) e.workingLoad = suggestion.weight;
        e.progressionNote = suggestion.text;
        continue;
      }
      if (!(e.hold || e.checkpoint) || e.reduced || e.assessment) continue;
      const hist = exposureHistory(s, e)
        .filter((r) => r.normal && successfulRow(r.record, r.row))
        .at(-1);
      if (!hist) continue;
      if (e.kind === "failure") e.heldWeight = hist.sets.at(-1).weight;
      else
        e.heldLoads = Array.from(
          { length: e.sets },
          (_, i) =>
            hist.sets
              .filter(
                (x, j) =>
                  slotAt(hist.row, j) === Math.min(i, hist.row.sets - 1),
              )
              .at(-1)?.weight,
        );
    }
    if (!session.rows.length) {
      session.skipped = true;
      session.reason ||= "All work already accounted for or deferred.";
    }
  }
  return unrestricted ? p : restrictions(p, s.training, context);
}
export function deferDay(s, day, date) {
  if (
    !DAYS.includes(day) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    addDays(date, 0) !== date ||
    date < scheduledDate(s, day)
  )
    throw Error("Choose a date on or after the current scheduled date.");
  const delta = Math.round(
    (new Date(date + "T12:00:00Z") -
      new Date(scheduledDate(s, day) + "T12:00:00Z")) /
      86400000,
  );
  const order = programDays(s.training);
  for (const d of order.slice(order.indexOf(day))) {
    if (!weekRecords(s).some((r) => r.day === d && r.session.id === "main"))
      s.dates[d] = addDays(scheduledDate(s, d), delta);
  }
}
export function startSession(s, day, id, now = Date.now(), options = {}) {
  if (!DAYS.includes(day)) throw Error("Choose a scheduled program day.");
  if (s.active) throw Error("Finish the active session first.");
  if (s.completed)
    throw Error("The 52-week program is complete. Review the year in History.");
  const ctx = contextFor(s, now);
  if (ctx.level === "unchecked")
    throw Error("Record today’s readiness before starting.");
  let p = planFor(s, day, true, now),
    se = p.sessions.find((x) => x.id === id);
  if (options.rescue) {
    const slot = options.rescue;
    if (!["bench_low", "bench_moderate"].includes(slot))
      throw Error("Choose a prescribed bench slot.");
    if (consumedBench(s, slot))
      throw Error("This bench slot already has an exposure. Do not repeat it.");
    if (slot === "bench_moderate" && !consumedBench(s, "bench_low"))
      throw Error("The low-rep bench slot comes first.");
    if (
      ctx.level !== "green" ||
      ctx.local === "upper" ||
      ctx.noProtection ||
      ctx.event === "unsafe" ||
      sportEvent(ctx) !== "normal"
    )
      throw Error("Bench is deferred until readiness and protection permit.");
    if (s.training.week === 12 && ctx.event === "larger_later")
      throw Error(
        "Taper moderate bench moves after the larger/unfamiliar event.",
      );
    se = session(
      "rescue-" + slot,
      "Deferred " + (slot === "bench_low" ? "low-rep" : "moderate") + " bench",
      [
        failure(
          "bench",
          1,
          ...(slot === "bench_low" ? [3, 5] : [6, 8]),
          slot === "bench_low" ? 270 : 210,
          { key: slot, page: 20 },
        ),
      ],
    );
    const e = se.rows[0];
    e.checkpoint = [4, 8].includes(s.training.week);
    e.hold =
      e.checkpoint ||
      s.training.recovery !== "normal" ||
      ctx.event === "verification";
    const prior = exposureHistory(s, e)
      .filter((r) => r.normal && successfulRow(r.record, r.row))
      .at(-1);
    if (e.hold && prior) e.heldWeight = prior.sets.at(-1).weight;
  } else {
    if (!se || se.skipped) throw Error(se?.reason || "No eligible work.");
    if (weekRecords(s).some((r) => r.day === day && r.session.id === id))
      throw Error(
        "This session is already resolved. Omitted work is not replayed.",
      );
    if (localDate(new Date(now)) < scheduledDate(s, day))
      throw Error(
        "This session is scheduled later. Preserve the rolling sequence and recovery days.",
      );
    if (id === "main") {
      const order = programDays(s.training);
      for (const d of order.slice(0, order.indexOf(day))) {
        const prior = planFor(s, d).sessions.find((x) => x.id === "main");
        if (
          prior &&
          !weekRecords(s).some((r) => r.day === d && r.session.id === "main")
        )
          throw Error(
            `Resolve ${slotLabel(s.training, d)} first; roll the sequence rather than compressing it.`,
          );
      }
    }
    if (id === "accessories") {
      const first = weekRecords(s).find(
        (r) => r.day === day && r.session.id === "main",
      );
      if (!first || now - first.endedAt < 3 * 3600000)
        throw Error(
          "Visit 2 requires visit 1 and at least 3 hours since it ended.",
        );
      if (first.date !== localDate(new Date(now)))
        throw Error(
          "Visit 2 belongs to the same day as visit 1. Later omitted blocks are dropped, never replayed.",
        );
    }
    if (["athletic", "cardio", "mobility"].includes(se.kind)) {
      if (
        se.kind === "athletic" &&
        weekRecords(s).some((r) => r.session.id === id && r.sets.length)
      )
        throw Error(
          "This athletic module was already performed this week; relocation cannot duplicate it.",
        );
      const lifting = planFor(s, day).sessions.filter((x) =>
        ["main", "accessories"].includes(x.id),
      );
      if (
        lifting.some(
          (x) =>
            !weekRecords(s).some((r) => r.day === day && r.session.id === x.id),
        )
      )
        throw Error("Complete priority lifting before optional work.");
    }
  }
  if (se.rows.some((e) => e.id === "bench")) {
    if (!benchWindow(s, now).ready) {
      if (!options.deferBench)
        throw Error(
          `Bench is eligible after ${new Date(benchWindow(s, now).eligibleAt).toLocaleString()}. You can start the other work with bench deferred.`,
        );
      se.rows = se.rows.filter((e) => e.id !== "bench");
      se.note +=
        " Bench deferred for actual 48-hour spacing; rescue only the unperformed bench slot.";
      if (!se.rows.length)
        throw Error("Bench remains deferred; no other work in this session.");
    }
    if (
      s.training.week === 12 &&
      se.rows.some((e) => e.key === "bench_moderate") &&
      !weekRecords(s).some(
        (r) =>
          r.day === "friday" &&
          r.session.id === "main" &&
          ["snatch", "cj"].every((id) =>
            r.sets.some((e) => e.exerciseId === id),
          ),
      )
    )
      throw Error(
        "Complete the Olympic test or technical benchmark before moderate bench.",
      );
  }
  if (
    !options.rescue &&
    id === "main" &&
    localDate(new Date(now)) > scheduledDate(s, day)
  )
    deferDay(s, day, localDate(new Date(now)));
  s.active = {
    id: uid(),
    weekId: s.weekId,
    week: s.training.week,
    cycle: s.training.cycle,
    day,
    date: localDate(new Date(now)),
    startedAt: now,
    session: copy(se),
    originalSession: copy(se),
    baseSession: options.rescue
      ? copy(se)
      : copy(
          planFor(s, day, true, now, true).sessions.find((x) => x.id === id),
        ),
    anchors: copy(s.training.anchors),
    increment: s.training.increment,
    context: ctx,
    timeConfig: {
      workSetPolicy: s.training.workSetPolicy || "source",
      failureEntry: s.training.failureEntry,
      doseVersion: s.training.doseVersion,
      timing: timeProfile(s.training),
      equipment: copy(s.training.equipment),
      anchors: copy(s.training.anchors),
      increment: s.training.increment,
      continuation:
        !!p.sessions.slice(0, p.sessions.indexOf(se)).some((x) => !x.skipped) &&
        (se.kind === "cardio" ||
          (se.kind === "athletic" &&
            s.training.timing?.athleticsVisit === "same")),
    },
    initialContext: copy(ctx),
    sets: [],
    omissions: [],
    preparations: [],
    notes: "",
    warmup: ["mobility", "cardio"].includes(se.kind),
  };
  createPacing(s.active, now);
  s.restEnd = 0;
}
export function omitRow(s, key, reason, now = Date.now()) {
  const w = s.active,
    e = w?.session.rows.find((e) => e.key === key);
  if (!e) throw Error("Exercise not found.");
  if (!reason?.trim()) throw Error("Record why this work was omitted.");
  if (w.mobilityRun?.key === key) {
    w.mobilityPartials ||= [];
    w.mobilityPartials.push({ ...copy(w.mobilityRun), stoppedAt: now, reason });
    w.mobilityRun = null;
  }
  if (w.preparationTimer?.key === key) interruptPreparation(s, now);
  if (w.aerobicRun?.key === key) {
    w.aerobicPartials ||= [];
    w.aerobicPartials.push({
      ...copy(w.aerobicRun),
      stoppedAt: now,
      movingSeconds: preparationElapsed(w.aerobicRun, now),
      reason,
    });
    w.aerobicRun = null;
  }
  if (!w.omissions.some((o) => o.key === key))
    w.omissions.push({ key, reason, at: now });
}
export function startAerobic(s, now = Date.now()) {
  const w = s.active,
    e = w && nextRow(w);
  if (!e || e.kind !== "aerobic") throw Error("No unresolved aerobic work.");
  if (w.aerobicRun) throw Error("Aerobic work is already running.");
  if (w.preparationTimer) throw Error("Finish the running preparation first.");
  w.warmup = true;
  if (!w.preparations.includes(e.key)) w.preparations.push(e.key);
  w.aerobicRun = { key: e.key, startedAt: now, pausedAt: null, pausedMs: 0 };
}
export function pauseAerobic(s, now = Date.now()) {
  const timer = s.active?.aerobicRun;
  if (!timer) throw Error("Start moving time first.");
  if (timer.pausedAt !== null) {
    timer.pausedMs += now - timer.pausedAt;
    timer.pausedAt = null;
  } else timer.pausedAt = now;
}
export function finishAerobic(s, minutes, now = Date.now()) {
  const w = s.active,
    e = w && nextRow(w),
    timer = w?.aerobicRun;
  if (!e || e.kind !== "aerobic") throw Error("No unresolved aerobic work.");
  if (!Number.isFinite(minutes) || minutes < 0.1 || minutes > e.minutes)
    throw Error(
      `Confirm actual moving minutes, from 0.1 to the planned ${e.minutes}.`,
    );
  // An easy start belongs to the moving dose, not an extra lifting warm-up.
  w.warmup = true;
  if (!w.preparations.includes(e.key)) w.preparations.push(e.key);
  const result = logSet(
    s,
    {
      minutes,
      timingMethod: timer ? "timed-confirmed" : "confirmed",
      ...(timer
        ? {
            timerStartedAt: timer.startedAt,
            timerEndedAt: now,
            timedSeconds: preparationElapsed(timer, now),
            pausedSeconds:
              (now - timer.startedAt) / 1000 - preparationElapsed(timer, now),
          }
        : {}),
    },
    now,
  );
  w.aerobicRun = null;
  return result;
}
export function startMobility(s, now = Date.now()) {
  const w = s.active,
    e = w && nextRow(w);
  if (!e || e.kind !== "mobility") throw Error("No unresolved mobility drill.");
  if (w.mobilityRun) throw Error("A mobility drill is already running.");
  if (!w.preparations.includes(e.key)) w.preparations.push(e.key);
  w.mobilityRun = {
    key: e.key,
    index: 0,
    startedAt: now,
    stepStartedAt: now,
    steps: [],
  };
}
export function completeMobilityStep(s, now = Date.now()) {
  const w = s.active,
    run = w?.mobilityRun,
    e = w && nextRow(w);
  if (!run || !e || run.key !== e.key || e.kind !== "mobility")
    throw Error("No active mobility step.");
  const step = mobilitySteps(e)[run.index];
  if (now - run.stepStartedAt < step.seconds * 1000)
    throw Error(
      "Complete this timed hold or rest first; stop if uncomfortable.",
    );
  const steps = [
    ...run.steps,
    {
      title: step.title,
      seconds: step.seconds,
      startedAt: run.stepStartedAt,
      endedAt: now,
    },
  ];
  if (run.index === 7) {
    logSet(
      s,
      {
        holds: 4,
        holdSeconds: e.holdSeconds,
        activeReps: 5,
        endpoint: "complete",
        elapsedSeconds: (now - run.startedAt) / 1000,
        stepLog: steps,
      },
      now,
    );
    w.mobilityRun = null;
    s.restEnd = 0;
  } else {
    run.steps = steps;
    run.index++;
    run.stepStartedAt = now;
  }
}
export function logSet(s, data, now = Date.now()) {
  const w = s.active,
    e = w && nextRow(w);
  if (!e) throw Error("No unresolved work remains.");
  const current = contextFor(s, now);
  if (current.level === "unchecked")
    throw Error("Record today’s readiness before continuing this session.");
  if (
    current.level === "red" ||
    current.event === "unsafe" ||
    ["game", "game_defer"].includes(sportEvent(current))
  )
    throw Error(
      "Current readiness/event defers loaded work. Reassess or end this session.",
    );
  if (
    (e.kind === "failure" || olympicFailure(e)) &&
    (current.level === "amber" ||
      sportEvent(current) === "game_later" ||
      (current.noProtection &&
        ["bench", "front_squat", "back_squat"].includes(e.id)))
  )
    throw Error(
      "This failure set is deferred by current readiness or protection.",
    );
  if (!w.warmup) throw Error("Complete the general warm-up first.");
  if (w.preparationTimer)
    throw Error("Finish the running preparation before logging work.");
  if (!w.preparations.includes(e.key))
    throw Error("Confirm the exercise warm-up, setup and readiness first.");
  const r = { ...data, id: uid(), key: e.key, exerciseId: e.id, at: now };
  if (
    ["quality", "failure"].includes(e.kind) &&
    !(Number.isFinite(r.weight) && r.weight > 0 && r.weight <= 2000)
  )
    throw Error("Enter a valid positive load in pounds.");
  if (e.kind === "failure") {
    if (!Number.isInteger(r.reps) || r.reps < 0 || r.reps > 200)
      throw Error("Enter the actual whole number of completed reps.");
    if (!["failure", "tech", "pain", "stop"].includes(r.endpoint))
      throw Error("Choose an honest endpoint.");
    const estimate = startingEstimate(e);
    if (
      estimate &&
      !exposureHistory(s, e).length &&
      !rowStatus(w, e).count &&
      r.reps < estimate.minimum
    )
      r.reviewFlag = `First-exposure load estimate needs review: fewer than ${estimate.minimum} valid reps. Adjust next exposure; no extra calibration set (p.5).`;
    if (e.id === "bench") {
      if (!benchWindow({ ...s, active: null }, now).ready)
        throw Error("Actual bench spacing is under 48 hours; defer this set.");
      r.benchSlot = e.key;
    }
  }
  if (e.kind === "quality") {
    if (
      !["make", "miss", "clean_miss", "jerk_miss"].includes(r.outcome) ||
      !["A", "B", "C"].includes(r.grade) ||
      !(r.effort >= 1 && r.effort <= 10)
    )
      throw Error("Record outcome, quality grade and technical effort.");
    r.reps = e.id === "cj" ? "1+1" : 1;
    if (
      r.preparation &&
      (!["snatch", "cj", "hang"].includes(e.id) ||
        !(r.weight > w.anchors[e.anchor] * 0.9))
    )
      throw Error(
        "This field records an actual preparation attempt above 90% SN/CJ. Ordinary easy warm-ups are not work sets.",
      );
    if (r.outcome === "make" && r.grade === "C" && !r.fault?.trim())
      throw Error("Record the material fault for a C-quality rep.");
    const logs = rowStatus(w, e).logs,
      slot = slotAt(e, logs.length),
      range = nextQualityRange(w, e),
      effortCap = slot === e.sets - 1 ? e.finalEffort || e.effort : e.effort;
    if (olympicFailure(e)) {
      if (r.preparation)
        throw Error(
          "Warm-ups are separate from this failure set; log working reps only.",
        );
      const progress = failureSetStatus(e, logs);
      r.setNumber = progress.completedSets + 1;
      if (
        progress.completedSets &&
        !progress.current.length &&
        now - logs.at(-1).at < e.rest * 1000
      )
        throw Error(
          "Recover at least 5 minutes before beginning the next Olympic set.",
        );
      r.failurePolicy = e.endpointPolicy;
      r.validRep = r.outcome === "make" && r.grade !== "C";
      r.terminal = !r.validRep && !["pain", "stop"].includes(r.endpoint);
      if (logs.length && r.weight !== logs[0].weight)
        throw Error(
          "Keep the same load within this failure set. End or omit it if a change is needed; no drop sets or retry.",
        );
    }
    const reductionCap = qualityStatus(e, logs).cap;
    r.overCap =
      r.effort > effortCap ||
      !!(range && r.weight > range[1] + 0.001) ||
      !!(reductionCap && r.weight > reductionCap + 0.001);
    // Preserve an honest log, then end unsafe/unprescribed escalation.
    if (r.overCap)
      w.omissions.push({
        key: e.key,
        reason:
          "Recorded effort/load exceeded the current prescription. End this lift and review before the next exposure.",
        at: now,
      });
  }
  if (e.kind === "speed") {
    if (!["good", "stop"].includes(r.quality))
      throw Error("Record speed/landing quality.");
    if (r.seconds != null && (!(r.seconds > 0) || !Number.isFinite(r.seconds)))
      throw Error("Timing must be positive.");
    if (
      e.id === "jump" &&
      r.heights?.length &&
      (r.heights.length !== 3 ||
        r.heights.some((n) => !Number.isFinite(n) || n <= 0))
    )
      throw Error("Record three jump heights, or leave measurement blank.");
    r.reps = e.reps;
    if (["sprint", "fly"].includes(e.id) && r.seconds) {
      const times = rowStatus(w, e)
          .logs.map((x) => x.seconds)
          .filter(Boolean),
        best = Math.min(...times);
      if (
        times.length >= 2 &&
        times.at(-1) > best * 1.03 &&
        r.seconds > best * 1.03
      )
        r.quality = "stop";
    }
  }
  if (e.kind === "aerobic") {
    if (!Number.isFinite(r.minutes) || r.minutes <= 0 || r.minutes > e.minutes)
      throw Error(`Log actual moving minutes, up to the planned ${e.minutes}.`);
    r.reps = r.minutes;
    r.shortened = r.minutes < e.minutes;
  }
  if (e.kind === "mobility") {
    if (
      r.holds !== 4 ||
      r.holdSeconds !== e.holdSeconds ||
      r.activeReps !== 5 ||
      r.endpoint !== "complete" ||
      !validMobilityTrace(e, r.stepLog) ||
      !Number.isFinite(r.elapsedSeconds) ||
      r.elapsedSeconds < 4 * e.holdSeconds + 45
    )
      throw Error(
        "Record four prescribed holds and five active reps, or omit the unfinished drill.",
      );
    r.reps = 5;
  }
  w.sets.push(r);
  const count = rowStatus(w, e).count,
    withinSet =
      e.kind === "quality" &&
      (olympicFailure(e)
        ? !r.terminal && !rowStatus(w, e).done
        : count < attempts(e) && slotAt(e, count - 1) === slotAt(e, count));
  s.restEnd = now + (withinSet ? e.resetSeconds || 15 : e.rest || 0) * 1000;
  if (e.kind === "quality" && rowStatus(w, e).done && e.afterRest)
    s.restEnd = now + e.afterRest * 1000;
  if (["pain", "stop"].includes(r.endpoint)) {
    for (const row of w.session.rows)
      if (!rowStatus(w, row).done)
        w.omissions.push({
          key: row.key,
          reason:
            "Session stopped for pain or unsafe symptoms; reassess readiness.",
          at: now,
        });
  }
  if (e.kind === "speed" && r.quality === "stop")
    for (const row of w.session.rows)
      if (!rowStatus(w, row).done)
        w.omissions.push({
          key: row.key,
          reason: "Athletic quality stop; no conditioning finisher.",
          at: now,
        });
  return r;
}
export function finishSession(s, notes = "", now = Date.now()) {
  const w = s.active;
  if (!w) throw Error("No active session.");
  if (nextRow(w))
    throw Error(
      "Resolve remaining rows, or end early with an omission reason.",
    );
  closePacing(w, now);
  w.notes = notes;
  w.endedAt = now;
  w.status =
    w.omissions.length ||
    w.session.rows.some((e) => {
      const status = rowStatus(w, e);
      return (
        (olympicFailure(e)
          ? !status.endpointReached
          : status.count < status.planned) ||
        status.logs.some(
          (r) =>
            ["tech", "pain", "stop"].includes(r.endpoint) ||
            r.quality === "stop" ||
            r.shortened ||
            r.overCap,
        )
      );
    })
      ? "partial"
      : "complete";
  s.records.push(w);
  for (const e of w.session.rows.filter(
    (e) => e.kind === "quality" && !e.regression,
  )) {
    const eligible = w.sets.filter(
      (r) =>
        r.key === e.key &&
        r.outcome === "make" &&
        r.grade !== "C" &&
        !r.overCap &&
        !r.preparation &&
        ((olympicFailure(e) &&
          s.training.anchors[e.id] &&
          r.weight > s.training.anchors[e.id]) ||
          e.assessment ||
          ((e.id === "jerk" || e.id === "clean") &&
            (e.repSequence?.[
              slotAt(e, w.sets.filter((x) => x.key === e.key).indexOf(r))
            ] ?? e.reps) === 1) ||
          (e.test && !e.benchmark)),
    );
    if (!eligible.length || !["clean", "jerk", "snatch", "cj"].includes(e.id))
      continue;
    const best = eligible.reduce((a, b) => (a.weight > b.weight ? a : b));
    if (e.assessment || best.weight > (s.training.anchors[e.id] || 0)) {
      const previousLoad = s.training.anchors[e.id];
      s.training.anchors[e.id] = best.weight;
      s.reviews.push({
        at: now,
        type: "Demonstrated reference",
        lift: e.id,
        load: best.weight,
        previousLoad,
        date: w.date,
        effort: best.effort,
        video: best.video || "",
        sessionId: w.id,
        notes: e.assessment
          ? "Heaviest valid bounded assessment single."
          : "Valid higher single recorded in the session.",
      });
    }
  }
  s.active = null;
  s.restEnd = 0;
  if (w.session.rows.some((e) => e.assessment)) s.training.assessment = "none";
  migrateFailurePolicy(s);
}
export function deleteSession(s, id) {
  if (s.active)
    throw Error("Finish the active session before deleting saved sessions.");
  const record = s.records.find((r) => r.id === id);
  if (!record) throw Error("This saved session no longer exists.");
  const pending = [s],
    seen = new Set();
  while (pending.length) {
    const journal = pending.pop();
    if (!journal || typeof journal !== "object" || seen.has(journal)) continue;
    seen.add(journal);
    const removed =
      (Array.isArray(journal.records)
        ? journal.records.find((r) => r?.id === id)
        : null) ||
      (journal.active?.id === id ? journal.active : null) ||
      (journal.activeWorkout?.id === id ? journal.activeWorkout : null) ||
      Object.values(journal.log || {}).find((r) => r?.id === id);
    if (removed) {
      // References are a chain: removing an earlier test must not be resurrected
      // if a later session is deleted afterwards. Later manual references win.
      for (const lift of ["snatch", "cj", "clean", "jerk"]) {
        const references = (
          Array.isArray(journal.reviews) ? journal.reviews : []
        ).filter(
          (r) => r?.type === "Demonstrated reference" && r.lift === lift,
        );
        const removedReferences = references.filter((r) => r.sessionId === id);
        if (!removedReferences.length) continue;
        const first = removedReferences[0],
          last = removedReferences.at(-1);
        const previous = Object.hasOwn(first, "previousLoad")
          ? first.previousLoad
          : (removed.anchors?.[lift] ?? defaults().anchors[lift]);
        const next = references
          .slice(references.indexOf(last) + 1)
          .find((r) => r.sessionId !== id);
        if (next) next.previousLoad = previous;
        else if (journal.training?.anchors?.[lift] === last.load)
          journal.training.anchors[lift] = previous;
      }
      if (Array.isArray(journal.records))
        journal.records = journal.records.filter((r) => r?.id !== id);
      if (journal.active?.id === id) journal.active = null;
      if (journal.activeWorkout?.id === id) journal.activeWorkout = null;
      if (journal.log && typeof journal.log === "object")
        for (const [key, value] of Object.entries(journal.log))
          if (value?.id === id) delete journal.log[key];
      if (Array.isArray(journal.reviews))
        journal.reviews = journal.reviews.filter((r) => r?.sessionId !== id);
      if (Array.isArray(journal.benchReservations))
        journal.benchReservations = journal.benchReservations.filter(
          (r) =>
            r?.sessionId !== id &&
            !(
              r?.sessionId === undefined &&
              r?.weekId === removed.weekId &&
              removed.session?.id === "rescue-" + r?.slot &&
              !(journal.records || []).some(
                (other) =>
                  other?.weekId === r.weekId &&
                  other.session?.id === removed.session?.id,
              )
            ),
        );
    }
    pending.push(
      journal.legacy,
      ...(Array.isArray(journal.legacyArchives) ? journal.legacyArchives : []),
      ...(Array.isArray(journal.archives) ? journal.archives : []),
    );
  }
  s.restEnd = 0;
  return { day: record.day, currentWeek: record.weekId === s.weekId };
}
export function stopSession(s, reason, now = Date.now()) {
  if (!reason?.trim()) throw Error("Enter a reason.");
  interruptPreparation(s, now);
  for (const e of s.active.session.rows)
    if (!rowStatus(s.active, e).done) omitRow(s, e.key, reason, now);
  finishSession(s, reason, now);
}
export function benchmark(s) {
  const w = s.active;
  if (!w) throw Error("No active test.");
  if (w.session.rows.some(olympicFailure))
    throw Error(
      "This is already a fixed-load failure benchmark. If warm-ups are insecure, defer the lift; do not turn it into submaximal work.",
    );
  for (const e of w.session.rows.filter((e) => e.test)) {
    e.benchmark = true;
    e.range = [75, 85];
    e.effort = 8;
    e.note =
      "Technical benchmark ≤85%; same three-attempt budget, including existing attempts.";
  }
}
export function easyReturn(s) {
  const w = s.active,
    e = w && nextRow(w);
  if (!e || e.kind !== "quality")
    throw Error("Select the current Olympic lift.");
  if (olympicFailure(e)) {
    omitRow(
      s,
      e.key,
      "Failure work deferred: technical regression or abnormal readiness.",
    );
    return;
  }
  const used = rowStatus(w, e).logs.length,
    remaining = attempts(e) - used;
  // Already logged attempts retain their original slots; new work is bounded singles.
  e.repSequence = Array(used + Math.min(4, remaining)).fill(1);
  e.sets = e.repSequence.length;
  e.reps = e.id === "cj" ? "1+1" : 1;
  e.sequence = null;
  e.range = [50, 60];
  e.workingLoad = null;
  e.heldLoads = null;
  e.finalEffort = null;
  e.effort = Math.min(6, e.effort);
  e.test = false;
  e.assessment = false;
  e.rest = 120;
  for (const row of w.session.rows.filter((x) => x.kind === "failure"))
    omitRow(s, row.key, "Reduced Olympic work remained poor: no failure work.");
}
function nextExposure(s) {
  if (!weekRecords(s).length) return;
  const lastD = weekRecords(s)
    .filter((r) => r.day === "friday" && r.session.id === "main")
    .at(-1);
  s.weekStart = [
    addDays(s.weekStart, 7),
    lastD ? addDays(lastD.date, 3) : s.weekStart,
  ]
    .sort()
    .at(-1);
  s.dates = {};
  s.weekId = uid();
  s.athleticDay = null;
  if (s.training.nextSchedule) setSchedule(s.training, s.training.nextSchedule);
}
export function advanceWeek(s, review, now = Date.now()) {
  if (s.active)
    throw Error("Finish the active session before reviewing the week.");
  if (!review.notes?.trim())
    throw Error("Record your weekly comparison and decision.");
  const t = s.training,
    old = copy(t);
  if (
    review.action === "advance" &&
    review.green &&
    review.recovery === "normal" &&
    (t.recovery === "normal" || (t.recovery === "restore" && review.restored))
  ) {
    for (const day of programDays(t))
      for (const se of dayPlan(t, day).sessions.filter((x) =>
        ["main", "accessories"].includes(x.id),
      ))
        if (
          !weekRecords(s).some((r) => r.day === day && r.session.id === se.id)
        )
          throw Error(
            `Resolve ${slotLabel(t, day)} ${se.id === "accessories" ? "visit 2 " : ""}before advancing (train, defer, or omit with a reason).`,
          );
  }
  if (failureTrialPending(t)) {
    const dose = JSON.stringify([
      t.failureEntry,
      t.doseVersion,
      t.setReductions,
      t.entry,
      phaseFor(t).phase,
      t.recovery,
      t.trials,
      t.athletics,
      t.cardio,
      t.reduceA,
      t.reduceJerk,
      t.lowerDose,
      t.omitPull,
    ]);
    const complete = programDays(t).every((day) =>
      dayPlan(t, day)
        .sessions.filter((se) => ["main", "accessories"].includes(se.id))
        .every((se) =>
          weekRecords(s).some(
            (r) =>
              r.day === day &&
              r.session.id === se.id &&
              r.status === "complete" &&
              r.timeConfig?.workSetPolicy === "all-failure" &&
              r.timeConfig?.doseVersion === t.doseVersion &&
              r.session.rows.length === se.rows.length &&
              se.rows.every((expected) =>
                r.session.rows.some(
                  (actual) =>
                    actual.key === expected.key &&
                    actual.sets === expected.sets &&
                    fingerprint(actual) === fingerprint(expected),
                ),
              ) &&
              normal(r) &&
              r.session.rows.every(
                (e) => e.kind !== "quality" || successfulRow(r, e),
              ),
          ),
        ),
    );
    const green =
      complete &&
      review.green &&
      review.recovery === "normal" &&
      t.recovery === "normal" &&
      ![11, 12, 13].includes(t.week);
    if (!green || t.failureWorkload !== dose) t.failureWeeks = [];
    t.failureWorkload = dose;
    if (
      green &&
      t.failureEntry === DOSE_STAGES &&
      !t.failureWeeks.includes(s.weekId)
    )
      t.failureWeeks.push(s.weekId);
    if (
      green &&
      t.failureEntry < DOSE_STAGES &&
      review.action === "advance" &&
      [1, 2, 3, 5, 6, 7].includes(t.week === 13 ? 1 : t.week + 1)
    )
      t.failureEntry++;
  }
  if (scheduleTrialPending(t)) {
    const comparable = JSON.stringify([
      t.workSetPolicy,
      t.failureEntry,
      t.doseVersion,
      t.setReductions,
      t.entry,
      phaseFor(t).phase,
      t.recovery,
      t.split,
      t.reduceA,
      t.reduceJerk,
      t.lowerDose,
      t.omitPull,
      t.heavy,
      t.athletics,
      t.cardio,
      t.trials
        .filter((x) => !x.paused)
        .map((x) => x.id)
        .sort(),
    ]);
    const acceptable =
      review.scheduleQuality &&
      review.green &&
      review.recovery === "normal" &&
      t.recovery === "normal" &&
      t.entry === 3 &&
      (!allLoadedFailure(t) || t.failureEntry === DOSE_STAGES) &&
      ![11, 12, 13].includes(t.week) &&
      programDays(t).every((day) =>
        dayPlan(t, day)
          .sessions.filter((se) => ["main", "accessories"].includes(se.id))
          .every((se) =>
            weekRecords(s).some(
              (r) =>
                r.day === day &&
                r.session.id === se.id &&
                r.status === "complete",
            ),
          ),
      );
    if (
      !acceptable ||
      (t.scheduleTrial.workload && t.scheduleTrial.workload !== comparable)
    )
      t.scheduleTrial.weeks = [];
    t.scheduleTrial.workload = comparable;
    if (acceptable && !t.scheduleTrial.weeks.includes(s.weekId))
      t.scheduleTrial.weeks.push(s.weekId);
  }
  s.reviews.push({
    ...review,
    at: now,
    weekId: s.weekId,
    week: t.week,
    cycle: t.cycle,
    training: old,
  });
  if (review.recovery !== "normal") {
    t.recovery = review.recovery;
    nextExposure(s);
    return;
  }
  if (t.recovery !== "normal" && t.recovery !== "restore") {
    t.recovery = "restore";
    nextExposure(s);
    return;
  }
  if (t.recovery === "restore" && !review.restored) {
    nextExposure(s);
    return;
  }
  t.recovery = "normal";
  if (review.buildReady && t.gate === "F") t.gate = "B";
  if (review.realizationReady) t.gate = "R";
  if (review.action === "hold" || !review.green) {
    nextExposure(s);
    return;
  }
  if (t.entry < 3) t.entry++;
  if (t.week === 13 && t.cycle === 4) {
    s.completed = true;
    return;
  }
  if (t.week === 13) {
    t.week = 1;
    t.cycle++;
    t.entry = 3;
  } else t.week++;
  t.assessment = "none";
  if (t.week === 12) for (const trial of t.trials) trial.paused = true;
  const from = phaseFor(old).phase,
    to = phaseFor(t).phase;
  if (from !== to && !(from === "B" && to === "R")) t.rackLoad = null;
  nextExposure(s);
}
export function reassessActive(s, now = Date.now()) {
  const w = s.active;
  if (!w) return;
  if (!w.baseSession)
    w.baseSession = copy(
      planFor(s, w.day, true, now, true).sessions.find(
        (x) => x.id === w.session.id,
      ) ||
        w.originalSession ||
        w.session,
    );
  const ctx = contextFor(s, now),
    p = restrictions(
      {
        day: w.day,
        week: w.week,
        cycle: w.cycle,
        sessions: [copy(w.baseSession || w.originalSession || w.session)],
        notes: [],
      },
      s.training,
      ctx,
    ),
    next = p.sessions[0];
  w.context = ctx;
  w.readinessChanges = [
    ...(w.readinessChanges || []),
    { at: now, context: copy(ctx) },
  ];
  for (const e of w.session.rows) {
    if (rowStatus(w, e).done) continue;
    const updated = next.skipped
      ? null
      : next.rows.find((x) => x.key === e.key);
    if (
      !updated ||
      (!olympicFailure(updated) &&
        (updated.kind === "quality" ? attempts(updated) : updated.sets) <=
          rowStatus(w, e).count)
    )
      omitRow(
        s,
        e.key,
        "Omitted after updated readiness/event assessment.",
        now,
      );
    else if (!(e.reduced && !updated.reduced)) {
      if (updated.kind !== "aerobic")
        updated.sets = Math.min(e.sets, updated.sets);
      if (updated.repSequence)
        updated.repSequence = updated.repSequence.slice(0, updated.sets);
      if (updated.sequence)
        updated.sequence = updated.sequence.slice(0, updated.sets);
      Object.assign(e, updated);
    }
  }
}
export function omissionRecord(s, day, id, reason, now = Date.now()) {
  if (!reason?.trim()) throw Error("Record an omission reason.");
  if (s.active) throw Error("Resolve the active session first.");
  if (weekRecords(s).some((r) => r.day === day && r.session.id === id))
    throw Error("Already resolved.");
  const se = planFor(s, day).sessions.find((x) => x.id === id);
  if (!se) throw Error("Session not found.");
  s.records.push({
    id: uid(),
    weekId: s.weekId,
    week: s.training.week,
    cycle: s.training.cycle,
    day,
    date: localDate(new Date(now)),
    startedAt: now,
    endedAt: now,
    session: se,
    anchors: copy(s.training.anchors),
    context: contextFor(s, now),
    sets: [],
    omissions: se.rows.map((e) => ({ key: e.key, reason })),
    notes: reason,
    status: "omitted",
  });
}
export function monitoring(s) {
  const flags = [];
  const records = s.records.filter((r) => r.sets.length);
  const olympic = records.filter((r) => r.sets.some((e) => e.grade));
  const sourceOlympic = olympic.filter(
    (r) => !r.session.rows.some(olympicFailure),
  );
  for (const r of olympic.slice(-1))
    for (const e of r.session.rows.filter(olympicFailure)) {
      const logs = r.sets.filter((x) => x.key === e.key);
      if (
        failureSets(logs).some((set) => failureReached(set) && !validReps(set))
      )
        flags.push(
          `${e.name}: no valid work rep before the endpoint. Review load, technique and recovery before the next exposure.`,
        );
    }
  if (
    !allLoadedFailure(s.training) &&
    sourceOlympic.slice(-2).length === 2 &&
    sourceOlympic.slice(-2).every((r) => {
      const a = r.sets.filter((x) => x.grade);
      return (
        a.filter((x) => x.outcome === "make" && x.grade !== "C" && !x.overCap)
          .length /
          a.length <
        0.9
      );
    })
  )
    flags.push(
      "Olympic good reps below 90% twice: review cause and dose (p.17).",
    );
  if (
    olympic.slice(-2).length === 2 &&
    olympic.slice(-2).every((r) => r.followup?.positions === "altered")
  )
    flags.push(
      "Positions altered twice: review fatigue and remove the identifiable cause.",
    );
  if (
    olympic.slice(-2).length === 2 &&
    olympic.slice(-2).every((r) => r.followup?.loadDrop)
  )
    flags.push(
      "More than 5% less load needed for comparable Olympic quality twice: review cause and dose (p.17).",
    );
  const latestRows = new Map();
  for (const r of records)
    for (const e of r.session.rows.filter(
      (x) => x.kind === "failure" || olympicFailure(x),
    ))
      if (r.sets.some((x) => x.key === e.key)) latestRows.set(e.key, e);
  for (const e of latestRows.values()) {
    const h = exposureHistory(s, e).filter(
        (r) =>
          r.sets.length &&
          (olympicFailure(e)
            ? failureReached(r.sets)
            : r.sets[0].endpoint === "failure"),
      ),
      last = h.at(-1),
      prev = h.at(-2);
    if (!last || !prev) continue;
    const baseline = h
      .slice(0, -2)
      .filter(
        (r) =>
          r.normal &&
          r.sets[0].weight === last.sets[0].weight &&
          r.sets[0].weight === prev.sets[0].weight,
      )
      .at(-1);
    if (
      baseline &&
      [last, prev].every(
        (r) =>
          (olympicFailure(e)
            ? validReps(failureSets(r.sets)[0] || [])
            : r.sets[0].reps) <
          (olympicFailure(e)
            ? validReps(failureSets(baseline.sets)[0] || [])
            : baseline.sets[0].reps) *
            0.8,
      )
    )
      flags.push(
        `${e.name}: first-set reps fell more than 20% twice at the same load/setup.`,
      );
  }
  return flags;
}
export function monitoringTotals(s) {
  const heavy = { snatch: 0, cj: 0 };
  const jumpMeans = [];
  for (const r of s.records) {
    for (const x of r.sets) {
      const id = ["snatch", "hang"].includes(x.exerciseId)
        ? "snatch"
        : x.exerciseId === "cj"
          ? "cj"
          : null;
      if (id && r.anchors?.[id] && x.weight > r.anchors[id] * 0.9) heavy[id]++;
    }
    const measured = r.sets.find(
      (x) =>
        x.exerciseId === "jump" &&
        x.heights?.length === 3 &&
        x.quality === "good",
    );
    if (measured && normal(r))
      jumpMeans.push({
        date: r.date,
        mean: measured.heights.reduce((n, h) => n + h, 0) / 3,
      });
  }
  return { heavy, jumpMeans };
}
