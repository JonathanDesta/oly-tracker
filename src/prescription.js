import { conventionalDose } from "./dose.js";
import {
  allLoadedFailure,
  olympicFailure,
  failureTrialPending,
  failureOlympics,
} from "./failure-policy.js";
import {
  EXERCISES as EX,
  ACCESSORIES,
  WARMUP,
  RAMPS,
  DAYS,
} from "./catalog.js";
import { TIME_DEFAULTS, estimateSession } from "./duration.js";
import {
  weekdaySchedule,
  primaryAthleticSlot,
  secondaryAthleticSlot,
} from "./calendar.js";
export { DAYS };
export const copy = (value) => structuredClone(value);
export const sportEvent = (ctx = {}) =>
  ["game", "game_defer", "game_later"].find(
    (x) => x === ctx.sport || x === ctx.event,
  ) || "normal";
export const PHASE_NAMES = {
  F: "Foundation",
  B: "Build",
  R: "Realization",
  T: "Taper & test",
  P: "Pivot",
};
export function defaults() {
  return {
    cycle: 1,
    week: 1,
    entry: 1,
    gate: "F",
    recovery: "normal",
    split: false,
    anchors: { snatch: 155, cj: 205, jerk: null, clean: null },
    increment: 5,
    technique: { snatch: "none", clean: "none", jerk: "none" },
    equipment: {},
    setup: {},
    heavy: { snatch: 0, cj: 0, extraSnatch: 0, extraCj: 0 },
    rackLoad: null,
    assessment: "none",
    omitPull: false,
    reduceA: false,
    reduceJerk: false,
    lowerDose: false,
    omitLastLower: false,
    trials: [],
    athletics: {
      enabled: false,
      stage: 0,
      secondary: 0,
      secondaryJumps: 2,
      secondaryRuns: 2,
      day: "monday",
      variation: "none",
      intensity: 90,
    },
    cardio: { enabled: false, minutes: 40 },
    mobility: [],
    mobilitySeconds: 30,
    mobilityDays: 3,
    workloadChangedAt: null,
    timing: { ...TIME_DEFAULTS },
  };
}
export function phaseFor(c) {
  const calendar =
    c.week <= 4
      ? "F"
      : c.week <= 8
        ? "B"
        : c.week <= 11
          ? "R"
          : c.week === 12
            ? "T"
            : "P";
  const phase =
    calendar === "B" && c.gate === "F"
      ? "F"
      : calendar === "R" && c.gate !== "R"
        ? c.gate
        : calendar;
  return {
    calendar,
    phase,
    checkpoint: [4, 8].includes(c.week),
    additions:
      [1, 2, 3, 5, 6, 7].includes(c.week) &&
      c.entry === 3 &&
      c.recovery === "normal" &&
      !failureTrialPending(c),
  };
}
export function quality(
  id,
  sets,
  reps,
  range,
  anchor = id,
  effort = 7,
  rest = 150,
  extra = {},
) {
  return {
    id,
    key: id,
    name: EX[id][0],
    kind: "quality",
    sets,
    reps,
    range,
    anchor,
    effort,
    rest,
    note: EX[id][2],
    page: 7,
    warmup:
      RAMPS[id] ||
      (id === "hang"
        ? RAMPS.snatch
        : id === "pull"
          ? "Three floor starts at about 60% work weight; another light set only if needed. Straps permitted for pulls, never catches."
          : RAMPS.cj),
    ...extra,
  };
}
export function failure(id, sets, lo, hi, rest, extra = {}) {
  return {
    id,
    key: id,
    name: EX[id][0],
    kind: "failure",
    sets,
    reps: `${lo}–${hi}`,
    repRange: [lo, hi],
    rest,
    note:
      EX[id][2] +
      " About 2 seconds lowering, controlled transition, prompt lifting intent. No forced reps, drop sets, rest-pause extensions or assisted negatives.",
    page: ["bench", "front_squat", "back_squat"].includes(id)
      ? 2
      : ["leg_curl", "calf", "leg_ext", "crunch"].includes(id)
        ? 14
        : 13,
    warmup:
      RAMPS[id] ||
      (id.endsWith("squat")
        ? RAMPS.squat
        : "One easy 6–8 rep set; rest 60–90 seconds. Warm-ups never reach failure."),
    ...extra,
  };
}
// Each cell is [sets, reps, low %, high %]. Paired CJ attempts count once here.
const OLY = {
  monday: [
    [
      "snatch",
      "snatch",
      [
        [6, 2, 65, 75],
        [6, 2, 70, 80],
        [5, 1, 78, 85],
      ],
    ],
    [
      "cj",
      "cj",
      [
        [3, "1+1", 60, 70],
        [3, "1+1", 65, 75],
        [3, "1+1", 70, 78],
      ],
    ],
  ],
  tuesday: [
    [
      "cj",
      "cj",
      [
        [6, "1+1", 65, 75],
        [6, "1+1", 72, 82],
        [5, "1+1", 78, 85],
      ],
    ],
    [
      "hang",
      "snatch",
      [
        [3, 2, 55, 65],
        [3, 2, 60, 70],
        [3, 1, 65, 75],
      ],
    ],
  ],
  thursday: [
    [
      "snatch",
      "snatch",
      [
        [6, 1, 70, 80],
        [5, 1, 75, 85],
        [4, 1, 75, 82],
      ],
    ],
    [
      "jerk",
      "jerk",
      [
        [3, 2, 75, 85],
        [4, 1, 85, 95],
        [3, 1, 90, 100],
      ],
    ],
    [
      "pull",
      "snatch",
      [
        [2, 3, 90, 100],
        [2, 3, 95, 105],
        [0, 3, 0, 0],
      ],
    ],
  ],
  friday: [
    [
      "snatch",
      "snatch",
      [
        [4, 1, 75, 85],
        [4, 1, 80, 90],
        [4, 1, 80, 90],
      ],
    ],
    [
      "cj",
      "cj",
      [
        [4, "1+1", 75, 85],
        [4, "1+1", 80, 90],
        [4, "1+1", 80, 90],
      ],
    ],
  ],
};
function olympic(c, day, phase) {
  const pi = ["F", "B", "R"].indexOf(phase);
  let rows = (OLY[day] || [])
    .map(([id, anchor, table]) => {
      const [sets, reps, lo, hi] = table[pi];
      let e = quality(
        id,
        sets,
        reps,
        [lo, hi],
        anchor,
        id === "pull" || (phase === "F" && day !== "friday") ? 7 : 8,
        day === "friday" ? 210 : id === "hang" ? 120 : 150,
      );
      if (id === "jerk")
        e = c.anchors.jerk
          ? { ...e, workingLoad: c.rackLoad }
          : quality("jerk", 3, 2, [50, 70], "cj", 6, 150, {
              page: 27,
              note:
                EX.jerk[2] +
                " RJ unassessed: temporary secure teaching work only. Use the light regression if insecure.",
            });
      if (day === "friday" && phase !== "F")
        e.sequence = [
          [80, 80],
          [85, 85],
          phase === "B" ? [88, 88] : [88, 90],
          phase === "B" ? [88, 90] : [90, 90],
        ];
      return e;
    })
    .filter((e) => e.sets && !(e.id === "pull" && c.omitPull));
  for (const id of ["snatch", "cj"]) {
    const e = rows.find((e) => e.id === id);
    if (!e) continue;
    const top = c.heavy[id],
      extra = c.heavy[id === "snatch" ? "extraSnatch" : "extraCj"];
    if (day === "friday" && top) {
      e.sequence ||= Array.from({ length: e.sets }, () => [...e.range]);
      e.sequence[e.sets - 1] =
        phase === "F"
          ? [85, Math.min(c.cycle === 1 ? 88 : 90, top)]
          : phase === "R" && top >= 95
            ? [93, 95]
            : top >= 92
              ? [90, 92]
              : top === 90
                ? [88, 90]
                : [85, 88];
      e.finalEffort = phase === "F" || top < 92 ? 8 : 9;
    }
    if (extra && top >= 92 && phase !== "F") {
      const primary = id === "snatch" ? "thursday" : "tuesday";
      const primarySets =
        id === "snatch" ? (phase === "B" ? 5 : 4) : phase === "B" ? 6 : 5;
      const count =
        day === primary
          ? Math.min(e.sets, 1 + Math.max(0, extra - 3))
          : day === "friday"
            ? extra >= 2
              ? 1
              : 0
            : day === "monday"
              ? Math.min(
                  e.sets - 1,
                  (extra >= 3 ? 1 : 0) +
                    Math.max(0, extra - 3 - (primarySets - 1)),
                )
              : 0;
      if (count) {
        e.sequence ||= Array.from({ length: e.sets }, () => [...e.range]);
        e.repSequence = Array(e.sets).fill(e.reps);
        const end = day === "friday" ? e.sets - 1 : e.sets;
        for (let j = end - count; j < end; j++) {
          e.sequence[j] = [90, 92];
          e.repSequence[j] = id === "snatch" ? 1 : "1+1";
        }
        e.rest = 210;
      }
    }
  }
  if (day === "monday" && c.reduceA && rows[0]?.reps === 2)
    rows[0].sets = Math.min(rows[0].sets, 4);
  if (day === "thursday" && c.reduceJerk) {
    const j = rows.find((e) => e.id === "jerk");
    j.sets = Math.max(1, j.sets - 1);
  }
  const trial = c.trials.find((t) => t.kind === "pause_jerk" && !t.paused);
  if (
    trial &&
    day === "thursday" &&
    c.week !== 11 &&
    !c.reduceJerk &&
    c.anchors.jerk &&
    c.assessment !== "jerk"
  ) {
    const i = rows.findIndex((e) => e.id === "jerk");
    rows[i].sets -= 2;
    rows.splice(
      i,
      0,
      quality("pause_jerk", 2, 1, [60, 75], "jerk", 7, 180, {
        trialId: trial.id,
        workingLoad: trial.load || null,
        hold: [4, 8, 9, 10, 11].includes(c.week),
        page: 31,
        warmup: RAMPS.jerk,
      }),
    );
  }
  if (
    ["F", "B"].includes(phase) &&
    c.assessment === "clean" &&
    day === "tuesday"
  ) {
    rows.splice(
      0,
      1,
      quality("cj", 3, "1+1", [60, 70], "cj", phase === "F" ? 7 : 8),
      quality("clean", 3, 1, null, null, 8, 210, {
        assessment: true,
        page: 27,
        note: "Start at a known secure clean, usually CJ or lower. Add 5–10 lb only after an easy secure stand. Stop at effort 8 or first error; no retry.",
      }),
    );
  }
  if (
    ["F", "B"].includes(phase) &&
    c.assessment === "jerk" &&
    day === "thursday"
  ) {
    const i = rows.findIndex((e) => e.id === "jerk"),
      budget = rows[i].sets * rows[i].reps;
    rows[i] = quality("jerk", Math.min(5, budget), 1, null, null, 8, 210, {
      assessment: true,
      page: 27,
      warmup:
        "Light bar, then 40/60/75% of intended first single ×3/2/1. This replaces the ordinary ramp.",
      note: "First single about 80% CJ or lower. After effort ≤6 add 10–20 lb; at 7 add 5–10 lb; at 8 or first error stop. No retries. Heaviest valid single is RJ, a technical reference.",
    });
  }
  if (c.entry === 1)
    for (const e of rows) {
      e.sets = Math.ceil((e.sets * 2) / 3);
      if (e.range) e.range = [e.range[0], e.range[0]];
      if (e.sequence)
        e.sequence = e.sequence.slice(0, e.sets).map((r) => [r[0], r[0]]);
    }
  return rows
    .filter((e) => e.sets > 0)
    .map((e) => ({
      ...e,
      sequence: e.sequence?.slice(0, e.sets),
      repSequence: e.repSequence?.slice(0, e.sets),
    }));
}
const SUBSTITUTES = {
  incline: {
    smith: "Incline Smith press · 30–45° · safeties required",
    db: "Incline dumbbell press · 30–45°",
  },
  lateral: { db: "Dumbbell lateral raise" },
  row: { machine: "Supported machine row" },
  leg_curl: { lying: "Lying leg curl" },
  calf: {
    press: "Supported knee-extended calf press",
    seated: "Seated calf raise · individualized fallback",
  },
  leg_ext: { upright: "Upright seated leg extension · secure setup fallback" },
  crunch: { cable: "Cable abdominal crunch" },
  triceps: {
    pressdown: "Cable pressdown · overhead intolerance/interference fallback",
  },
};
function conventional(c, day, phase, one = false) {
  const low = day === "tuesday",
    range = ["F", "P"].includes(phase) ? [4, 6] : [3, 5];
  const rows = [
    failure(
      low ? "front_squat" : "back_squat",
      conventionalDose(low ? "front_squat" : "back_squat", 1, c, one),
      ...range,
      270,
    ),
    failure(
      "bench",
      conventionalDose("bench", 1, c, one),
      ...(low ? [3, 5] : [6, 8]),
      low ? 270 : 210,
      {
        key: low ? "bench_low" : "bench_moderate",
      },
    ),
  ];
  for (const [id, sets, lo, hi, rest] of ACCESSORIES) {
    const n =
      one || c.entry === 1
        ? 1
        : c.entry === 2
          ? { incline: 2, lateral: 3, row: 2 }[id] || 1
          : sets;
    const count = conventionalDose(id, n, c, one);
    const e = failure(id, count, lo, hi, rest, { baseSets: count });
    const substitute = SUBSTITUTES[id]?.[c.equipment[id]];
    if (substitute) {
      e.name = substitute;
      e.note =
        (id === "calf"
          ? "2 seconds down, 1-second bottom pause, full rise; no bouncing. "
          : id === "leg_curl"
            ? "Pelvis secured; full comfortable knee range, no hip lifting. "
            : id === "leg_ext"
              ? "Back and pelvis supported, knee axis aligned; never imitate recline by arching the spine. "
              : id === "incline"
                ? "Use a comfortable 30–45° incline and stable deep range. "
                : id === "row"
                  ? "Keep chest on support, full comfortable reach, no trunk heave. "
                  : id === "lateral"
                    ? "Slightly forward arm plane, about shoulder height; no torso swing or shortened-ROM finishers. "
                    : id === "crunch"
                      ? "Controlled trunk flexion; no hip pulling or neck strain. "
                      : "Keep upper arms stable through a comfortable elbow range. ") +
        "Keep a stable, supported setup and full comfortable ROM. About 2 seconds lowering; strict-form failure with a safe endpoint. Establish a new load after equipment/ROM changes.";
    }
    rows.push(e);
  }
  for (const t of c.trials.filter(
    (t) => !t.paused && t.day === day && ["F", "B", "R"].includes(phase),
  )) {
    const props = {
      trialId: t.id,
      hold: [4, 8, 9, 10, 11].includes(c.week),
      page: 31,
    };
    if (t.kind === "squat" && !one)
      rows.splice(
        rows.findIndex((e) => e.id === "bench"),
        0,
        failure(t.exercise, 1, 3, 5, 270, { ...props, key: "support_" + t.id }),
      );
    if (t.kind === "press") {
      rows.find((e) => e.id === "incline").sets--;
      rows.splice(
        rows.findIndex((e) => e.id === "bench") + 1,
        0,
        failure("press", 1, 6, 10, 210, { ...props, warmup: RAMPS.incline }),
      );
    }
    if (t.kind === "set" && !one) {
      const e = rows.find((e) => e.id === t.exercise);
      if (e) {
        e.sets++;
        e.trialIds = [...(e.trialIds || []), t.id];
      }
    }
    if (t.kind === "calf_partial" && !c.equipment.calf) {
      const i = rows.findIndex((e) => e.id === "calf");
      rows[i].sets--;
      rows.splice(
        i + 1,
        0,
        failure("calf", 1, 10, 15, 150, {
          ...props,
          key: "calf_partial",
          name: "Standing calf · heel-down to neutral partial",
          note: "Preplanned fixed ROM: heel-down dorsiflexion to neutral ankle. 2 seconds down; no bounce or finishers. Failure of this fixed range.",
          page: 34,
        }),
      );
    }
  }
  return rows.filter((e) => {
    if (
      c.lowerDose &&
      e.key === "calf" &&
      rows.some((x) => x.key === "calf_partial")
    )
      return false;
    if (c.lowerDose && ["leg_curl", "calf"].includes(e.id))
      e.sets = Math.min(1, e.sets);
    if (c.lowerDose && ["leg_ext", "crunch"].includes(e.id)) return false;
    if (
      c.omitLastLower &&
      c.week === 11 &&
      day === "friday" &&
      ["front_squat", "back_squat", "leg_curl", "calf", "leg_ext"].includes(
        e.id,
      )
    )
      return false;
    e.setup = c.setup[e.id] || 0;
    return e.sets > 0;
  });
}
function regress(rows, c, day) {
  return rows
    .flatMap((e) => {
      const family = ["snatch", "hang"].includes(e.id)
        ? "snatch"
        : ["cj", "clean"].includes(e.id)
          ? "clean"
          : ["jerk", "pause_jerk"].includes(e.id)
            ? "jerk"
            : null;
      const mode = c.technique[family];
      if (!mode || mode === "none") return [e];
      const base = {
        ...e,
        sequence: null,
        repSequence: null,
        workingLoad: null,
        finalEffort: null,
        test: false,
        assessment: false,
        trialId: null,
        regression: true,
        page: 16,
      };
      if (mode === "receive")
        return [
          {
            ...base,
            name:
              family === "snatch"
                ? "Technique-bar overhead squat rehearsal"
                : "Technique-bar front squat rehearsal",
            sets: 3,
            reps: 3,
            range: null,
            anchor: null,
            effort: 4,
            rest: 90,
            note: "3×3 with technique bar, 2-second pause; no failure. Return only after three secure light warm-up reps and safe release instruction.",
          },
        ];
      if (mode === "return")
        return [
          {
            ...base,
            sets: 4,
            reps: e.id === "cj" ? "1+1" : 1,
            range: [40, 60],
            effort: Math.min(6, e.effort),
            rest: 120,
            note: "Four secure return singles after receiving and release checks. Stop if the position is insecure.",
          },
        ];
      if (
        mode === "turnover" &&
        ((day === "tuesday" && e.id === "hang") ||
          (day === "monday" && e.id === "cj"))
      )
        return [
          {
            ...base,
            name:
              e.id === "hang"
                ? "High-hang full snatch"
                : "High-hang full clean & jerk",
            sets: 3,
            reps: e.id === "hang" ? 2 : "1+1",
            range: [40, 60],
            note: "Turnover regression: two exposures with ≥90% secure reps before restoring the ordinary variation.",
          },
        ];
      if (mode === "balance" && ["snatch", "cj"].includes(e.id)) {
        const n = Math.min(2, e.sets);
        return [
          {
            ...base,
            key: e.key + "_pause",
            name: "Knee-pause " + e.name,
            sets: n,
            reps: e.id === "cj" ? "1+1" : 1,
            range: [50, 65],
            rest: 120,
            note: "Pause 2 seconds at knee; replace first two sets. Restore after two balanced exposures.",
          },
          {
            ...base,
            sets: e.sets - n,
            range: e.range ? [e.range[0], e.range[0]] : [50, 60],
            note: e.note + " Remaining work at a secure lower load.",
          },
        ].filter((r) => r.sets);
      }
      if (family === "jerk" && ["stance", "dip"].includes(mode))
        return [
          {
            ...base,
            id: "pause_jerk",
            key: "jerk_regression",
            name:
              mode === "dip"
                ? "Pause-dip split jerk · technique"
                : "Light-bar split jerk · 2-second split hold",
            sets: 3,
            reps: 2,
            range: mode === "dip" ? [40, 60] : null,
            anchor: mode === "dip" ? (c.anchors.jerk ? "jerk" : "cj") : null,
            effort: 6,
            rest: 90,
            warmup:
              "2×3 unweighted footwork reps; secure light-bar rehearsals.",
            note: "Pause dip 1 second for dip regression; hold split 2 seconds. Two secure exposures before return.",
          },
        ];
      return [e];
    })
    .filter((e, i, a) => a.findIndex((r) => r.key === e.key) === i);
}
export function athleticDose(stage) {
  const d = { jumps: 2, runs: 3, meters: 10, effort: "85–90%" };
  for (let i = 1; i <= stage; i++) {
    if (i === 1) d.jumps = 3;
    else if (i === 2) d.meters = 15;
    else if (i === 3) d.effort = "90–95%";
    else if (i % 2 === 0) d.jumps++;
    else if (d.meters < 20) d.meters = 20;
    else d.runs++;
  }
  return d;
}
function athletic(c, day, ctx) {
  const a = ctx.returnAthletics || c.athletics;
  if (!a.enabled || c.week === 12) return [];
  const primaryDay =
    c.week === 11
      ? primaryAthleticSlot(c)
      : ctx.athleticDay ||
        (weekdaySchedule(c) ? primaryAthleticSlot(c) : a.day);
  const secondDay = secondaryAthleticSlot(c);
  const primary = day === primaryDay,
    second =
      c.week !== 11 &&
      a.secondary > 0 &&
      day === secondDay &&
      primaryDay !== secondDay;
  if (!primary && !second) return [];
  const d = second
    ? {
        jumps: a.secondaryJumps,
        runs: a.secondary >= 2 ? a.secondaryRuns : 0,
        meters: 10,
        effort: "85–90%",
      }
    : athleticDose(a.stage);
  const rows = [
    {
      id: "jump",
      key: "jump",
      name: EX.jump[0],
      kind: "speed",
      sets: d.jumps,
      reps: 3,
      rest: 120,
      note: EX.jump[2],
      page: 21,
    },
  ];
  if (d.runs)
    rows.push({
      id: "sprint",
      key: "sprint",
      name: EX.sprint[0],
      kind: "speed",
      sets: d.runs,
      reps: `${d.meters} m`,
      effort: d.effort,
      rest: 180,
      note: EX.sprint[2],
      page: 21,
    });
  if (
    primary &&
    ctx.variation !== false &&
    a.variation !== "none" &&
    d.runs >= 4 &&
    d.meters === 20
  ) {
    rows[1].sets -= 2;
    const id = a.variation;
    rows.push({
      id,
      key: id,
      name: EX[id][0],
      kind: "speed",
      sets: 2,
      reps: id === "fly" ? "10 m" : "1/side",
      effort: `${a.intensity}%`,
      rest: id === "fly" ? 240 : 120,
      note: EX[id][2],
      page: 29,
    });
  }
  if (c.week === 11) {
    rows[0].sets = Math.ceil(rows[0].sets / 2);
    // Keep the total run repetitions at ceil(current/2), including a varied exposure.
    let budget = Math.ceil(d.runs / 2);
    for (const e of rows.slice(1)) {
      const n = Math.min(budget, Math.ceil(e.sets / 2));
      e.sets = n;
      budget -= n;
    }
    if (budget && rows[1]) rows[1].sets += budget;
  }
  return [
    session(
      second ? "athletics-secondary" : "athletics",
      second ? "Second athletic exposure" : "Jumps & accelerations",
      rows.filter((e) => e.sets),
      "athletic",
      "After priority work; preferably ≥3 hours later. In one visit, take a 5-minute transition, then running warm-up.",
    ),
  ];
}
export function session(id, title, rows, kind = "lifting", note = "") {
  return {
    id,
    title,
    rows,
    kind,
    note,
    warmup:
      kind === "lifting"
        ? WARMUP
        : kind === "athletic"
          ? RAMPS.field
          : kind === "mobility"
            ? "Set up the selected drill comfortably. Use mild-to-moderate tension, never pain; no lifting warm-up is added to a mobility-only session."
            : "Start easy; full-sentence talk test, RPE 3–4.",
    minutes: Math.ceil(estimateSession({ id, rows, kind }).seconds[1] / 60),
  };
}
export function estimate(rows, kind = "lifting", config = {}) {
  return Math.ceil(estimateSession({ rows, kind }, config).seconds[1] / 60);
}
export function dayPlan(config, day, ctx = {}) {
  const c = copy(config),
    { phase, calendar, checkpoint } = phaseFor(c);
  if (allLoadedFailure(c)) {
    c.entry = Math.min(c.entry, c.failureEntry || 1);
    c.heavy = { snatch: 0, cj: 0, extraSnatch: 0, extraCj: 0 };
    c.rackLoad = null;
    c.assessment = "none";
    c.trials = c.trials.filter(
      (t) =>
        !["pause_load", "rack", "pause_jerk"].includes(t.kind) && c.entry === 3,
    );
  }
  if (ctx.event === "verification") {
    c.heavy = { snatch: 0, cj: 0, extraSnatch: 0, extraCj: 0 };
    c.rackLoad = null;
    c.assessment = "none";
  }
  if (
    c.recovery !== "normal" ||
    ctx.level === "amber" ||
    ctx.level === "red" ||
    ctx.local
  )
    c.assessment = "none";
  const p = {
    day,
    phase,
    calendar,
    week: c.week,
    cycle: c.cycle,
    sessions: [],
    notes: [],
    mobility: [],
  };
  if (weekdaySchedule(c) && c.week !== 12) {
    if (day === "thursday")
      p.notes.push(
        "In the normal weekday plan, Tuesday C follows Monday B failure work. Check familiar-load snatch/jerk quality and positions; reduce or stop affected work if recovery is abnormal. Athletics is conditional on normal legs and running/jumping quality.",
      );
    if (day === "friday")
      p.notes.push(
        "In the normal weekday plan, Friday D follows Thursday A. Compare familiar-load quality and use the alcohol/readiness rules after a Thursday event; no calendar date guarantees recovery.",
      );
    if (c.week === 11)
      p.notes.push(
        "Week 11: established athletics on Tuesday C only, half jump sets and run repetitions. Friday D is reduced; its lower failure work remains seven days before the planned test.",
      );
  }
  let ol = [],
    conv = [];
  if (c.week === 12) {
    const t = {
      monday: [3, 75, 80, 7, 150],
      tuesday: [2, 80, 85, 8, 180],
      thursday: [2, 50, 60, 6, 120],
    }[day];
    if (t)
      ol = ["snatch", "cj"].map((id) =>
        quality(
          id,
          t[0],
          id === "cj" ? "1+1" : 1,
          [t[1], t[2]],
          id,
          t[3],
          t[4],
          { page: 19 },
        ),
      );
    if (day === "friday")
      ol = ["snatch", "cj"].map((id) =>
        quality(
          id,
          3,
          id === "cj" ? "1+1" : 1,
          c.gate === "R" ? [88, 92] : [75, 85],
          id,
          c.gate === "R" ? 10 : 8,
          270,
          {
            test: true,
            benchmark: c.gate !== "R",
            page: 19,
            afterRest: id === "snatch" ? 540 : 0,
            note: "Three scored attempts including misses. Open 88–92%, then 97–100% only if easy, then smallest defensible PR only after secure second. If 80–85% warm-ups are insecure: benchmark ≤85%. Between lifts: 8–10 minutes then CJ ramp.",
          },
        ),
      );
    if (["monday", "saturday"].includes(day))
      conv = [
        failure(
          "bench",
          1,
          ...(day === "monday" ? [3, 5] : [6, 8]),
          day === "monday" ? 270 : 210,
          { key: day === "monday" ? "bench_low" : "bench_moderate", page: 19 },
        ),
      ];
    p.notes.push(
      "Week 12 replaces the normal week. Moderate bench stays AFTER the Olympic test, including if the test moves. No athletics or formal aerobics; Wednesday optional 10–15 minute easy walk.",
    );
  } else if (c.week === 13) {
    if (["monday", "thursday"].includes(day))
      ol = [
        quality("snatch", 4, 1, [60, 70], "snatch", 6, 120),
        quality("cj", 3, "1+1", [60, 70], "cj", 6, 120),
      ];
    if (["tuesday", "friday"].includes(day))
      conv = conventional(c, day, "P", ctx.pivotResidual);
  } else {
    ol = olympic(c, day, phase);
    if (["tuesday", "friday"].includes(day))
      conv = conventional(c, day, phase, c.week === 11 && day === "friday");
  }
  ol = regress(ol, c, day);
  if (allLoadedFailure(c)) {
    ol = failureOlympics(ol, c, phase, day);
    if (c.week === 13 || c.entry === 1) conv.forEach((e) => (e.sets = 1));
    p.notes = [];
    p.notes.push(
      "September 21 amendment: ALL retained loaded work sets end at failure. Olympic work: each prescribed set ends at its first miss or invalid rep; 15-second resets and at least 5 minutes recovery between sets and before the next loaded exercise. Warm-ups, athletics and recovery activities are outside this constraint.",
    );
    if (c.week === 12)
      p.notes.push(
        "Failure-compatible taper: Monday one snatch and one CJ failure set plus low-rep bench; Tuesday/Thursday no loaded work; Friday one fixed-load failure benchmark per lift; moderate bench afterward. This replaces the source three-attempt mock meet and is not a competition total.",
      );
    if (c.week === 13)
      p.notes.push(
        "Failure-compatible pivot: no Olympic work sets; one set per retained conventional exercise. Recovery reduces volume, not effort. This pivot design is a practical inference.",
      );
    if (Object.values(c.technique).some((x) => x !== "none"))
      p.notes.push(
        "An affected Olympic exercise requiring technical regression is omitted. Relearn positions in nonfatiguing preparation; do not turn remedial drills into failure sets.",
      );
  }
  const all = [...ol, ...conv];
  if (allLoadedFailure(c))
    for (const e of all) {
      const reduction = (c.setReductions || [])
        .filter((x) => x.day === day && x.exercise === e.id)
        .reduce((n, x) => n + x.sets, 0);
      if (reduction) {
        const extra = e.trialIds?.length || 0;
        e.sets = Math.max(1, e.sets - extra - reduction) + extra;
        if (e.baseSets) e.baseSets = Math.max(1, e.baseSets - reduction);
      }
    }
  if (all.length) {
    const i = c.split ? all.findIndex((e) => e.id === "row") : -1;
    if (i >= 0) {
      p.sessions.push(
        session("main", "Visit 1 · priority work", all.slice(0, i)),
      );
      p.sessions.push({
        ...session(
          "accessories",
          "Visit 2 · remaining blocks",
          all.slice(i),
          "lifting",
          "At least 3 hours after visit 1. Re-warm 3–5 minutes, then local ramps.",
        ),
        warmup:
          "3–5 minutes easy movement, then the local ramps. No failure warm-ups.",
      });
    } else
      p.sessions.push(
        session(
          "main",
          (c.week === 13
            ? {
                monday: "A · Easy Olympic practice",
                thursday: "C · Easy Olympic practice",
                tuesday: "B · Squat, bench & assistance",
                friday: "D · Squat, bench & assistance",
              }[day]
            : c.week === 12 && day !== "friday" && day !== "saturday"
              ? {
                  monday: "Taper · Olympic practice + low-rep bench",
                  tuesday: "Taper · Olympic singles",
                  thursday: "Taper · Easy rehearsal",
                }[day]
              : null) ||
            {
              monday: "A · Snatch practice",
              tuesday: "B · Clean & jerk + failure work",
              thursday: "C · Snatch + rack jerk",
              friday:
                c.week === 12
                  ? "Mock meet · three attempts per lift"
                  : "D · Both lifts + failure work",
              saturday: "Moderate bench",
            }[day],
          all,
        ),
      );
  }
  if (allLoadedFailure(c))
    for (const s of p.sessions) {
      s.title =
        c.week === 12
          ? day === "friday"
            ? "Olympic failure benchmark"
            : day === "monday"
              ? "Taper · Olympic failure sets + low-rep bench"
              : s.title
          : c.week === 13
            ? s.title
            : s.title.replace("Snatch practice", "Snatch failure sets");
    }
  p.sessions.push(...athletic(c, day, ctx));
  if (c.cardio.enabled && c.week !== 12) {
    // Main sessions build 20/20 to 30/30. Further minutes are placed as walks.
    const total = c.cardio.minutes,
      first = Math.min(30, Math.ceil(total / 10) * 5),
      second = Math.min(30, total - first);
    const mainMinutes =
      day === "wednesday" ? first : day === "saturday" ? second : 0;
    let remaining = Math.max(0, total - 60);
    const walks = {};
    for (const d of [
      "monday",
      "thursday",
      "tuesday",
      "wednesday",
      "friday",
      "saturday",
      "sunday",
    ]) {
      const target = ["monday", "thursday"].includes(d) ? 20 : 10;
      const n = Math.min(target, remaining);
      walks[d] = n;
      remaining -= n;
    }
    for (const d of DAYS) {
      const n = Math.ceil(remaining / (7 - DAYS.indexOf(d)));
      walks[d] = (walks[d] || 0) + n;
      remaining -= n;
    }
    const cardioRows = [
      ["aerobic", "Main aerobic session", mainMinutes],
      ["aerobic_walk", "Additional brisk walk", walks[day] || 0],
    ]
      .filter(([, , minutes]) => minutes > 0)
      .map(([key, name, minutes]) => ({
        id: "aerobic",
        key,
        kind: "aerobic",
        name,
        minutes,
        reps: `${minutes} min`,
        note: EX.aerobic[2],
        page: 22,
      }));
    if (cardioRows.length)
      p.sessions.push(
        session(
          "cardio",
          "Easy aerobic work",
          cardioRows,
          "cardio",
          "After any priority work. Split into walks if useful; count actual moving minutes once.",
        ),
      );
  }
  if (
    [
      "wednesday",
      "saturday",
      "sunday",
      ...(c.mobilityDays === 4 ? ["monday"] : []),
    ].includes(day)
  )
    p.mobility = c.mobility
      .slice(0, 2)
      .map(
        (m) =>
          `${m}: 2 × ${c.mobilitySeconds} seconds/side, 15 seconds rest, then 5 slow active reps. Mild-to-moderate tension, never pain.`,
      );
  if (p.mobility.length)
    p.sessions.push(
      session(
        "mobility",
        "Stretches & active movement",
        p.mobility.map((note, i) => ({
          id: "mobility",
          key: "mobility_" + i,
          kind: "mobility",
          name: c.mobility[i],
          sets: 1,
          reps: 5,
          holdSeconds: c.mobilitySeconds,
          rest: 15,
          region: /ankle|hip/i.test(c.mobility[i]) ? "lower" : "upper",
          note,
          page: 22,
        })),
        "mobility",
        "After any scheduled lifting, or on a non-lifting day. Timed holds on both sides, rests, then five slow active reps.",
      ),
    );
  if (checkpoint)
    p.notes.push(
      allLoadedFailure(c)
        ? "Green checkpoint: hold work loads and set counts; correct a load that misses its rep window. No extra sets or bounded Olympic assessments."
        : "Green checkpoint: repeat the preceding successful loads and sets. No additions. Rep-window corrections and eligible component assessment replacements are exceptions.",
    );
  if (phase !== calendar)
    p.notes.push(
      allLoadedFailure(c)
        ? `Phase gate held: keep ${PHASE_NAMES[phase]} targets until ready. Week 12 remains a fixed-load failure benchmark at the appropriate held load, not a maximal test.`
        : `Phase gate held: repeat ${PHASE_NAMES[phase]} until its criteria are met. Week 12 uses a ≤85% technical benchmark if Realization is not ready.`,
    );
  return ctx.deferRestrictions ? p : restrictions(p, c, ctx);
}
const UPPER = [
  "snatch",
  "cj",
  "hang",
  "jerk",
  "clean",
  "pause_jerk",
  "pull",
  "bench",
  "incline",
  "lateral",
  "row",
  "pulldown",
  "shrug",
  "rear_delt",
  "curl",
  "triceps",
  "press",
  "front_squat",
  "back_squat",
];
const LOWER = [
  "snatch",
  "cj",
  "hang",
  "jerk",
  "clean",
  "pause_jerk",
  "pull",
  "front_squat",
  "back_squat",
  "leg_curl",
  "calf",
  "leg_ext",
  "crunch",
  "jump",
  "sprint",
  "fly",
  "cut",
];
export function restrictions(plan, c, ctx = {}) {
  const p = copy(plan),
    red = ctx.level === "red" || ctx.event === "unsafe",
    sport = sportEvent(ctx),
    defer = ["game", "game_defer"].includes(sport);
  if (red || defer) {
    p.sessions.forEach((s) => {
      s.skipped = true;
      s.reason = red
        ? "Stop loaded, explosive, failure and conditioning work."
        : "Whole session deferred. Roll subsequent dates; no completed-work replay.";
    });
    if (
      !red &&
      !allLoadedFailure(c) &&
      sport === "game" &&
      ctx.rehearsal &&
      ctx.level === "green" &&
      !ctx.local
    ) {
      const rows = p.sessions
        .flatMap((s) => s.rows)
        .filter((e) => ["snatch", "cj"].includes(e.id));
      if (rows.length)
        p.sessions.push(
          session(
            "rehearsal",
            "Optional secure rehearsal",
            rows.map((e) =>
              quality(
                e.id,
                Math.min(3, e.sets),
                e.id === "cj" ? "1+1" : 1,
                [50, 60],
                e.id,
                6,
                120,
              ),
            ),
            "lifting",
            "Does not complete the deferred session.",
          ),
        );
    }
    return p;
  }
  const amber = ctx.level === "amber",
    verify = ctx.event === "verification",
    reduced = ["targeted", "reset"].includes(c.recovery);
  for (const s of p.sessions) {
    if ((amber || reduced) && ["athletic", "cardio"].includes(s.kind)) {
      s.skipped = true;
      s.reason = "Omitted during fatigue reduction.";
      continue;
    }
    s.rows = s.rows
      .filter((e) => {
        if (olympicFailure(e) && (amber || reduced || sport === "game_later"))
          return false;
        if (e.kind === "mobility" && ctx.local === e.region) return false;
        if ((amber || sport === "game_later") && e.kind === "failure")
          return false;
        if (ctx.local && (ctx.local === "upper" ? UPPER : LOWER).includes(e.id))
          return false;
        if (
          ctx.noProtection &&
          e.kind === "failure" &&
          ["bench", "front_squat", "back_squat"].includes(e.id)
        )
          return false;
        if (
          c.week === 12 &&
          s.id === "main" &&
          p.day === "saturday" &&
          ctx.event === "larger_later" &&
          e.id === "bench"
        )
          return false;
        if (
          e.key.startsWith("support_") &&
          (verify || ctx.local || reduced || ctx.event === "limited_later")
        )
          return false;
        if (reduced && e.id === "pull") return false;
        if (c.recovery === "reset" && e.kind === "failure" && e.id !== "bench")
          return false;
        return true;
      })
      .map((e) => {
        if (e.kind === "quality" && (amber || reduced)) {
          const old = e.sets;
          e.sets = Math.max(
            1,
            Math.min(
              old,
              amber ? Math.floor((old * 2) / 3) : old,
              reduced ? Math.ceil(old / 2) : old,
            ),
          );
          // Preserve individual slot rep counts: reduction must never turn singles back into doubles.
          if (e.repSequence) e.repSequence = e.repSequence.slice(0, e.sets);
          e.sequence = null;
          e.finalEffort = null;
          e.test = false;
          e.assessment = false;
          e.reduced = true;
          e.hold = true;
          e.effort = Math.min(e.effort, c.recovery === "reset" ? 6 : 7);
          e.rest = amber ? 180 : e.rest;
          if (c.recovery === "reset" && !e.regression) {
            e.range = e.range
              ? [Math.min(50, e.range[0]), Math.min(65, e.range[1])]
              : [50, 65];
            e.workingLoad = null;
            e.heldLoads = null;
          } else if (e.range)
            e.range = amber
              ? e.range.map((v) => v * 0.925)
              : [e.range[0], e.range[0]];
          if (amber && e.workingLoad) e.workingLoad *= 0.925;
          if (e.heldLoads)
            e.heldLoads = e.heldLoads
              .slice(0, e.sets)
              .map(
                (weight) =>
                  Math.floor(
                    (amber
                      ? weight * 0.925
                      : Math.min(
                          weight,
                          ((c.anchors[e.anchor] || Infinity) *
                            (e.range?.[0] || 100)) /
                            100,
                        )) / c.increment,
                  ) * c.increment,
              );
          if (
            reduced &&
            !amber &&
            e.workingLoad &&
            e.range &&
            c.anchors[e.anchor]
          )
            e.workingLoad = Math.min(
              e.workingLoad,
              (c.anchors[e.anchor] * e.range[0]) / 100,
            );
        }
        if (olympicFailure(e)) {
          if (ctx.event === "limited_later" && e.trialIds?.length) {
            e.sets -= e.trialIds.length;
            e.trialIds = [];
          }
          if (verify || ctx.local) {
            e.sets = 1;
            e.hold = true;
            e.trialIds = [];
          }
          if (ctx.event === "larger_later") e.hold = true;
        }
        if (e.kind === "quality" && !olympicFailure(e) && verify) {
          e.range = e.test
            ? [75, 75]
            : e.range
              ? [e.range[0], e.range[0]]
              : null;
          e.sequence = null;
          e.test = false;
          e.assessment = false;
          e.finalEffort = null;
          e.hold = true;
          e.heldLoads = null;
          e.workingLoad = null;
          e.effort = Math.min(e.effort, 8);
        }
        if (e.kind === "failure") {
          if (ctx.event === "limited_later" && e.trialIds?.length) {
            e.sets = Math.max(1, e.sets - e.trialIds.length);
            e.trialIds = [];
          }
          if (verify || ctx.local) e.sets = Math.min(e.sets, 1);
          if (c.recovery === "targeted")
            e.sets = Math.min(
              e.sets,
              ["incline", "lateral"].includes(e.id) ? 2 : 1,
            );
          if (e.baseSets && e.sets <= e.baseSets) e.trialIds = [];
          if (reduced || verify || ctx.local || ctx.event === "larger_later")
            e.hold = true;
        }
        if (c.recovery === "restore" && e.sets) {
          e.sets = Math.min(e.sets, ctx.restoreCaps?.[s.id]?.[e.key] ?? 1);
          e.hold = true;
          if (e.repSequence) e.repSequence = e.repSequence.slice(0, e.sets);
          if (e.sequence) e.sequence = e.sequence.slice(0, e.sets);
        }
        return e;
      });
    if (verify || ctx.local || reduced) {
      if (s.rows.some((e) => e.key === "calf_partial"))
        s.rows = s.rows.filter(
          (e) => e.id !== "calf" || e.key === "calf_partial",
        );
    }
    if (
      s.kind === "athletic" &&
      (ctx.replaceAthletics || sport === "game_later" || ctx.local === "lower")
    ) {
      s.skipped = true;
      s.reason =
        "Demanding play or residual leg fatigue replaces the overlapping athletic module.";
    }
    if (!s.rows.length) {
      s.skipped = true;
      s.reason = "No eligible work after readiness rules.";
    }
    s.minutes = Math.ceil(estimateSession(s, c).seconds[1] / 60);
  }
  if (amber)
    p.notes.push(
      allLoadedFailure(c)
        ? "Global amber: omit loaded failure work. Do not replace it with submaximal Olympic working sets; resume only when ready."
        : "Global amber: rest 3 minutes, reduce Olympic loads 5–10%, at most floor(⅔ sets), effort ≤7. Omit failure work. If still poor, stop or use at most 4 secure singles at 50–60% within remaining attempts.",
    );
  if (verify)
    p.notes.push(
      "Verification return: low-end Olympic loads, no PRs or extra heavy attempts; at most 1 failure set per prescribed row if local checks pass. No new or progressed athletics. Restore phase volume only after the return and next warm-ups remain normal; record that next-session check in History.",
    );
  if (ctx.event === "limited_later")
    p.notes.push(
      "Known limited event later, sober and normal now: usual failure work and normal load progression may proceed; no extra/new sets. Confirm subsequent recovery before this exposure earns progression.",
    );
  if (ctx.local)
    p.notes.push(
      "Local issue: affected work omitted. Unaffected failure rows use at most one set, only with normal control and local warm-ups.",
    );
  if (c.recovery === "restore")
    p.notes.push(
      "Repeat last successful phase. Restore one set per row per exposure only after subsequent Olympic practice remains normal. Hold other additions.",
    );
  return p;
}
export function loadRange(e, anchors, slot = 0, increment = 5) {
  if (e.test && !e.benchmark && slot > 0) return null;
  const trialCap =
    !olympicFailure(e) && e.id === "pause_jerk" && e.trialId && anchors.jerk
      ? Math.floor((anchors.jerk * 0.75) / increment) * increment
      : Infinity;
  if (e.heldLoads?.[slot])
    return Array(2).fill(Math.min(e.heldLoads[slot], trialCap));
  if (e.workingLoad) return Array(2).fill(Math.min(e.workingLoad, trialCap));
  const r = e.sequence?.[slot] || e.range,
    a = anchors[e.anchor];
  return r && a
    ? r.map((x) => Math.floor(((a * x) / 100 + 1e-9) / increment) * increment)
    : null;
}
export function describe(e) {
  if (olympicFailure(e))
    return `${e.sets} ${e.sets === 1 ? "set" : "sets"} · first miss/invalid rep · ${e.validRepRange.join("–")} valid ${e.id === "cj" ? "CJ pairs" : "reps"} guides load · 15 s resets`;
  if (e.kind === "mobility")
    return `2 × ${e.holdSeconds} s/side · 15 s rests · 5 active reps`;
  if (e.minutes) return `${e.minutes} min · RPE 3–4`;
  if (e.test && !e.benchmark) return "3 scored attempts · 88–92% opener";
  let s = `${e.sets} × ${e.repSequence ? e.repSequence.join(", ") : e.reps}`;
  if (e.kind === "failure") return s + " · strict-form failure";
  if (e.workingLoad) s += ` · ${e.workingLoad} lb`;
  else if (e.sequence)
    s +=
      " · " +
      e.sequence.map((r) => (r[0] === r[1] ? r[0] : r.join("–"))).join(", ") +
      "%";
  else if (e.range)
    s += ` · ${e.range[0] === e.range[1] ? e.range[0] : e.range.map((n) => Math.round(n * 10) / 10).join("–")}% ${e.anchor === "jerk" ? "RJ" : e.anchor === "cj" ? "CJ" : "SN"}`;
  if (e.kind === "quality")
    s += ` · effort ≤${e.effort}${e.finalEffort ? ` (final ≤${e.finalEffort})` : ""}`;
  else if (e.effort) s += " · " + e.effort;
  return s;
}
