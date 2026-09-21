import { olympicFailure } from "./failure-policy.js";
import { estimateSession, timeProfile, family, workSet } from "./duration.js";
import { mobilitySteps } from "./routines.js";

// Exact planning targets, not measured execution times or new training doses.
export const targetSeconds = (value) => {
  const n = Array.isArray(value) ? (value[0] + value[1]) / 2 : value;
  return Math.max(0, Math.round(n));
};
const pair = (n) => [n, n];
function generalSteps(s) {
  if (s.kind === "athletic")
    return [
      ["Easy walk / jog · RPE 2–3", 270],
      ["Ankle rocks and leg swings · 8/side", 100],
      ["March · 10 m", 20],
      ["Walk back", 20],
      ["March · 10 m", 20],
      ...[50, 65, 80].flatMap((effort) => [
        [`Build-up run · 20 m at ${effort}%`, 8],
        ["Walk back", 30],
      ]),
      ["Rest before jumps / runs", 90, 90],
    ];
  if (s.kind !== "lifting") return [];
  if (s.id === "accessories") return [["Easy movement before visit 2", 240]];
  return [
    ["Easy cycle / brisk walk · RPE 2–3", 300],
    ["Ankle rocks · 8/side", 50],
    ["Bodyweight squat · 6 reps", 25],
    ["Reverse lunge · 4/side", 35],
    ["Thoracic rotation · 5/side", 40],
    ["Wrist circles · 10 each direction", 40],
    ["Wall slide · 8 reps", 35],
    ["Light band external rotation · 10/side", 60],
    [
      "Receiving / release check · 3 light overhead squats, front-rack squats and split catches",
      90,
    ],
  ];
}
function ramps(e, previous, config) {
  if (!["quality", "failure"].includes(e.kind)) return [];
  const steps = [],
    p = timeProfile(config);
  const stage = (label, seconds, rest) => {
    steps.push({ label, seconds, role: "ramp" });
    steps.push({
      label: "Ramp rest / change load",
      seconds: Math.max(rest, p.plateSeconds),
      minSeconds: rest,
      role: "ramp-rest",
    });
  };
  if (previous && family(previous) === family(e)) {
    const target = (r) =>
      r.workingLoad ||
      r.heldWeight ||
      r.heldLoads?.[0] ||
      ((r.range?.[1] || 0) * (config.anchors?.[r.anchor] || 1)) / 100;
    if (target(e) > target(previous))
      stage("Brief ascending rehearsal for heavier continuation", 20, 90);
    return steps;
  }
  if (e.kind === "failure") {
    if (["bench", "front_squat", "back_squat"].includes(e.id)) {
      const bench = e.id === "bench",
        low = bench && e.repRange[0] <= 3;
      const reps = bench ? [10, 6, 3, 1, ...(low ? [1] : [])] : [5, 5, 3, 1];
      reps.forEach((n, i) =>
        stage(
          `${i ? ["", "40%", "60%", "80%", "90%"][i] + " of intended work load" : "Empty bar · check safeties"} × ${n}`,
          Math.round(n * 3.5 + 15),
          i === reps.length - 1 ? 180 : 90,
        ),
      );
    } else if (e.id === "incline") {
      stage("40% of work load × 8 · easy", 36, 75);
      stage("65% of work load × 4 · easy", 22, 75);
    } else {
      const sides =
        e.id === "lateral" &&
        config.equipment?.lateral !== "db" &&
        p.unilateralCable;
      stage(
        `Easy rehearsal · 6–8 reps${sides ? " each side" : ""}`,
        sides ? 70 : 33,
        75,
      );
    }
    return steps;
  }
  if (e.regression && !e.range) {
    stage("Light secure regression rehearsals", 45, 75);
    return steps;
  }
  if (e.id === "pull") {
    stage("Three controlled floor starts · about 60% of work load", 24, 75);
    return steps;
  }
  if (family(e) === "jerk") {
    stage("Light rack hold 10 s; dip 3; split footwork 3", 45, 90);
    for (const [i, n] of [3, 2, 1].entries())
      stage(
        `${[40, 60, e.assessment ? 75 : 80][i]}% of ${e.assessment ? "intended first single" : "intended work load"} × ${n}`,
        n * 14,
        i === 2 ? 150 : 90,
      );
    return steps;
  }
  const cj = family(e) === "cj",
    reference = config.anchors?.[cj ? "cj" : "snatch"];
  const actual = e.heldLoads?.[0] || e.workingLoad;
  const pct =
    actual && reference
      ? (actual / reference) * 100
      : (e.sequence?.[0] || e.range || [40, 60])[0];
  const increment = config.increment || 5;
  const load = (v) =>
    Math.floor((reference * v) / 100 / increment + 1e-8) * increment;
  const stages = [
    [40, cj ? 2 : 3],
    [50, cj ? 1 : 2],
    [60, 1],
    ...(pct >= 75 ? [[70, 1]] : []),
    ...(pct >= 85 ? [[80, 1]] : []),
  ].filter(([v]) => (reference ? load(v) < load(pct) : v < pct));
  stage(
    cj
      ? "Light bar · RDL 5, tall clean 3, front squat 3, dip 3, footwork 3, jerk 3"
      : "Light bar · RDL 5, muscle snatch 3, paused overhead squat 3, high-hang snatch 3",
    cj ? 120 : 100,
    stages.length ? (cj ? 90 : 68) : cj ? 150 : 120,
  );
  stages.forEach(([v, n], i) =>
    stage(
      `${v}% ${cj ? "CJ" : "SN"}${reference ? ` · ${load(v)} lb` : ""} × ${cj ? `${n} clean${n > 1 ? "s" : ""} + ${n} jerk${n > 1 ? "s" : ""}` : n}`,
      Math.round(n * (cj ? 25 : 11) + (n - 1) * 8),
      v >= 60 || i === stages.length - 1 ? (cj ? 150 : 120) : cj ? 90 : 68,
    ),
  );
  return steps;
}

