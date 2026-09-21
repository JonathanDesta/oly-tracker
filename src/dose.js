// Practical allocation, not a measured individual optimum. See docs/SET-DOSE-REVIEW.md.
export const DOSE_VERSION = "reviewed-v1";
export const DOSE_STAGES = 4;
export const CONVENTIONAL_BASE = {
  front_squat: 2,
  back_squat: 2,
  bench: 2,
  incline: 4,
  lateral: 4,
  row: 2,
  pulldown: 2,
  shrug: 2,
  rear_delt: 1,
  curl: 1,
  triceps: 1,
  leg_curl: 2,
  calf: 2,
  leg_ext: 2,
  crunch: 1,
};
export function conventionalDose(id, sourceSets, c, reduced = false) {
  if (c.doseVersion !== DOSE_VERSION) return sourceSets;
  if (reduced || c.entry === 1) return 1;
  if (c.entry < 3 || (c.failureEntry || 1) < DOSE_STAGES) return sourceSets;
  return CONVENTIONAL_BASE[id] ?? sourceSets;
}
export function olympicDose(id, day, c) {
  if (c.doseVersion !== DOSE_VERSION || c.week >= 12) return 1;
  const stage = Math.min(c.entry, 3) < 3 ? 1 : c.failureEntry || 1;
  if (stage < 3) return 1;
  if (stage === 3) return day === "friday" ? 2 : 1;
  return ["hang", "pull"].includes(id) || (day === "monday" && id === "cj")
    ? 1
    : 2;
}

// 0.5 is an accounting heuristic, not a validated conversion for this user.
// Regional chest counts overlap and must never be summed with total chest.
export const MUSCLES = {
  chest: "Chest (all regions)",
  upper_chest: "Upper chest (regional subset)",
  front_delts: "Front delts",
  side_delts: "Side delts",
  rear_delts: "Rear delts",
  traps: "Upper traps",
  upper_back: "Mid/upper back",
  lats: "Lats",
  biceps: "Elbow flexors",
  triceps: "Triceps",
  quads: "Quads",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  calves: "Calves",
  abs: "Abdominals",
  adductors: "Adductors",
  erectors: "Spinal erectors",
  forearms: "Grip / forearms",
};
const MAP = {
  bench: { chest: 1, front_delts: 0.5, triceps: 0.5 },
  incline: { chest: 1, upper_chest: 1, front_delts: 0.5, triceps: 0.5 },
  press: { front_delts: 1, side_delts: 0.5, triceps: 0.5 },
  lateral: { side_delts: 1 },
  shrug: { traps: 1 },
  row: { upper_back: 1, lats: 0.5, rear_delts: 0.5, biceps: 0.5 },
  pulldown: { lats: 1, upper_back: 0.5, biceps: 0.5 },
  rear_delt: { rear_delts: 1 },
  curl: { biceps: 1 },
  triceps: { triceps: 1 },
  front_squat: { quads: 1, glutes: 1 },
  back_squat: { quads: 1, glutes: 1 },
  leg_ext: { quads: 1 },
  leg_curl: { hamstrings: 1 },
  calf: { calves: 1 },
  crunch: { abs: 1 },
};
const UNQUANTIFIED = {
  bench: ["upper_chest"],
  row: ["forearms"],
  pulldown: ["forearms"],
  shrug: ["forearms"],
  front_squat: ["adductors", "erectors", "abs"],
  back_squat: ["adductors", "erectors", "abs"],
  snatch: [
    "traps",
    "upper_back",
    "quads",
    "glutes",
    "hamstrings",
    "erectors",
    "abs",
    "forearms",
    "side_delts",
  ],
  hang: [
    "traps",
    "upper_back",
    "quads",
    "glutes",
    "hamstrings",
    "erectors",
    "abs",
    "forearms",
    "side_delts",
  ],
  cj: [
    "traps",
    "upper_back",
    "quads",
    "glutes",
    "hamstrings",
    "erectors",
    "abs",
    "forearms",
    "front_delts",
    "triceps",
  ],
  clean: [
    "traps",
    "upper_back",
    "quads",
    "glutes",
    "hamstrings",
    "erectors",
    "abs",
    "forearms",
  ],
  jerk: ["traps", "quads", "glutes", "abs", "front_delts", "triceps"],
  pause_jerk: ["traps", "quads", "glutes", "abs", "front_delts", "triceps"],
  pull: [
    "traps",
    "upper_back",
    "quads",
    "glutes",
    "hamstrings",
    "erectors",
    "abs",
    "forearms",
  ],
};
export function doseLedger(plans) {
  const muscles = Object.fromEntries(
    Object.keys(MUSCLES).map((id) => [
      id,
      { direct: 0, indirect: 0, fractional: 0, additional: [] },
    ]),
  );
  const exercises = [];
  for (const p of plans)
    for (const se of p.sessions.filter((s) => !s.skipped))
      for (const e of se.rows) {
        if (!["quality", "failure"].includes(e.kind)) continue;
        exercises.push({
          day: p.day,
          session: se.id,
          key: e.key,
          id: e.id,
          name: e.name,
          sets: e.sets,
          olympic: e.kind === "quality",
        });
        if (e.kind === "failure")
          for (const [id, credit] of Object.entries(MAP[e.id] || {})) {
            muscles[id][credit === 1 ? "direct" : "indirect"] += e.sets;
            muscles[id].fractional += e.sets * credit;
          }
        for (const id of UNQUANTIFIED[e.id] || [])
          if (!muscles[id].additional.includes(e.name))
            muscles[id].additional.push(e.name);
      }
  return {
    exercises,
    muscles,
    olympic: exercises.filter((e) => e.olympic).reduce((n, e) => n + e.sets, 0),
    conventional: exercises
      .filter((e) => !e.olympic)
      .reduce((n, e) => n + e.sets, 0),
  };
}

// Review landmarks, deliberately not automatic prescriptions or ceilings.
export const DOSE_REVIEWS = [
  [
    "Olympic lifts / squat support",
    "First priority: compare valid reps, technical consistency, and the next Olympic session. Trial one weekly set on the relevant exercise if additional practice or strength is useful; recovery alone is not proof of an adequate dose.",
  ],
  [
    "Upper chest / side delts / traps",
    "After establishing the base: trial incline toward 10–12 direct weekly sets, laterals toward 10–12, and shrugs toward 6. Change one weekly set at a time; do not delay traps until every chest/delt target is reached.",
  ],
  [
    "Back / rear delts / arms",
    "Review rows and pulldowns toward 8–12 fractional weekly sets per region, rear delts toward 6–8, and arms toward 8–12 including indirect work. Add to the exercise matching the region; pressing does not replace every benefit of overhead triceps work.",
  ],
  [
    "Quads / hamstrings / calves / trunk",
    "Review quads toward 10–12 conventional sets, hamstrings and calves toward 6–10 direct sets, and abs toward 4–6. Squat support takes priority when it helps the lifts. Glute work comes from squats and Olympic lifting; no glute isolation.",
  ],
];
