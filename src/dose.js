// Practical allocation, not a measured individual optimum. See docs/SET-DOSE-REVIEW.md.
export const LEGACY_DOSE_VERSION = "reviewed-v1";
export const DOSE_VERSION = "complete-v2";
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
export const RESTART_TOTALS = [34, 42, 62, 80];
export function conventionalDose(id, sourceSets, c, reduced = false) {
  if (![DOSE_VERSION, LEGACY_DOSE_VERSION].includes(c.doseVersion))
    return sourceSets;
  if (reduced || c.entry === 1) return 1;
  if (
    c.entry < 3 ||
    (c.failureEntry || 1) < (c.doseVersion === DOSE_VERSION ? 3 : DOSE_STAGES)
  )
    return sourceSets;
  if (c.doseVersion === LEGACY_DOSE_VERSION || c.failureEntry === 3)
    return PREVIOUS_BASE[id] ?? sourceSets;
  return CONVENTIONAL_BASE[id] ?? sourceSets;
}
export function olympicDose(id, day, c) {
  if (
    ![DOSE_VERSION, LEGACY_DOSE_VERSION].includes(c.doseVersion) ||
    c.week >= 12
  )
    return 1;
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
    "12 direct sets: four flat-bench sets retain the required strength exposures; eight incline sets prioritize the upper chest without adding another press.",
  upper_chest:
    "Eight incline sets, plus uncounted flat-bench contribution. Keep four incline sets per exposure; adding more presses has a recovery/time cost for the priority lifts.",
  front_delts:
    "Zero isolation: 12 pressing sets give six fractional sets, with additional jerks. Another overhead-press block duplicates an already loaded region.",
  side_delts:
    "Ten direct lateral-raise sets, five per exposure. This is a physique priority and gets a larger direct allocation.",
  rear_delts:
    "Four reverse-pec-deck sets plus six rows (seven fractional sets). Dedicated work covers rear delts without assuming every row fully trains them.",
  traps:
    "Six direct shrug sets, three per exposure, plus unconverted Olympic work. Traps receive an explicit priority dose even if straps are used.",
  upper_back:
    "Six supported-row sets plus four pulldowns (eight fractional sets). Support limits extra spinal fatigue.",
  lats: "Four pulldown sets plus six rows (seven fractional sets). Full overhead reach provides the vertical-pull exposure; the row contribution depends on technique.",
  biceps:
    "Two supinated-curl and two hammer-curl sets plus ten pulling sets (nine fractional sets). Two grips provide complementary elbow-flexor work.",
  brachialis:
    "Two hammer-curl sets counted directly, with additional supinated curling/pulling. This overlaps the elbow-flexor total; do not add the two totals.",
  brachioradialis:
    "Two neutral-grip hammer-curl sets, one per exposure, plus unconverted pulling/curling. Neutral-grip selection is an anatomical inference, not proof of a unique optimal exercise or dose.",
  triceps:
    "Two overhead-extension sets plus 12 pressing sets (eight fractional sets), with extra jerk work uncounted. The overhead position retains direct long-head work.",
  quads:
    "Four squat and four leg-extension sets. Extensions complement squat training, including rectus femoris; Olympic work is additional but has no numerical hypertrophy credit.",
  glutes:
    "Four full-depth squat sets plus Olympic work; zero isolation as requested. This is an explicit goal constraint, not a claim of maximum glute growth.",
  hamstrings:
    "Six seated-leg-curl sets, three per exposure. Hip-flexed knee flexion trains the biarticular hamstrings at longer lengths and also trains the short biceps-femoris head. No extra failure hinge is added ahead of Olympic recovery.",
  calves:
    "Six knee-extended calf-raise sets, three per exposure. Standing work covers gastrocnemius and soleus; adding seated work is not necessary just to include soleus.",
  gastrocnemius:
    "Six standing/knee-extended sets (the same calf sets). A seated fallback is not counted as equivalent gastrocnemius work.",
  soleus:
    "The same six calf sets also train soleus; they are not six additional exercises or sets.",
  abs: "Four controlled crunch sets plus unconverted bracing. Direct trunk flexion is retained instead of treating every squat as an abdominal failure set.",
  adductors:
    "Zero isolation. Full-depth squats provide loaded adductor work; depth-specific longitudinal evidence supports this coverage. An exact set-equivalence or maximal-growth claim is not assigned.",
  erectors:
    "Zero isolation. Squats, pulls and Olympic lifts load spinal extension/bracing; more failure hinges add fatigue competing with the first priority. Supported rows avoid duplicating this burden.",
  wrist_flexors:
    "Four supported wrist-curl sets, two per exposure, after grip-dependent lifting. Direct wrist motion fills a gap that holding a bar does not reliably fill. The exact dose is a conservative regional inference.",
  wrist_extensors:
    "Four supported wrist-extension sets, two per exposure, after grip-dependent lifting. Pulling is not counted as equivalent extensor training; progress light loads with the same strict endpoint.",
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
    "Allocation",
    "The established exercise targets are prescribed now, not deferred to optional additions. Smaller regions have an explicit direct-work or zero-isolation decision below. Exact counts are programming inferences from group evidence, anatomy, failure fatigue and the priority order.",
  ],
  [
    "Restart",
    "Conventional sets progress through 34, 42, 62 and 80; Olympic sets through 9, 9, 11 and 15. A complete green week and normal next-session follow-ups are required to advance. Checkpoints, Realization, taper and pivot do not earn a dose increase. Newly added forearm exercises start at one set per exposure.",
  ],
  [
    "Individual response",
    "After reaching the allocation, review two stable green weeks before changing one weekly set. Check first-set reps, quality and the next Olympic exposure; measure physique trends across a full cycle. Recovery alone cannot identify an optimum. Remove work that compromises the higher priorities.",
  ],
  [
    "Time and priorities",
    "All sets, rests, warm-ups and moderate equipment waits remain in the clock. These requirements create long B/D visits; no evidence establishes that the resulting long session is optimal. Zero-isolation choices limit further time/fatigue. The plan makes a constrained allocation, not simultaneous maximum growth of every anatomical muscle.",
  ],
];