export function fixedSession(session, config = {}, options = {}) {
  const old = estimateSession(session, config, options),
    p = old.profile;
  const result = {
    rows: [],
    overhead: Object.fromEntries(
      Object.keys(old.overhead).map((k) => [k, [0, 0]]),
    ),
    seconds: [0, 0],
    profile: p,
    stages: [],
  };
  if (!old.rows.length) return result;
  const push = (id, label, seconds, extra = {}) => {
    result.stages.push({
      id,
      label,
      seconds: targetSeconds(seconds),
      ...extra,
    });
  };
  const overhead = (key, label, role = key) => {
    const seconds = targetSeconds(old.overhead[key]);
    result.overhead[key] = pair(seconds);
    if (seconds) push(key, label, seconds, { role });
  };
  overhead("arrival", "Arrive · belongings, water and equipment check");
  overhead("transition", "Transition to athletics");
  for (const [i, [label, seconds, minSeconds = 0]] of generalSteps(
    session,
  ).entries()) {
    push(`general:${i}`, label, seconds, { role: "general", minSeconds });
    result.overhead.general[0] += seconds;
    result.overhead.general[1] += seconds;
  }
  if (result.overhead.general[0])
    push("general:check", "General warm-up and readiness checks complete", 0, {
      role: "general-check",
    });
  let previous;
  for (const e of session.rows) {
    const oldRow = old.rows.find((r) => r.key === e.key);
    const parts = Object.fromEntries(
      Object.keys(oldRow.parts).map((k) => [k, [0, 0]]),
    );
    const before = result.stages.length;
    const rowStage = (suffix, label, seconds, part, extra = {}) => {
      seconds = targetSeconds(seconds);
      push(`${e.key}:${suffix}`, label, seconds, {
        key: e.key,
        exercise: e.name,
        role: part,
        ...extra,
      });
      parts[part][0] += seconds;
      parts[part][1] += seconds;
    };
    for (const [part, label] of [
      ["recovery", "Recover / transition from previous exercise"],
      ["setup", "Move station · set up and load equipment"],
      ["waiting", "Wait for equipment"],
    ])
      if (oldRow.parts[part][1])
        rowStage(part, label, oldRow.parts[part], part, {
          minSeconds:
            part === "recovery" ? targetSeconds(oldRow.parts[part]) : 0,
        });
    for (const [i, step] of ramps(e, previous, config).entries())
      rowStage(`ramp:${i}`, step.label, step.seconds, "ramp", {
        role: step.role,
        minSeconds: step.minSeconds || 0,
      });
    if (["quality", "failure", "speed"].includes(e.kind))
      push(`${e.key}:check`, "Warm-up, setup and local readiness checked", 0, {
        key: e.key,
        exercise: e.name,
        role: "prepare-check",
      });
    if (e.kind === "mobility") {
      mobilitySteps(e).forEach((step, i) =>
        rowStage(
          `mobility:${i}`,
          step.title,
          i === 7 ? 20 : step.seconds,
          step.title.startsWith("Rest") ? "rest" : "work",
          { role: "mobility", step: i, minSeconds: step.seconds },
        ),
      );
    } else {
      let attempt = 0;
      const sets = e.kind === "aerobic" ? 1 : e.sets;
      for (let slot = 0; slot < sets; slot++) {
        const reps = e.repSequence?.[slot] ?? e.reps;
        const n = e.kind === "quality" && typeof reps === "number" ? reps : 1;
        if (e.id === "jump" || e.id === "cut") {
          const count = e.id === "jump" ? 3 : 2;
          for (let i = 0; i < count; i++) {
            rowStage(
              `part:${slot}:${i}`,
              `${e.id === "jump" ? `Jump ${i + 1}/3` : i === 0 ? "Cut · left side" : "Cut · right side"} · set ${slot + 1}`,
              e.id === "jump" ? 3 : 5,
              "work",
              { role: i === count - 1 ? "work" : "work-part", attempt: slot },
            );
            if (i < count - 1)
              rowStage(
                `reset:${slot}:${i}`,
                e.id === "jump"
                  ? "Reset before next jump"
                  : "Reset / change sides",
                e.id === "jump" ? 10 : 25,
                "work",
                {
                  role: "reset",
                  attempt: slot,
                  minSeconds: e.id === "jump" ? 10 : 25,
                },
              );
          }
        } else {
          const reset = e.kind === "quality" ? e.resetSeconds || 15 : 0;
          const work = Math.max(
            1,
            Math.round(
              (targetSeconds(workSet(e, slot, p, config)) - reset * (n - 1)) /
                n,
            ),
          );
          for (let rep = 0; rep < n; rep++) {
            rowStage(
              `work:${attempt}`,
              e.kind === "aerobic"
                ? "Easy moving time · full-sentence talk test"
                : olympicFailure(e)
                  ? `Failure set ${slot + 1}/${sets} · ${e.id === "cj" ? "CJ pair" : "rep"} ${rep + 1} · record actual outcome`
                  : `Set ${slot + 1}/${sets}${n > 1 ? ` · rep ${rep + 1}/${n}` : ""}`,
              work,
              "work",
              { role: e.kind === "aerobic" ? "aerobic" : "work", attempt },
            );
            if (rep < n - 1)
              rowStage(
                `within:${attempt}`,
                "Reset within the same set",
                reset,
                "work",
                { role: "rest", afterAttempt: attempt, minSeconds: reset },
              );
            attempt++;
          }
        }
        if (slot < sets - 1) {
          const seconds = (e.rest || 0) + p.extraRestSeconds;
          rowStage(
            `rest:${slot}`,
            olympicFailure(e)
              ? "Recover before next failure set · keep the planned load"
              : "Rest · log result and change load during recovery",
            seconds,
            "rest",
            {
              role: "rest",
              afterAttempt: e.kind === "quality" ? attempt - 1 : slot,
              minSeconds: seconds,
            },
          );
          const extra = targetSeconds(oldRow.parts.handling) / (sets - 1);
          if (extra)
            rowStage(
              `handling:${slot}`,
              "Finish loading / logging beyond recovery",
              extra,
              "handling",
              { afterAttempt: e.kind === "quality" ? attempt - 1 : slot },
            );
        }
      }
    }
    const seconds = result.stages
      .slice(before)
      .reduce((sum, step) => sum + step.seconds, 0);
    result.rows.push({
      key: e.key,
      name: e.name,
      parts,
      seconds: pair(seconds),
      station: oldRow.station,
    });
    previous = e;
  }
  overhead(
    "breaks",
    "Water / restroom / miscellaneous allowance",
    "break-pool",
  );
  overhead("departure", "Unload · final log and pack up");
  result.seconds = pair(
    result.stages.reduce((n, stage) => n + stage.seconds, 0),
  );
  return result;
}
export function fixedDay(plan, config = {}) {
  const p = timeProfile(config),
    sessions = [];
  let visits = 0,
    gaps = 0,
    hasVisit = false;
  for (const session of plan.sessions) {
    const continuation =
      hasVisit &&
      (session.kind === "cardio" ||
        session.kind === "mobility" ||
        (session.kind === "athletic" && p.athleticsVisit === "same"));
    const t = fixedSession(session, config, { continuation });
    if (t.seconds[0]) {
      if (!continuation) {
        if (
          hasVisit &&
          (session.id === "accessories" || session.kind === "athletic")
        )
          gaps += 10800;
        visits++;
      }
      hasVisit = true;
    }
    sessions.push({ id: session.id, ...t });
  }
  const m = sessions.find((s) => s.id === "mobility");
  const seconds = pair(sessions.reduce((n, s) => n + s.seconds[0], 0));
  return {
    sessions,
    seconds,
    mobility: m?.seconds || [0, 0],
    mobilityRows: (m?.rows || []).map((r) => ({
      description: r.name,
      seconds: r.seconds,
    })),
    visits,
    gapSeconds: gaps,
    elapsed: pair(seconds[0] + gaps),
    profile: p,
  };
}
