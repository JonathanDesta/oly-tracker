// Practical allocation, not a measured individual optimum. See docs/SET-DOSE-REVIEW.md.
export const LEGACY_DOSE_VERSION = "reviewed-v1";
export const REGIONAL_DOSE_VERSION = "complete-v2";
export const DOSE_VERSION = "whole-week-v3";
export const DOSE_STAGES = 4;
export const PREVIOUS_BASE = {
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
export const CONVENTIONAL_BASE = {
  ...PREVIOUS_BASE,
  lateral: 5,
  row: 3,
  shrug: 3,
  rear_delt: 2,
  leg_curl: 3,
  calf: 3,
  crunch: 2,
  hammer_curl: 1,
  wrist_curl: 2,
  wrist_extension: 2,
};
// Source rows remain untouched. New exercises belong only to the amendment.
export const REGIONAL_ACCESSORIES = [
  ["hammer_curl", 1, 8, 12, 150],
  ["wrist_curl", 1, 12, 20, 120],
  ["wrist_extension", 1, 12, 20, 120],
];
// Stable program-slot keys: B is calendar Monday; C is Wednesday; D is Friday. A is a recovery slot.
export const WEEKLY_ALLOCATION = {
  tuesday: {
    front_squat: 2,
    bench: 2,
    incline: 3,
    lateral: 4,
    leg_curl: 2,
    calf: 2,
    leg_ext: 1,
    crunch: 1,
    triceps: 1,
    rear_delt: 1,
    shrug: 1,
  },
  thursday: {
    row: 4,
    pulldown: 4,
    shrug: 2,
    rear_delt: 1,
    curl: 1,
    leg_curl: 2,
    wrist_curl: 1,
    wrist_extension: 1,
  },
  friday: {
    back_squat: 2,
    bench: 2,
    incline: 3,
    lateral: 4,
    shrug: 1,
    triceps: 1,
    leg_ext: 1,
    calf: 2,
    crunch: 1,
    hammer_curl: 1,
    wrist_curl: 1,
    wrist_extension: 1,
  },
};
export const RESTART_TOTALS = [31, 41, 46, 56];
export function allocatedDose(id, day, c, reduced = false) {
  const target = WEEKLY_ALLOCATION[day]?.[id] || 0;
  if (!target) return 0;
  const stage = Math.min(c.entry || 1, 3) < 3 ? c.entry : c.failureEntry || 1;
  if (reduced || stage === 1 || c.week === 13) return 1;
  if (stage === 2)
    return Math.min(
      target,
      [
        "front_squat",
        "back_squat",
        "bench",
        "incline",
        "lateral",
        "row",
        "pulldown",
      ].includes(id)
        ? 2
        : 1,
    );
  if (stage === 3) return Math.min(target, 2);
  return target;
}
export function conventionalDose(id, sourceSets, c, reduced = false) {
  if (
    ![DOSE_VERSION, REGIONAL_DOSE_VERSION, LEGACY_DOSE_VERSION].includes(
      c.doseVersion,
    )
  )
    return sourceSets;
  if (reduced || c.entry === 1) return 1;
  if (
    c.entry < 3 ||
    (c.failureEntry || 1) <
      (c.doseVersion !== LEGACY_DOSE_VERSION ? 3 : DOSE_STAGES)
  )
    return sourceSets;
  if (c.doseVersion === LEGACY_DOSE_VERSION || c.failureEntry === 3)
    return PREVIOUS_BASE[id] ?? sourceSets;
  return CONVENTIONAL_BASE[id] ?? sourceSets;
}
export function olympicDose(id, day, c) {
  if (
    ![DOSE_VERSION, REGIONAL_DOSE_VERSION, LEGACY_DOSE_VERSION].includes(
      c.doseVersion,
    ) ||
    c.week >= 12
  )
    return 1;
  const stage = Math.min(c.entry, 3) < 3 ? 1 : c.failureEntry || 1;
  if (c.doseVersion === DOSE_VERSION) {
    if (!["snatch", "cj"].includes(id)) return 0;
    if (c.week === 11 || stage < 3) return 1;
    if (stage === 3) return id === "snatch" ? 2 : 1;
    return 2;
  }
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
  biceps: "Biceps / elbow flexors",
  brachialis: "Brachialis (overlapping elbow-flexor region)",
  brachioradialis: "Brachioradialis (forearm elbow flexor)",
  triceps: "Triceps",
  quads: "Quads",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  calves: "Calves (gastrocnemius + soleus)",
  gastrocnemius: "Gastrocnemius (calf subset)",
  soleus: "Soleus (calf subset)",
  abs: "Rectus abdominis",
  adductors: "Adductors",
  erectors: "Spinal erectors",
  wrist_flexors: "Wrist flexors",
  wrist_extensors: "Wrist extensors",
  forearms: "Finger flexors / grip",
  pronators: "Forearm pronators / supinators",
  obliques: "Obliques / deep abdominal wall",
  hip_abductors: "Hip abductors / external rotators",
  hip_flexors: "Hip flexors",
  tibialis: "Tibialis anterior / dorsiflexors",
  foot: "Foot intrinsics / ankle stabilizers",
  cuff: "Rotator cuff",
  serratus: "Serratus anterior",
  lower_traps: "Lower trapezius",
  neck: "Neck flexors / extensors",
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
  hammer_curl: { biceps: 1, brachialis: 1, brachioradialis: 1 },
  wrist_curl: { wrist_flexors: 1 },
  wrist_extension: { wrist_extensors: 1 },
  triceps: { triceps: 1 },
  front_squat: { quads: 1, glutes: 1 },
  back_squat: { quads: 1, glutes: 1 },
  leg_ext: { quads: 1 },
  leg_curl: { hamstrings: 1 },
  calf: { calves: 1, gastrocnemius: 1, soleus: 1 },
  crunch: { abs: 1 },
};
const UNQUANTIFIED = {
  bench: ["upper_chest"],
  row: ["forearms", "brachialis", "brachioradialis", "lower_traps"],
  pulldown: ["forearms", "brachialis", "brachioradialis"],
  shrug: ["forearms"],
  curl: ["brachialis", "brachioradialis", "pronators", "forearms"],
  hammer_curl: ["forearms"],
  calf: ["foot"],
  front_squat: ["adductors", "erectors", "abs", "obliques", "hip_abductors"],
  back_squat: ["adductors", "erectors", "abs", "obliques", "hip_abductors"],
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
for (const id of ["snatch", "hang", "cj", "jerk", "pause_jerk"])
  UNQUANTIFIED[id].push(
    "cuff",
    "serratus",
    "lower_traps",
    "obliques",
    "hip_abductors",
    "foot",
  );
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
            // Seated calf fallback shortens gastrocnemius; do not claim equivalent regional work.
            if (id === "gastrocnemius" && /Seated calf/i.test(e.name)) continue;
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

// Explicit decisions for every displayed region. Numeric counts come from rows,
// not from these rationales. Zero isolation is a deliberate constrained choice,
// never a claim that stabilization maximizes growth in that region.
export const MUSCLE_DECISIONS = {
  chest:
    "10 direct sets: four flat-bench sets for the required strength exposures and six incline sets emphasizing upper chest. This is a substantial pressing allocation within the total failure budget.",
  upper_chest:
    "Six incline sets, three on Monday and Friday, plus uncounted flat-bench contribution. Concentrate the additional chest work here; more pressing competes with jerk recovery and the total failure workload.",
  front_delts:
    "Zero isolation: 10 pressing sets give five fractional sets, with additional jerks. Another overhead-press block duplicates an already loaded region.",
  side_delts:
    "Eight direct lateral-raise sets, four per exposure. This is a physique priority and gets a larger direct allocation.",
  rear_delts:
    "Two reverse-pec-deck sets plus four rows (four fractional sets). Dedicated work covers rear delts without assuming every row fully trains them.",
  traps:
    "Four direct shrug sets across all three days, plus unconverted Olympic work. Traps receive an explicit priority dose even if straps are used.",
  upper_back:
    "Four supported-row sets plus four pulldowns (six fractional sets). Support limits extra spinal fatigue.",
  lats: "Four pulldown sets plus four rows (six fractional sets). Full overhead reach provides the vertical-pull exposure; the row contribution depends on technique.",
  biceps:
    "One supinated-curl and one hammer-curl set plus eight pulling sets (six fractional sets). Two grips provide complementary elbow-flexor work.",
  brachialis:
    "One hammer-curl set counted directly, with additional supinated curling/pulling. This overlaps the elbow-flexor total; do not add the two totals.",
  brachioradialis:
    "One neutral-grip hammer-curl set, plus unconverted pulling/curling. Neutral-grip selection is an anatomical inference, not proof of a unique optimal exercise or dose.",
  triceps:
    "Two overhead-extension sets plus ten pressing sets (seven fractional sets), with extra jerk work uncounted. The overhead position retains direct long-head work.",
  quads:
    "Four squat and two leg-extension sets. Extensions complement squat training, including rectus femoris; Olympic work is additional but has no numerical hypertrophy credit.",
  glutes:
    "Four full-depth squat sets plus Olympic work; zero isolation as requested. This is an explicit goal constraint, not a claim of maximum glute growth.",
  hamstrings:
    "Four seated-leg-curl sets, two per exposure, Monday and Wednesday with a recovery day between. Hip-flexed knee flexion trains the biarticular hamstrings at longer lengths and also trains the short biceps-femoris head. No extra failure hinge is added ahead of Olympic recovery.",
  calves:
    "Four knee-extended calf-raise sets, two per exposure, Monday and Friday. Standing work covers gastrocnemius and soleus; adding seated work is not necessary just to include soleus.",
  gastrocnemius:
    "Four standing/knee-extended sets (the same calf sets). A seated fallback is not counted as equivalent gastrocnemius work.",
  soleus:
    "The same four calf sets also train soleus; they are not four additional exercises or sets.",
  abs: "Two controlled crunch sets plus unconverted bracing. Direct trunk flexion is retained instead of treating every squat as an abdominal failure set.",
  adductors:
    "Zero isolation. Full-depth squats provide loaded adductor work; depth-specific longitudinal evidence supports this coverage. An exact set-equivalence or maximal-growth claim is not assigned.",
  erectors:
    "Zero isolation. Squats and Olympic lifts load spinal extension/bracing; more failure hinges add fatigue competing with the first priority. Supported rows avoid duplicating this burden.",
  wrist_flexors:
    "Two supported wrist-curl sets, one on Wednesday and Friday after grip-dependent lifting. Direct wrist motion fills a gap that holding a bar does not reliably fill. The exact dose is a conservative regional inference.",
  wrist_extensors:
    "Two supported wrist-extension sets, one on Wednesday and Friday after grip-dependent lifting. Pulling is not counted as equivalent extensor training; progress light loads with the same strict endpoint.",
  forearms:
    "Zero separate gripper sets: unstrapped Olympic lifts and pulling provide grip practice. Straps can reduce gripping in rows/pulldowns/shrugs, so that work has no fixed set credit. Wrist curls do not automatically count as finger-flexor sets.",
  pronators:
    "Zero dedicated pronation/supination sets. Curling and grip stabilization provide some exposure; dedicated maximal development is not claimed. The additional time is allocated to wrist flexion/extension and the stated physique priorities.",
  obliques:
    "Zero isolation. Squat/catch bracing and unilateral positions provide stabilization; this is not credited as failure-set hypertrophy. Additional loaded side bends/rotation are lower priority under the present time and fatigue constraints.",
  hip_abductors:
    "Zero isolation, respecting the no-glute-isolation constraint. Squat/catch stabilization and eligible athletics provide task-specific work, not proof of maximum regional growth.",
  hip_flexors:
    "Zero loaded isolation. Dynamic preparation and eligible running provide movement exposure. No demonstrated goal-specific limitation justifies another failure block.",
  tibialis:
    "Zero loaded isolation. Ankle preparation, walking and eligible running provide activity; these are not hypertrophy sets. No dorsiflexor-specific size goal or documented deficit was supplied.",
  foot: "Zero isolation. Calf work, receiving positions and eligible running/jumping load the foot/ankle. A specialized foot-strength dose is not assumed necessary without a relevant deficit.",
  cuff: "Zero failure isolation. Light external rotation is included in every lifting warm-up, with overhead stabilization in the lifts. Warm-ups count as preparation, not hypertrophy work; extra failure fatigue before catching is not prioritized.",
  serratus:
    "Zero isolation. Wall slides prepare upward rotation; overhead lifts require stabilization. This is a deliberate allocation to the main goals, not a maximal-serratus-growth claim.",
  lower_traps:
    "Zero isolation. Supported rows and overhead stabilization provide exposure, with wall-slide preparation. No numerical equivalence is claimed for stabilization.",
  neck: "Zero direct neck-failure sets. Traps and bracing are not treated as a neck-growth substitute, but a neck-size/contact-sport goal was not specified and another failure block has poor priority here.",
};
export const DOSE_REVIEWS = [
  [
    "Whole week",
    "Monday, Wednesday and Friday each begin with both competition lifts. The 56 conventional sets are distributed 20/16/20; the 12 Olympic sets are four per visit. Three specific exposures to each lift are preserved, with recovery days between failure sessions and no Tuesday/Thursday class conflict.",
  ],
  [
    "Restart",
    "Conventional sets progress 31 → 41 → 46 → 56; Olympic sets 6 → 6 → 9 → 12. Advance only after a complete green week and normal subsequent-session checks. Checkpoint, Realization, taper and pivot weeks hold or reduce work.",
  ],
  [
    "Why this allocation",
    "Upper chest, side delts and traps receive the extra physique allocation. Supported pulling, seated curls, standing calves and targeted isolation cover remaining regions without another failure hinge or redundant press. Hang snatches, rack jerks and pulls have no default failure sets; a documented technical need would justify a replacement, not automatic extra work.",
  ],
  [
    "Individual response",
    "Use the prescribed allocation, then review two stable green weeks before any single-set trial. Keep loads, exercise setup and other dose changes stable; compare first-set performance and the next Olympic session. Review physique measurements over a full cycle. Reverse additions without useful benefit or with a cost to the priority lifts.",
  ],
  [
    "Time",
    "Full Foundation visits budget about 225, 169 and 221 minutes before optional modules. All preparation, full rests, changes, moderate waiting and a ten-minute miscellaneous allowance remain included. This is the selected balance of specific practice, secondary muscle growth, fatigue and school availability; durations are planning targets, not physiological thresholds.",
  ],
];
