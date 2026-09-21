import { olympicFailure } from "./failure-policy.js";
// Planning allowances, not training prescriptions. Ranges are seconds throughout.
// Source doses/rests: Revision 6 pp.8–9, 13–14, 19, 21–22, 27, 29.
export const TIME_DEFAULTS = Object.freeze({
  traffic: "moderate",
  breakMinutes: 10,
  plateSeconds: 45,
  stationSeconds: 90,
  extraRestSeconds: 0,
  athleticsVisit: "separate",
  unilateralCable: true,
});
export const TIME_LABELS = {
  setup: "Equipment setup, travel & first load",
  waiting: "Waiting for equipment",
  recovery: "Recovery before this exercise",
  ramp: "Specific warm-up reps & ramp rests",
  work: "Work reps & within-set resets",
  rest: "Rest between work sets",
  handling: "Loading / logging beyond those rests",
};
const pair = (x) => (Array.isArray(x) ? x : [x, x]);
const add = (...xs) =>
  xs.reduce((a, x) => a.map((n, i) => n + pair(x)[i]), [0, 0]);
const mul = (x, n) => pair(x).map((v) => v * n);
const max = (a, b) => pair(a).map((v, i) => Math.max(v, pair(b)[i]));
const beyond = (a, b) => pair(a).map((v, i) => Math.max(0, v - pair(b)[i]));
const scaled = (n) => [(n * 2) / 3, (n * 4) / 3];
const total = (parts) => add(...Object.values(parts));
export const timeProfile = (config = {}) => ({
  ...TIME_DEFAULTS,
  ...config.timing,
});
export function validTimeProfile(t) {
  return (
    !!t &&
    typeof t === "object" &&
    !Array.isArray(t) &&
    ["quiet", "moderate", "busy"].includes(t.traffic) &&
    ["separate", "same"].includes(t.athleticsVisit) &&
    typeof t.unilateralCable === "boolean" &&
    [
      ["breakMinutes", 0, 60],
      ["plateSeconds", 0, 300],
      ["stationSeconds", 0, 600],
      ["extraRestSeconds", 0, 300],
    ].every(([k, lo, hi]) => Number.isFinite(t[k]) && t[k] >= lo && t[k] <= hi)
  );
}
export function minutesText(seconds) {
  const values = pair(seconds),
    value = Math.round((values[0] + values[1]) / 2);
  return `${Math.floor(value / 60)} min${value % 60 ? ` ${value % 60} s` : ""}`;
}
export function family(e) {
  if (["snatch", "hang"].includes(e.id)) return "snatch";
  if (["cj", "clean"].includes(e.id)) return "cj";
  if (["jerk", "pause_jerk"].includes(e.id)) return "jerk";
  return e.id;
}
function station(e, c) {
  if (["hammer_curl", "wrist_curl", "wrist_extension"].includes(e.id))
    return "dumbbell-bench";
  if (e.kind === "mobility") return "mobility";
  if (e.kind === "speed") return "field";
  if (e.kind === "aerobic") return e.key === "aerobic_walk" ? "walk" : "cardio";
  if (["snatch", "hang", "cj", "clean", "pull"].includes(e.id))
    return "platform";
  if (["jerk", "pause_jerk", "front_squat", "back_squat"].includes(e.id))
    return "rack";
  if (
    ["curl", "triceps"].includes(e.id) ||
    (e.id === "lateral" && c.equipment?.lateral !== "db") ||
    (e.id === "crunch" && c.equipment?.crunch === "cable")
  )
    return "cable";
  return e.id;
}
export function workSet(e, slot, p, c) {
  if (e.kind === "mobility")
    return [4 * e.holdSeconds + 15, 4 * e.holdSeconds + 25];
  if (e.kind === "aerobic") return pair(e.minutes * 60);
  if (e.id === "jump") return [26, 32]; // 3 jumps + two 10-second resets.
  if (e.id === "sprint") return [3, 7];
  if (e.id === "fly") return [5, 9]; // Includes the 20 m run-in.
  if (e.id === "cut") return [26, 42]; // Both sides, with a 20–30 s reset.
  if (e.kind === "failure") {
    const [lo, hi] = e.repRange;
    const barbell = ["bench", "front_squat", "back_squat"].includes(e.id);
    const tempo = e.id === "calf" || barbell ? [4, 5] : [3, 4];
    const sides =
      e.id === "lateral" && c.equipment?.lateral !== "db" && p.unilateralCable
        ? 2
        : 1;
    return add(
      [lo * tempo[0] * sides, hi * tempo[1] * sides],
      barbell ? [15, 25] : sides === 2 ? [15, 25] : [5, 10],
    );
  }
  const r = e.repSequence?.[slot] ?? e.reps;
  const n = typeof r === "number" ? r : 1;
  if (e.regression && !e.range) return add(mul([5, 8], n), [10, 20]);
  const per =
    e.id === "cj"
      ? [25, 40]
      : e.id === "pull"
        ? [4, 7]
        : ["jerk", "pause_jerk"].includes(e.id)
          ? [10, 18]
          : [12, 20];
  const resets = olympicFailure(e)
    ? pair(e.resetSeconds)
    : e.id === "pull"
      ? [2, 4]
      : family(e) === "jerk"
        ? [10, 30]
        : [10, 20];
  const pause =
    e.key?.endsWith("_pause") || e.id === "pause_jerk" || e.id === "hang"
      ? n * 2
      : 0;
  return add(mul(per, n), mul(resets, Math.max(0, n - 1)), pause);
}
function ramp(e, previous, p, c) {
  if (!["failure", "quality"].includes(e.kind)) return [0, 0];
  const change = scaled(p.plateSeconds);
  const stage = (work, rest) => add(work, max(rest, change));
  // Adjacent continuation rows (a substitution or balance regression) are already warm.
  // Allow a brief ascending rehearsal and recovery if the next target is heavier.
  if (previous && family(previous) === family(e)) {
    const target = (r) =>
      r.workingLoad ||
      r.heldWeight ||
      r.heldLoads?.[0] ||
      ((r.range?.[1] || 0) * (c.anchors?.[r.anchor] || 1)) / 100;
    const a = target(previous),
      b = target(e);
    return b > a ? stage([10, 25], [60, 120]) : [0, 0];
  }
  if (e.kind === "failure") {
    if (["front_squat", "back_squat", "bench"].includes(e.id)) {
      const bench = e.id === "bench",
        low = bench && e.repRange[0] <= 3;
      const reps = bench ? [10, 6, 3, 1, ...(low ? [1] : [])] : [5, 5, 3, 1];
      let result = add(
        ...reps.map((n, i) =>
          stage(
            add(mul([3, 4], n), [10, 15]),
            i === reps.length - 1 ? 180 : [60, 120],
          ),
        ),
      );
      // Optional 90% squat ramp is in the upper planning allowance only.
      if (!bench) result[1] += stage([13, 19], [60, 120])[1];
      return result;
    }
    if (e.id === "incline")
      return add(stage([29, 42], [60, 90]), stage([17, 26], [60, 90]));
    const sides =
      e.id === "lateral" && c.equipment?.lateral !== "db" && p.unilateralCable
        ? 2
        : 1;
    return stage(
      add(mul([18, 32], sides), sides === 2 ? [15, 25] : [5, 10]),
      [60, 90],
    );
  }
  if (e.regression && !e.range) return stage([30, 60], [60, 90]);
  if (e.id === "pull")
    return [
      stage([18, 30], [60, 90])[0],
      add(stage([18, 30], [60, 90]), stage([18, 30], [60, 90]))[1],
    ];
  if (family(e) === "jerk") {
    // Assessment substitutes 75% for the usual final 80% stage; same rep count.
    return add(
      stage([35, 55], [60, 120]),
      stage([30, 54], [60, 120]),
      stage([20, 36], [60, 120]),
      stage([10, 18], [120, 180]),
    );
  }
  const cj = family(e) === "cj",
    reference = c.anchors?.[cj ? "cj" : "snatch"];
  let target = e.sequence?.[0] || e.range || [40, 60];
  const actual = e.heldLoads?.[0] || e.workingLoad;
  if (actual && reference) target = pair((actual / reference) * 100);
  return [0, 1].map((end) => {
    const pct = target[end];
    const stages = [
      [40, cj ? 2 : 3],
      [50, cj ? 1 : 2],
      [60, 1],
      ...(pct >= 75 ? [[70, 1]] : []),
      ...(pct >= 85 ? [[80, 1]] : []),
    ].filter(([v]) => {
      if (!reference) return v < pct;
      const increment = c.increment || 5;
      const round = (v) =>
        Math.floor((reference * v) / 100 / increment + 1e-8) * increment;
      return round(v) < round(pct);
    });
    const early = cj ? [60, 120] : [45, 90],
      late = cj ? [120, 180] : [120, 120];
    let seconds = stage(
      cj ? [90, 150] : [75, 120],
      stages.length ? early : late,
    )[end];
    for (let i = 0; i < stages.length; i++) {
      const [pct, n] = stages[i];
      const reps = add(mul(cj ? [20, 30] : [8, 14], n), mul([5, 10], n - 1));
      seconds += stage(
        reps,
        pct >= 60 || i === stages.length - 1 ? late : early,
      )[end];
    }
    return seconds;
  });
}
export function estimateSession(session, config = {}, options = {}) {
  const p = timeProfile(config),
    rows = [],
    eligible = !session.skipped && session.rows.length;
  const overhead = {
    arrival: [0, 0],
    general: [0, 0],
    transition: [0, 0],
    breaks: [0, 0],
    departure: [0, 0],
  };
  if (!eligible) return { rows, overhead, seconds: [0, 0], profile: p };
  const ownVisit = !options.continuation && session.kind !== "mobility";
  if (ownVisit) {
    overhead.arrival = session.kind === "cardio" ? [60, 120] : [180, 300];
    overhead.departure = session.kind === "cardio" ? [60, 120] : [120, 240];
    overhead.breaks = pair(p.breakMinutes * 60);
  }
  overhead.general =
    session.kind === "lifting"
      ? session.id === "support" && options.continuation
        ? [0, 0]
        : session.id === "accessories"
          ? [180, 300]
          : [600, 900]
      : session.kind === "athletic"
        ? [540, 780]
        : [0, 0];
  if (session.kind === "athletic" && options.continuation)
    overhead.transition = [300, 300];
  let previous;
  for (const e of session.rows) {
    const parts = Object.fromEntries(
      Object.keys(TIME_LABELS).map((k) => [k, [0, 0]]),
    );
    if (e.kind === "mobility") {
      parts.setup = [30, 60];
      parts.work = workSet(e, 0, p, config);
      parts.rest = [45, 45];
      rows.push({
        key: e.key,
        name: e.name,
        parts,
        seconds: total(parts),
        station: "mobility",
      });
      previous = e;
      continue;
    }
    const newStation =
      !previous || station(previous, config) !== station(e, config);
    const loaded = ["quality", "failure"].includes(e.kind);
    parts.setup =
      e.kind === "aerobic"
        ? e.key === "aerobic_walk"
          ? [30, 60]
          : [30, 120]
        : e.kind === "speed"
          ? newStation
            ? [60, 120]
            : [15, 30]
          : add(
              newStation ? scaled(p.stationSeconds) : [15, 30],
              scaled(p.plateSeconds),
            );
    if (newStation && loaded)
      parts.waiting = { quiet: [0, 60], moderate: [60, 180], busy: [180, 300] }[
        p.traffic
      ];
    // Main aerobics permits a walk or a bike: allow for bike setup/queuing at
    // the upper end. Additional prescribed walks have no equipment queue.
    if (e.kind === "aerobic" && e.key !== "aerobic_walk")
      parts.waiting = [0, { quiet: 60, moderate: 180, busy: 300 }[p.traffic]];
    // Walking, changing weights and logging can occur during recovery. Count only
    // the remainder of recovery after that transition, not the same minutes twice.
    parts.ramp = ramp(e, previous, p, config);
    if (previous) parts.setup = add(parts.setup, [15, 25]);
    // Work-set rests are between sets, not an extra full rest before another
    // exercise's warm-up. Continuation rows and field work still recover fully.
    // The mock-meet interval explicitly precedes the CJ ramp (p.19).
    if (
      previous &&
      previous.kind !== "aerobic" &&
      (previous.recoveryAfter ||
        previous.afterRest ||
        !parts.ramp[1] ||
        family(previous) === family(e))
    ) {
      const recovery = previous.recoveryAfter
        ? pair(previous.recoveryAfter + p.extraRestSeconds)
        : previous.afterRest
          ? [480, 600]
          : pair((previous.rest || 0) + p.extraRestSeconds);
      const setup = parts.setup;
      parts.recovery = recovery;
      parts.setup = beyond(setup, recovery);
      parts.waiting = beyond(add(setup, parts.waiting), recovery).map(
        (n, i) => n - parts.setup[i],
      );
    }
    if (!previous && e.entryRecovery) parts.recovery = pair(e.entryRecovery);
    const sets = e.kind === "aerobic" ? 1 : e.sets;
    parts.work = add(
      ...Array.from({ length: sets }, (_, i) => workSet(e, i, p, config)),
    );
    const rests = Math.max(0, sets - 1),
      rest = (e.rest || 0) + p.extraRestSeconds;
    parts.rest = pair(rests * rest);
    // Logging and a possible plate/stack adjustment share the programmed rests.
    // The final log is covered by the next transition or departure allowance.
    parts.handling = mul(
      beyond(
        add(
          [15, 25],
          loaded ? scaled(p.plateSeconds) : e.kind === "speed" ? [15, 30] : 0,
        ),
        rest,
      ),
      rests,
    );
    rows.push({
      key: e.key,
      name: e.name,
      parts,
      seconds: total(parts),
      station: station(e, config),
    });
    previous = e;
  }
  return {
    rows,
    overhead,
    seconds: add(total(overhead), ...rows.map((r) => r.seconds)),
    profile: p,
  };
}
export function estimateDay(plan, config = {}) {
  const p = timeProfile(config),
    sessions = [];
  let visits = 0,
    gaps = 0,
    hasVisit = false;
  for (const s of plan.sessions) {
    const continuation =
      hasVisit &&
      (s.id === "support" ||
        s.kind === "cardio" ||
        s.kind === "mobility" ||
        (s.kind === "athletic" && p.athleticsVisit === "same"));
    const estimate = estimateSession(s, config, { continuation });
    if (estimate.seconds[1]) {
      if (!continuation) {
        if (hasVisit && (s.id === "accessories" || s.kind === "athletic"))
          gaps += 180 * 60;
        visits++;
      }
      hasVisit = true;
    }
    sessions.push({ id: s.id, ...estimate });
  }
  const mobilitySession = sessions.find((s) => s.id === "mobility");
  const mobilityRows = mobilitySession
    ? mobilitySession.rows.map((r) => ({
        description: plan.sessions
          .find((s) => s.id === "mobility")
          .rows.find((e) => e.key === r.key).note,
        seconds: r.seconds,
      }))
    : (plan.mobility || []).map((description) => ({
        description,
        seconds: [
          4 * (config.mobilitySeconds || 30) + 45 + 15 + 30,
          4 * (config.mobilitySeconds || 30) + 45 + 25 + 60,
        ],
      }));
  const mobility = add(...mobilityRows.map((r) => r.seconds));
  const seconds = add(
    mobilitySession ? 0 : mobility,
    ...sessions.map((s) => s.seconds),
  );
  return {
    sessions,
    mobility,
    mobilityRows,
    seconds,
    visits,
    gapSeconds: gaps,
    elapsed: add(seconds, gaps),
    profile: p,
  };
}
