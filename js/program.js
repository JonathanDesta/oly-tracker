'use strict';

// ─── Exercise library ────────────────────────────────────────────────────────
// type: 'oly'|'strength'|'hypertrophy'|'technical'|'cardio'|'core'|'jump'|'warmup'|'max_effort'|'mobility'
const EX = {
  // ── Warm-ups / cardio ──
  zone2_warmup: {
    name: 'Zone 2 Warm-up',
    type: 'cardio',
    notes: '15–20 min easy bike or row. Conversational pace — you should be able to speak in full sentences. Mandatory before Olympic block on Mon/Thu.',
  },
  box_jumps: {
    name: 'Box Jumps',
    type: 'jump',
    notes: 'Maximal intent on every jump. Step DOWN — never jump down. Develops vertical explosive power and PAP (post-activation potentiation) for subsequent snatch. 3–5 reps × 3 sets.',
  },
  broad_jumps: {
    name: 'Broad Jumps',
    type: 'jump',
    notes: 'Maximal horizontal distance on every jump. Develops horizontal power — an athletic quality not trained by the vertical-dominant Oly lifts. Also provides PAP for subsequent snatch. 3–5 reps × 3 sets.',
  },

  // ── Snatch family ──
  snatch_warmup: {
    name: 'Snatch Warm-up',
    type: 'warmup',
    baseLift: 'snatch',
    notes: 'Position focus only. 3 sets × 3 reps at 50–60% of snatch max.',
  },
  snatch_floor: {
    name: 'Snatch (from floor)',
    type: 'oly',
    baseLift: 'snatch',
    notes: 'Full competition lift. Done first while freshest — primary movement takes absolute priority. Focus on consistent setup, full extension through toes, and aggressive hip contact.',
    cues: ['Full extension — tall as possible before pulling under', 'Aggressive hip contact, not arm pull', 'Fast elbows under the bar', 'Receive in a strong overhead squat'],
  },
  snatch_blocks_low: {
    name: 'Snatch from Blocks (below knee)',
    type: 'oly',
    baseLift: 'snatch',
    notes: 'Isolates the second pull and receiving position. Start each rep from a static position off the blocks — no dip and swing. Focuses on everything that happens above the knee.',
    cues: ['Maintain back angle off the blocks', 'Push the floor away', 'Aggressive second pull — hip contact with the bar'],
  },
  hang_snatch: {
    name: 'Hang Snatch (above knee)',
    type: 'oly',
    baseLift: 'snatch',
    notes: 'Teaches second pull and hip contact. Done after floor snatch as supplemental work. Hinge to above-knee position, maintain tension, then fire.',
    cues: ['Load the hips at the hang position', 'Violent hip extension', 'Bar stays close throughout'],
  },
  snatch_pull: {
    name: 'Snatch Pull',
    type: 'strength',
    baseLift: 'snatch',
    notes: 'Full extension through shrug. Load is heavier than the snatch itself — builds pulling strength. Finish on toes, shrug forcefully at the top.',
    cues: ['Same setup as snatch', 'Push the floor away — leg drive first', 'Full extension: ankles, knees, hips, shrug', 'Do not bend arms'],
  },
  snatch_balance: {
    name: 'Snatch Balance',
    type: 'technical',
    baseLift: 'snatch',
    notes: 'Most important drill for fixing a slow receive. Bar starts on back, dip and drive bar overhead while simultaneously dropping under it. Speed under the bar — zero hesitation in the receive.',
    cues: ['Dip is narrow and vertical', 'Drive the bar UP, pull yourself DOWN simultaneously', 'Receive with locked elbows and active shoulders', 'No starfishing — feet land where they\'ll be in the snatch'],
  },
  power_snatch: {
    name: 'Power Snatch',
    type: 'technical',
    baseLift: 'snatch',
    notes: 'Forces pulling height — you must pull high enough to receive above parallel. Great diagnostic: if you can\'t power snatch 80%+ of your full snatch, your pull is leaving early.',
    cues: ['Pull higher than you think you need to', 'Upright torso at the catch', 'Receive with slightly bent knees — not deep'],
  },
  snatch_daily_max: {
    name: 'Snatch — Daily Max',
    type: 'max_effort',
    baseLift: 'snatch',
    notes: 'Build up in singles. Stop at the last technically clean lift — this is not a max-miss session. On good days you\'ll go higher; on bad days stop earlier. No grinding, no misses.',
    cues: ['3% jumps above 80%', 'Stop before you think you need to on bad days', 'A technically perfect 93% beats a grind at 97%'],
  },
  ohs: {
    name: 'Overhead Squat',
    type: 'technical',
    baseLift: 'snatch',
    notes: 'Position work — never skip. Twice weekly (Mon + Thu) to build the snatch receiving position. Slow descent, pause at bottom, drive out of the hole with locked elbows.',
    cues: ['Wide grip — snatch grip', 'Push the bar apart (external rotation)', 'Chest up, active shoulders', 'Knees track over toes'],
  },

  // ── Clean & Jerk family ──
  cj_warmup: {
    name: 'C&J Warm-up',
    type: 'warmup',
    baseLift: 'cj',
    notes: 'Use power cleans to groove the pull pattern. 3 sets × 3 reps at 55–65% of C&J max.',
  },
  cj_floor: {
    name: 'Clean & Jerk',
    type: 'oly',
    baseLift: 'cj',
    notes: '2 cleans then 1 jerk per set. Done first while freshest. Jerk only from the last clean — do not re-dip. If the jerk is the limiter, note it.',
    cues: ['Elbows high in the front rack', 'Dip is vertical — weight stays midfoot', 'Drive through the heels on the jerk dip', 'Aggressive lock-out overhead'],
  },
  clean_blocks_low: {
    name: 'Clean from Blocks (below knee)',
    type: 'oly',
    baseLift: 'cj',
    notes: 'Second pull and receiving position isolation. Same as snatch blocks but for the clean. Static start each rep.',
    cues: ['Elbows lead the bar into the rack', 'Keep hips in — don\'t let them shoot back', 'Soft landing, immediate stand'],
  },
  hang_clean: {
    name: 'Hang Clean (above knee)',
    type: 'oly',
    baseLift: 'cj',
    notes: 'Hip contact and aggressive turnover. Done after C&J as supplemental work. Focus on the speed of the elbows rotating under.',
    cues: ['Load at the hips', 'Violent extension', 'Elbows through fast — don\'t muscle the bar up'],
  },
  clean_pull: {
    name: 'Clean Pull',
    type: 'strength',
    baseLift: 'cj',
    notes: 'Same as snatch pull but at clean grip. Builds clean pulling strength. Finish tall on toes with a forceful shrug.',
    cues: ['Same back angle as clean', 'Legs first, then hips, then shrug', 'No arm bend'],
  },
  cj_daily_max: {
    name: 'Clean & Jerk — Daily Max',
    type: 'max_effort',
    baseLift: 'cj',
    notes: 'Build up in singles (1+1). Stop at your last technically clean C&J. On Fridays in Block 1, stop at ~84% effort — Saturdays are the true max day.',
    cues: ['3% jumps above 80%', 'If the jerk fails, it counts as a miss', 'Stop before the bar slows significantly'],
  },
  jerk_rack: {
    name: 'Jerk from Rack',
    type: 'oly',
    baseLift: 'cj',
    notes: 'Pure jerk technique with zero clean fatigue. Set up in rack with bar in front rack position. Isolated work on dip-drive timing.',
    cues: ['Vertical dip — no forward lean', 'Drive bar off shoulders, not just push', 'Split position: front foot punches forward, back knee drops', 'Lock out arms before landing'],
  },
  push_press: {
    name: 'Push Press',
    type: 'strength',
    baseLift: 'pp',
    notes: 'Leg drive timing for the jerk. Placed before pulls and squats — technical overhead work is best done while still in pressing mode, before lower body fatigue accumulates.',
    cues: ['Dip is shallow (2–3 inches)', 'Drive legs first, then press', 'Receive with locked elbows at top of press — no re-dip'],
  },

  // ── Squats ──
  back_squat: {
    name: 'Back Squat',
    type: 'strength',
    baseLift: 'bs',
    notes: 'High bar squat — same stance as your squat clean receive. Builds leg drive out of the hole.',
    cues: ['Brace hard before unracking', 'Controlled descent — 2–3 sec', 'Drive knees out at the bottom', 'Bar path stays vertical'],
  },
  front_squat: {
    name: 'Front Squat',
    type: 'strength',
    baseLift: 'fs',
    notes: 'Clean receiving position. Elbows high throughout — if elbows drop, the bar dumps forward. Builds the upright torso strength needed for heavy cleans.',
    cues: ['Elbows up — higher than you think', 'Chest tall throughout', 'Knees forward and out', 'Full depth'],
  },
  pause_front_squat: {
    name: 'Pause Front Squat (2s in hole)',
    type: 'technical',
    baseLift: 'fs',
    notes: 'Position strength and ankle/hip mobility. 2-second pause at full depth — no bouncing out. Builds the specific strength to recover from a heavy clean.',
    cues: ['Elbows must stay up during the pause', 'Stay tight — don\'t relax at the bottom', 'Drive straight up out of pause'],
  },
  rdl: {
    name: 'Romanian Deadlift',
    type: 'hypertrophy',
    notes: 'Posterior chain work. Maintain a flat back throughout — this is not a deadlift. Hip hinge until you feel a deep hamstring stretch, then drive hips forward.',
    cues: ['Soft knee bend throughout', 'Bar slides down the legs', 'Stop when back starts to round — not at the floor'],
  },

  // ── Upper Push ──
  incline_db_press: {
    name: 'Incline DB Press (30–45°)',
    type: 'hypertrophy',
    notes: '30–45° is the optimal range for clavicular (upper) head activation. Front deltoid dominance doesn\'t meaningfully increase until above ~50°. Use a full stretch at the bottom — slight pause, no bounce.',
    cues: ['Elbows at ~45° from torso (not flared)', 'Full stretch at bottom, full press at top', 'Control the descent — 2 sec down'],
  },
  incline_bar_press: {
    name: 'Incline Barbell Press (30–45°)',
    type: 'hypertrophy',
    notes: 'Heavier upper chest loading on Saturdays. Same angle rules as DB press — stay below 50°. Compound — longer rest.',
    cues: ['Grip just outside shoulder width', 'Slight arch — do not flatten your back', 'Touch the upper chest, not the neck'],
  },
  low_high_cable_fly: {
    name: 'Low-to-High Cable Fly',
    type: 'hypertrophy',
    notes: 'Anchor at lowest point. Pull upward and across the body. Upper chest isolation — loads the clavicular head at stretch. RPE 8.',
    cues: ['Anchor cable at floor or lowest setting', 'Arc upward toward the opposite shoulder', 'Slight forward lean', 'Feel the stretch at the bottom of each rep'],
  },
  flat_bench: {
    name: 'Flat Bench Press',
    type: 'strength',
    baseLift: 'bench',
    notes: 'Work up to a heavy set on Saturdays. On subsequent blocks, these become maintenance sets.',
    cues: ['Retract scapula before unracking', 'Touch lower chest (not neck)', 'Leg drive into the floor'],
  },

  // ── Side Delts ──
  cable_lateral: {
    name: 'Cable Lateral Raise',
    type: 'hypertrophy',
    notes: 'Constant tension throughout — superior to dumbbell version due to tension at the bottom position where dumbbells go slack. RPE 8. Lean slightly away from the cable.',
    cues: ['Lead with the elbow — not the wrist', 'Slight forward lean of the arm (30° in front of body plane)', 'Control the descent — don\'t let cable drag arm down', 'Slight stretch at bottom of each rep'],
  },
  db_lateral_partial: {
    name: 'DB Lateral Raise (bottom-range partial)',
    type: 'hypertrophy',
    notes: 'Emphasize the bottom 60% of ROM only — keeps load on the stretch position where the delt is most stimulated. 20–25 reps. This is a finisher, not a heavy exercise.',
    cues: ['Never raise above parallel', 'Focus on the stretch — feel it at the bottom', 'Slow controlled movement', 'High reps, light weight'],
  },
  crossbody_cable_lateral: {
    name: 'Crossbody Cable Lateral Raise',
    type: 'hypertrophy',
    notes: 'Cable from the opposite side — arm crosses body at start. Loads the lateral delt in deep stretch. RPE 8.',
    cues: ['Cable comes from the opposite hip', 'Arm starts crossed in front of body', 'Pull directly out to the side', 'Maximum stretch at the bottom'],
  },
  cable_upright_row: {
    name: 'Wide-Grip Cable Upright Row',
    type: 'hypertrophy',
    notes: 'Grip wider than shoulders — elbows flare outward. Wide grip = lateral delt dominant. Narrow grip = trap dominant (avoid that here).',
    cues: ['Elbows must be higher than wrists at the top', 'Pull to upper chest level', 'Lead with the elbows, not the hands'],
  },

  // ── Upper Pull / Back ──
  pendlay_row: {
    name: 'Pendlay Row',
    type: 'hypertrophy',
    notes: 'Bar starts from the floor each rep (dead stop). Builds upper back positional strength for pulling mechanics. Horizontal pull that complements the vertical pulling of the Oly lifts.',
    cues: ['Torso parallel to floor or close to it', 'Explode the bar to the lower chest', 'Lower under control to dead stop on the floor'],
  },
  lat_pulldown: {
    name: 'Lat Pulldown (wide neutral grip)',
    type: 'hypertrophy',
    notes: 'Neutral or supinated grip, slightly wider than shoulder width. Drives lat development critical for bar path control in the pull. RPE 8.',
    cues: ['Slight lean back', 'Pull to upper chest — not behind the neck', 'Squeeze the lats at the bottom', 'Slow controlled ascent'],
  },
  straight_arm_pulldown: {
    name: 'Straight-Arm Cable Pulldown',
    type: 'hypertrophy',
    notes: 'Arms stay straight throughout — isolates the lat entirely without bicep involvement. The most lat-specific single exercise. RPE 8.',
    cues: ['Arms perfectly straight throughout', 'Hinge slightly at the hips', 'Drive the bar to your hips with your lats — not your arms', 'Full stretch overhead at top'],
  },
  rear_delt_fly: {
    name: 'Rear Delt Cable Fly',
    type: 'hypertrophy',
    notes: 'RPE 7. Shoulder balance work. Cable crosses over — pull from opposite side. Keep arms almost straight throughout.',
    cues: ['Almost straight arms', 'Pull arc out and back — not just back', 'Squeeze rear delts at end range'],
  },
  face_pull: {
    name: 'Face Pull (rope)',
    type: 'hypertrophy',
    notes: 'MANDATORY — non-negotiable shoulder health work every push day. Light weight. External rotation at the end of each rep is the whole point.',
    cues: ['Cable at upper chest height', 'Pull to forehead — not chin', 'Externally rotate at the end: hands go wider than elbows', 'Never go heavy on this'],
  },

  // ── Biceps ──
  incline_db_curl: {
    name: 'Incline DB Curl',
    type: 'hypertrophy',
    notes: '~45° incline. Loads the long head of the bicep at full stretch. Most important single bicep exercise. RPE 8.',
    cues: ['Arms hang behind you — full stretch at the bottom', 'Do not swing — keep upper arm vertical throughout', 'Supinate at the top (pinky up)'],
  },
  cable_curl: {
    name: 'Cable Curl (low anchor)',
    type: 'hypertrophy',
    notes: 'Constant tension throughout the range. Finisher after incline curls. RPE 8.',
    cues: ['Keep elbows pinned to sides', 'Full extension at the bottom', 'Squeeze hard at the top'],
  },

  // ── Triceps ──
  cable_overhead_tricep: {
    name: 'Cable Overhead Tricep Extension',
    type: 'hypertrophy',
    notes: 'Arm overhead — this is essential. Overhead position loads the long head, which is the largest and most visible head of the tricep. Full stretch at the bottom. RPE 8.',
    cues: ['Upper arm stays vertical and still throughout', 'Full stretch — feel it in the armpit area', 'Extend fully overhead on each rep'],
  },

  // ── Core ──
  ab_wheel: {
    name: 'Ab Wheel Rollout',
    type: 'core',
    notes: 'Full extension — go as far as you can while keeping your back from sagging. Core stiffness transfers directly to Oly positions.',
    cues: ['Brace your core before rolling out', 'Keep hips in line — no sag or pike', 'Pull back with lats as well as abs'],
  },
  pallof_press: {
    name: 'Pallof Press',
    type: 'core',
    notes: 'Anti-rotation stability. Cable at chest height, press straight out and hold 1–2 sec, return. The goal is to resist the cable pulling you sideways.',
    cues: ['Stand perpendicular to the cable', 'Do not rotate — that\'s the whole point', '10 reps per side'],
  },
  weighted_plank: {
    name: 'Weighted Plank',
    type: 'core',
    notes: 'Plate on back. 30–45 seconds. Quality over duration.',
    cues: ['Perfectly neutral spine', 'Glutes and quads tight — not just abs', 'Plate sits on upper back'],
  },

  // ── Lower Accessory ──
  nordic_curl: {
    name: 'Nordic Hamstring Curl',
    type: 'hypertrophy',
    notes: 'Single most important injury-prevention exercise for Olympic lifters. Eccentric control throughout — the lowering phase is the stimulus. If new, start with partial reps from the knees and lower only halfway.',
    cues: ['Hips extended throughout — no bending at the hip', 'Lower as slowly as possible', 'Use hands to push back up — that\'s fine', 'Full extension at the top'],
  },
  bss: {
    name: 'Bulgarian Split Squat',
    type: 'hypertrophy',
    notes: 'Rear foot elevated. Switch legs immediately between, rest 2 min between full sets. Builds single-leg strength and hip flexor mobility.',
    cues: ['Front foot far enough forward that your shin stays vertical', 'Back knee drops straight down', 'Drive through the heel of the front foot'],
  },
  calf_raise: {
    name: 'Calf Raise (weighted, full ROM)',
    type: 'hypertrophy',
    notes: 'Full dorsiflexion at bottom, full plantarflexion at top. The full range matters — partial calf raises produce partial results.',
    cues: ['Pause at the bottom (max stretch)', 'Rise all the way up on every rep', 'Single-leg if you have the balance'],
  },

  // ── Cardio ──
  vo2max_intervals: {
    name: 'VO₂max Intervals',
    type: 'cardio',
    notes: '5 × 3 min at ~95% max HR / 3 min easy recovery. Bike or rower preferred (lower joint stress). You should only be able to sustain each 3-min effort for exactly 3 minutes. If you feel comfortable at the end, you are not going hard enough.',
  },

  // ── Mobility ──
  ankle_wall_drill: { name: 'Ankle Wall Drill (dorsiflexion)', type: 'mobility', notes: '#1 Oly squat limiter. 3×10/side.' },
  couch_stretch: { name: 'Couch Stretch (hip flexor)', type: 'mobility', notes: '2 min/side. Hip extension for jerk and athletic output.' },
  thoracic_ext: { name: 'Thoracic Extension (foam roller)', type: 'mobility', notes: '2–3 min. Overhead position and front rack.' },
  pvc_dislocates: { name: 'PVC Shoulder Dislocates', type: 'mobility', notes: '2×15. Snatch-width shoulder mobility.' },
  ohs_bodyweight: { name: 'Overhead Squat (bodyweight)', type: 'mobility', notes: '3×5 with pause at bottom. Integrates all mobility patterns.' },
};

// ─── Block 1 progression tables ───────────────────────────────────────────────
// Index = week within block (0=week1, 1=week2, 2=week3, 3=week4)
const B1 = {
  oly_sets_pct:    [72, 75, 78, 81],   // main oly lift sets (snatch floor, C&J floor)
  hang_pct:        [70, 73, 76, 79],   // hang variations (2% below floor)
  blocks_pct:      [76, 79, 82, 85],   // block variations (Thu/Fri, slightly heavier)
  daily_max_pct:   [83, 86, 89, 92],   // daily max target (midpoint of range)
  pull_pct:        [92, 92, 95, 95],   // snatch/clean pull (% of respective lift)
  bs_mon_pct:      [70, 72, 75, 78],
  bs_thu_pct:      [78, 80, 82, 85],
  fs_tue_pct:      [74, 76, 79, 82],
  fs_fri_pct:      [80, 83, 86, 89],
  jerk_rack_wed_pct:  [70, 70, 72, 74],
  jerk_rack_fri_pct:  [80, 82, 85, 87],
  push_press_pct:  [70, 70, 72, 74],   // % of PP max
};

// Block 2 progression (weeks 1-4 of block, i.e. program weeks 5-8)
const B2 = {
  oly_sets_pct:    [83, 86, 88, 90],
  hang_pct:        [80, 83, 86, 88],
  blocks_pct:      [86, 89, 91, 93],
  daily_max_pct:   [93, 96, 98, 100],
  pull_pct:        [100, 103, 105, 107],
  bs_mon_pct:      [80, 82, 84, 86],
  bs_thu_pct:      [85, 87, 89, 91],
  fs_tue_pct:      [76, 79, 82, 84],
  fs_fri_pct:      [83, 86, 88, 90],
  jerk_rack_wed_pct:  [74, 77, 80, 82],
  jerk_rack_fri_pct:  [88, 90, 92, 94],
  push_press_pct:  [76, 79, 82, 84],
};

// Block 3 (weeks 1-3 of block, program weeks 9-11) — peak phase
const B3 = {
  oly_sets_pct:    [88, 90, 93],
  daily_max_pct:   [100, 103, 105],
  pull_pct:        [105, 108, 110],
  bs_mon_pct:      [84, 86, 88],
  bs_thu_pct:      [88, 90, 93],
  fs_tue_pct:      [82, 85, 88],
  fs_fri_pct:      [88, 91, 94],
};

// ─── Day definitions ──────────────────────────────────────────────────────────
// Each day is an array of blocks (sections).
// Each section has: title, exercises[]
// Each exercise has: id, sets, reps/repRange/duration, prescription, rest (seconds)

// ─── Build-up ladders (from the program document) ────────────────────────────
// Each step: { pct, reps, rest(seconds), top? }. Weights are computed from the
// athlete's max at render time. These drive both the on-screen ramp and the
// session time estimate.

// Thu/Fri Olympic daily max: after the block work, ramp 80 → 83 → 86 (3% steps),
// then +2% singles to the week's daily-max target.
function rampOlyDaily(targetPct, reps) {
  const t = Math.round(targetPct);
  const steps = [];
  [[80, 180], [83, 240], [86, 240]].forEach(([p, r]) => { if (p <= t) steps.push({ pct: p, reps, rest: r }); });
  let p = (steps.length ? steps[steps.length - 1].pct : 78) + 2;
  while (p <= t) { steps.push({ pct: p, reps, rest: 270 }); p += 2; }
  if (!steps.length) steps.push({ pct: t, reps, rest: 240 });
  if (steps[steps.length - 1].pct !== t) steps.push({ pct: t, reps, rest: 270 });
  steps[steps.length - 1].top = true;
  return steps;
}

// Saturday Olympic max effort: full warm-up ramp, then 2–3% jumps to daily max.
function rampOlySaturday(targetPct, reps) {
  const t = Math.round(targetPct);
  const steps = [
    { pct: 65, reps: '2', rest: 90 },
    { pct: 73, reps, rest: 120 },
    { pct: 78, reps, rest: 180 },
    { pct: 82, reps, rest: 240 },
  ];
  let p = 85;
  while (p < t) { steps.push({ pct: p, reps, rest: 270 }); p += 3; }
  if (steps[steps.length - 1].pct !== t) steps.push({ pct: t, reps, rest: 300 });
  steps[steps.length - 1].top = true;
  return steps;
}

// Saturday heavy compounds — fixed ramps straight from the document.
const RAMP_SAT_BS = [
  { pct: 60, reps: '5', rest: 120 }, { pct: 72, reps: '3', rest: 180 },
  { pct: 80, reps: '3', rest: 240 }, { pct: 85, reps: '3', rest: 270, top: true },
];
const RAMP_SAT_PP = [
  { pct: 60, reps: '5', rest: 90 }, { pct: 72, reps: '3', rest: 120 },
  { pct: 80, reps: '3', rest: 180 }, { pct: 85, reps: '3', rest: 210, top: true },
];
const RAMP_SAT_BENCH = [
  { pct: 60, reps: '5', rest: 90 }, { pct: 70, reps: '4', rest: 120 },
  { pct: 78, reps: '3', rest: 180 }, { pct: 84, reps: '3–5', rest: 210, top: true },
];

function makeDays(B, weekIdx) {
  const w = weekIdx; // 0-based index into progression arrays

  const olyPct = B.oly_sets_pct[w];
  const hangPct = B.hang_pct?.[w];
  const blocksPct = B.blocks_pct?.[w];
  const dmPct = B.daily_max_pct[w];
  const pullPct = B.pull_pct[w];
  const bsMonPct = B.bs_mon_pct[w];
  const bsThuPct = B.bs_thu_pct[w];
  const fsTuePct = B.fs_tue_pct[w];
  const fsFriPct = B.fs_fri_pct[w];
  const jerkWedPct = B.jerk_rack_wed_pct?.[w] ?? 70;
  const jerkFriPct = B.jerk_rack_fri_pct?.[w] ?? 80;
  const ppPct = B.push_press_pct?.[w] ?? 70;

  return {
    // ── MONDAY ──────────────────────────────────────────────────────────────
    monday: {
      title: 'Monday — Snatch + Back Squat + Push Hypertrophy',
      totalMin: 105,
      totalMinNoSport: 110, // box jumps reinstated
      sections: [
        {
          title: 'Olympic Block',
          color: 'gold',
          exercises: [
            { id: 'zone2_warmup', duration: '15–20 min', rest: 0 },
            { id: 'box_jumps', sets: 3, reps: '3–5', rest: 90, optional: true,
              optNote: 'Cut by default — pickup sport already supplies jumping/landing volume. Reinstate only after a week+ with no sport.' },
            { id: 'snatch_warmup', sets: 3, reps: 3, pct: 55, baseLift: 'snatch', rest: 90 },
            { id: 'snatch_floor', sets: 5, reps: 2, pct: olyPct, baseLift: 'snatch', rest: 120 },
            { id: 'hang_snatch', sets: 5, reps: 3, pct: hangPct ?? olyPct - 2, baseLift: 'snatch', rest: 120 },
            { id: 'snatch_pull', sets: 4, reps: 3, pct: pullPct, baseLift: 'snatch', rest: 120 },
            { id: 'back_squat', sets: 4, reps: 5, pct: bsMonPct, baseLift: 'bs', rest: 120 },
            { id: 'ohs', sets: 3, reps: 3, pct: 60, baseLift: 'snatch', rest: 90 },
          ],
        },
        {
          title: 'Hypertrophy Block',
          color: 'blue',
          exercises: [
            { id: 'incline_db_press', sets: 4, repRange: [10, 12], rest: 165 },
            { id: 'low_high_cable_fly', sets: 3, repRange: [12, 15], rest: 90 },
            { id: 'cable_lateral', sets: 4, repRange: [15, 20], rest: 60 },
            { id: 'face_pull', sets: 3, repRange: [15, 20], rest: 60 },
            { id: 'cable_overhead_tricep', sets: 3, repRange: [10, 12], rest: 90 },
          ],
        },
      ],
    },

    // ── TUESDAY ─────────────────────────────────────────────────────────────
    tuesday: {
      title: 'Tuesday — Clean & Jerk + Front Squat + Pull/Lats/Biceps',
      totalMin: 110,
      sections: [
        {
          title: 'Olympic Block',
          color: 'gold',
          exercises: [
            { id: 'cj_warmup', sets: 3, reps: '2+1', pct: 60, baseLift: 'cj', rest: 90 },
            { id: 'cj_floor', sets: 5, reps: '2+1', pct: olyPct, baseLift: 'cj', rest: 180 },
            { id: 'hang_clean', sets: 4, reps: 3, pct: hangPct ?? olyPct - 2, baseLift: 'cj', rest: 120 },
            { id: 'push_press', sets: 3, reps: 4, pct: ppPct, baseLift: 'pp', rest: 120 },
            { id: 'clean_pull', sets: 4, reps: 3, pct: pullPct, baseLift: 'cj', rest: 120 },
            { id: 'front_squat', sets: 4, reps: 4, pct: fsTuePct, baseLift: 'fs', rest: 120 },
          ],
        },
        {
          title: 'Hypertrophy Block',
          color: 'blue',
          exercises: [
            { id: 'pendlay_row', sets: 3, reps: 8, rest: 165 },
            { id: 'lat_pulldown', sets: 3, repRange: [10, 12], rest: 90 },
            { id: 'straight_arm_pulldown', sets: 3, repRange: [12, 15], rest: 60 },
            { id: 'crossbody_cable_lateral', sets: 3, repRange: [15, 20], rest: 60 },
            { id: 'rear_delt_fly', sets: 3, repRange: [15, 20], rest: 60 },
            { id: 'incline_db_curl', sets: 3, repRange: [10, 15], rest: 90 },
            { id: 'cable_curl', sets: 2, repRange: [12, 15], rest: 60 },
          ],
        },
      ],
    },

    // ── WEDNESDAY ───────────────────────────────────────────────────────────
    wednesday: {
      title: 'Wednesday — Technical (Recovery Day)',
      totalMin: 50,
      totalMinNoSport: 80, // VO₂max intervals reinstated
      sections: [
        {
          title: 'Technical Block',
          color: 'gold',
          note: 'Skill work — do not let intensity drift upward. This is not a hard training session.',
          exercises: [
            { id: 'snatch_balance', sets: 5, reps: 3, pct: 58, baseLift: 'snatch', rest: 120 },
            { id: 'power_snatch', sets: 4, reps: 3, pct: 70, baseLift: 'snatch', rest: 120 },
            { id: 'jerk_rack', sets: 5, reps: 3, pct: jerkWedPct, baseLift: 'cj', rest: 120 },
            { id: 'pause_front_squat', sets: 3, reps: 3, pct: 65, baseLift: 'fs', rest: 120 },
          ],
        },
        {
          title: 'VO₂max Intervals — optional',
          color: 'red',
          note: 'Covered by your ~2 weekly running-sport sessions, so omitted by default. Do this ONLY in a week with no pickup sport.',
          exercises: [
            { id: 'vo2max_intervals', duration: '5 × 3 min on / 3 min off', rest: 0, optional: true,
              interval: { rounds: 5, workSec: 180, restSec: 180, lastRest: false } },
          ],
        },
      ],
    },

    // ── THURSDAY ────────────────────────────────────────────────────────────
    thursday: {
      title: 'Thursday — Snatch Heavy + Back Squat + Core + Side Delts',
      totalMin: 130,
      totalMinNoSport: 135, // broad jumps reinstated
      sections: [
        {
          title: 'Olympic Block',
          color: 'gold',
          exercises: [
            { id: 'zone2_warmup', duration: '15–20 min', rest: 0 },
            { id: 'broad_jumps', sets: 3, reps: '3–5', rest: 90, optional: true,
              optNote: 'Cut by default — pickup sport already supplies jumping/landing volume. Reinstate only after a week+ with no sport.' },
            { id: 'snatch_warmup', sets: 3, reps: 2, pct: 60, baseLift: 'snatch', rest: 90 },
            { id: 'snatch_blocks_low', sets: 5, reps: 2, pct: blocksPct ?? olyPct + 2, baseLift: 'snatch', rest: 150 },
            { id: 'snatch_daily_max', sets: null, reps: '1', pct: dmPct, baseLift: 'snatch', rest: 240, isDailyMax: true,
              buildup: rampOlyDaily(dmPct, '1'),
              buildupNote: 'After the block snatches, rest 3 min, then ramp as below. Stop at the last technically clean lift — never chase weight after a degraded rep.' },
            { id: 'snatch_pull', sets: 4, reps: 3, pct: Math.min(pullPct + 3, 100), baseLift: 'snatch', rest: 180 },
            { id: 'back_squat', sets: 5, reps: 3, pct: bsThuPct, baseLift: 'bs', rest: 180 },
            { id: 'rdl', sets: 3, reps: 6, pct: 60, baseLift: 'bs', rest: 120 },
            { id: 'ohs', sets: 3, reps: 3, pct: 60, baseLift: 'snatch', rest: 90 },
          ],
        },
        {
          title: 'Core Block',
          color: 'green',
          exercises: [
            { id: 'ab_wheel', sets: 3, repRange: [10, 15], rest: 90 },
            { id: 'pallof_press', sets: 3, reps: '10/side', rest: 60 },
            { id: 'weighted_plank', sets: 3, duration: '30–45s', rest: 60 },
          ],
        },
        {
          title: 'Side Delt Specialization',
          color: 'blue',
          exercises: [
            { id: 'cable_lateral', sets: 5, repRange: [15, 20], rest: 60 },
            { id: 'db_lateral_partial', sets: 3, repRange: [20, 25], rest: 60 },
            { id: 'cable_upright_row', sets: 3, repRange: [12, 15], rest: 90 },
          ],
        },
      ],
    },

    // ── FRIDAY ──────────────────────────────────────────────────────────────
    friday: {
      title: 'Friday — Clean & Jerk Heavy + Front Squat + Lower Accessory',
      totalMin: 105,
      sections: [
        {
          title: 'Olympic Block',
          color: 'gold',
          exercises: [
            { id: 'cj_warmup', sets: 3, reps: '2+1', pct: 60, baseLift: 'cj', rest: 90 },
            { id: 'clean_blocks_low', sets: 5, reps: 2, pct: blocksPct ?? olyPct + 2, baseLift: 'cj', rest: 150 },
            { id: 'cj_daily_max', sets: null, reps: '1+1', pct: dmPct, baseLift: 'cj', rest: 240, isDailyMax: true,
              buildup: rampOlyDaily(dmPct, '1+1'),
              buildupNote: 'After the block cleans, rest 3 min, then ramp as below. Each attempt = 1 clean + 1 jerk. Stop at the last technically clean lift.' },
            { id: 'jerk_rack', sets: 4, reps: 2, pct: jerkFriPct, baseLift: 'cj', rest: 180 },
            { id: 'clean_pull', sets: 4, reps: 3, pct: Math.min(pullPct + 3, 100), baseLift: 'cj', rest: 180 },
            { id: 'front_squat', sets: 5, reps: 3, pct: fsFriPct, baseLift: 'fs', rest: 180 },
          ],
        },
        {
          title: 'Lower Accessory',
          color: 'green',
          exercises: [
            { id: 'nordic_curl', sets: 3, repRange: [5, 8], rest: 180 },
            { id: 'bss', sets: 3, reps: '8/leg', rest: 120 },
            { id: 'calf_raise', sets: 4, repRange: [15, 20], rest: 60 },
          ],
        },
      ],
    },

    // ── SATURDAY ────────────────────────────────────────────────────────────
    saturday: {
      title: 'Saturday — Max Effort + Weak Point Hypertrophy',
      totalMin: 130,
      sections: [
        {
          title: 'Max Effort Block',
          color: 'gold',
          exercises: [
            { id: 'snatch_daily_max', sets: null, reps: '1', pct: dmPct, baseLift: 'snatch', rest: 270, isDailyMax: true,
              buildup: rampOlySaturday(dmPct, '1'),
              buildupNote: 'Then 2–3% jumps with 4–5 min rest to your daily max. Stop before a miss.' },
            { id: 'cj_daily_max', sets: null, reps: '1+1', pct: dmPct, baseLift: 'cj', rest: 270, isDailyMax: true,
              buildup: rampOlySaturday(dmPct, '1+1'),
              buildupNote: 'Same ramp as snatch. Each attempt = 1 clean + 1 jerk. Stop before a miss.' },
            { id: 'back_squat', sets: null, reps: 3, pct: 85, baseLift: 'bs', rest: 270, isMaxEffort: true,
              buildup: RAMP_SAT_BS, buildupNote: '85% is the RPE 9 target. Only attempt 88%×3 if 85% moved fast and clean.' },
            { id: 'push_press', sets: null, reps: 3, pct: 85, baseLift: 'pp', rest: 210, isMaxEffort: true,
              buildup: RAMP_SAT_PP, buildupNote: '85% is the RPE 9 target.' },
            { id: 'flat_bench', sets: null, repRange: [3, 5], pct: 84, baseLift: 'bench', rest: 210, isMaxEffort: true,
              buildup: RAMP_SAT_BENCH, buildupNote: 'Continue in 2–3% jumps if moving well. RPE 8–9, no grinding.' },
          ],
        },
        {
          title: 'Weak Point Hypertrophy',
          color: 'blue',
          exercises: [
            { id: 'incline_bar_press', sets: 4, repRange: [6, 10], rest: 165 },
            { id: 'low_high_cable_fly', sets: 3, repRange: [12, 15], rest: 90 },
            { id: 'cable_lateral', sets: 4, repRange: [15, 25], rest: 60 },
            { id: 'face_pull', sets: 3, reps: 20, rest: 60 },
            { id: 'cable_overhead_tricep', sets: 2, repRange: [10, 12], rest: 90 },
          ],
        },
      ],
    },

    // ── SUNDAY ──────────────────────────────────────────────────────────────
    sunday: {
      title: 'Sunday — Passive Rest',
      isRest: true,
      note: 'Full passive rest. No session today — prioritize sleep and food. Optional easy mobility from the Guide if you feel stiff, but nothing structured.',
    },
  };
}

// ─── Testing week ─────────────────────────────────────────────────────────────
// Keyed by weekday so it works with the same navigation as every other week.
// isTesting days expose `lifts` whose achieved max writes directly to STATE.maxes.
const TESTING_WEEK = {
  monday: {
    title: 'Day 1 — Snatch 1RM + Overhead Squat 3RM',
    isTesting: true,
    totalMin: 90,
    note: 'Build from ~60% estimated max. 5–10 lb jumps. Take singles above 85%. No more than 2 total misses across the session.',
    lifts: [
      { lift: 'snatch', label: 'Snatch — 1RM', cues: ['Warm up thoroughly', 'Stop the moment two misses accumulate', 'Record your last made single'] },
      { lift: null, label: 'Overhead Squat — 3RM (reference only)', cues: ['Not stored as a training max — the program runs OHS at 60% of your snatch', 'Note it in your own log if useful'] },
    ],
  },
  tuesday: {
    title: 'Day 2 — Clean & Jerk 1RM',
    isTesting: true,
    totalMin: 90,
    note: 'Same protocol as Day 1. If the jerk is the limiter, note the clean and jerk separately — record the full C&J here.',
    lifts: [
      { lift: 'cj', label: 'Clean & Jerk — 1RM', cues: ['The recorded max is the heaviest completed C&J', 'If you clean it but miss the jerk, it does not count'] },
    ],
  },
  wednesday: { title: 'Day 3 — Rest', isRest: true, note: 'Rest. Light Zone 2 and mobility optional.' },
  thursday: {
    title: 'Day 4 — Back Squat 1RM',
    isTesting: true,
    totalMin: 75,
    note: 'Standard back squat 1RM protocol. Build in 10–20 lb jumps early, smaller near the top.',
    lifts: [
      { lift: 'bs', label: 'Back Squat — 1RM' },
    ],
  },
  friday: {
    title: 'Day 5 — Front Squat + Push Press + Bench 1RM',
    isTesting: true,
    totalMin: 120,
    note: 'Do Front Squat first, then Push Press, then Bench. Same protocol for each.',
    lifts: [
      { lift: 'fs', label: 'Front Squat — 1RM' },
      { lift: 'pp', label: 'Push Press — 1RM' },
      { lift: 'bench', label: 'Bench Press — 1RM' },
    ],
  },
  saturday: { title: 'Days 6–7 — Rest', isRest: true, note: 'Rest. Recover before starting Block 1.' },
  sunday: { title: 'Days 6–7 — Rest', isRest: true, note: 'Rest. When you are ready, switch to Block 1 in Settings.' },
};

// ─── Main program export ──────────────────────────────────────────────────────
const PROGRAM = {
  exercises: EX,
  testingWeek: TESTING_WEEK,

  blocks: [
    {
      id: 0,
      name: 'Week 0: Testing',
      weeks: 1,
      startWeek: 0,
      description: 'Establish your training maxes before using percentages. Build to a 1RM on each lift and record it — every program percentage references these numbers.',
      getDay: (dayKey) => TESTING_WEEK[dayKey],
    },
    {
      id: 1,
      name: 'Block 1: Volume Accumulation',
      weeks: 4,
      startWeek: 1,
      description: 'Foundation volume at moderate intensity. Technique first. Every rep should feel clean.',
      getDay: (dayKey, weekInBlock) => makeDays(B1, weekInBlock)[dayKey],
    },
    {
      id: 2,
      name: 'Block 2: Intensification',
      weeks: 4,
      startWeek: 5,
      description: 'Intensity climbs, volume drops ~20–25%. Daily max attempts are true max attempts. Rest periods increase 30–60s across the board.',
      getDay: (dayKey, weekInBlock) => makeDays(B2, weekInBlock)[dayKey],
    },
    {
      id: 3,
      name: 'Block 3: Peaking / Realization',
      weeks: 3,
      startWeek: 9,
      description: 'Volume drops ~35% from Block 1. Primarily competition lifts from the floor. Daily max attempts are true PR attempts. Hypertrophy drops to maintenance.',
      getDay: (dayKey, weekInBlock) => {
        // Block 3: simplified — mainly competition lifts + maintenance
        const w = weekInBlock;
        const olyPct = B3.oly_sets_pct[w];
        const dmPct = B3.daily_max_pct[w];
        const pullPct = B3.pull_pct[w];
        return {
          monday: {
            title: 'Monday — Snatch + Back Squat (Peaking)',
            totalMin: 90,
            sections: [
              { title: 'Olympic Block', color: 'gold', exercises: [
                { id: 'zone2_warmup', duration: '15–20 min', rest: 0 },
                { id: 'snatch_warmup', sets: 3, reps: 2, pct: 60, baseLift: 'snatch', rest: 90 },
                { id: 'snatch_floor', sets: 3, reps: 2, pct: olyPct, baseLift: 'snatch', rest: 180 },
                { id: 'snatch_daily_max', sets: null, reps: '1', pct: dmPct, baseLift: 'snatch', rest: 300, isDailyMax: true, buildup: rampOlySaturday(dmPct, '1'), buildupNote: 'Peaking — true PR attempt. Stop before a miss.' },
                { id: 'snatch_pull', sets: 3, reps: 2, pct: pullPct, baseLift: 'snatch', rest: 180 },
                { id: 'back_squat', sets: 3, reps: 2, pct: B3.bs_mon_pct[w], baseLift: 'bs', rest: 240 },
              ]},
              { title: 'Maintenance Hypertrophy', color: 'blue', note: 'RPE 6–7 only. Nothing that causes soreness.', exercises: [
                { id: 'cable_lateral', sets: 2, repRange: [15, 20], rest: 60 },
                { id: 'face_pull', sets: 2, repRange: [15, 20], rest: 60 },
              ]},
            ],
          },
          tuesday: {
            title: 'Tuesday — Clean & Jerk + Front Squat (Peaking)',
            totalMin: 90,
            sections: [
              { title: 'Olympic Block', color: 'gold', exercises: [
                { id: 'cj_warmup', sets: 2, reps: '2+1', pct: 60, baseLift: 'cj', rest: 90 },
                { id: 'cj_floor', sets: 3, reps: '1+1', pct: olyPct, baseLift: 'cj', rest: 240 },
                { id: 'cj_daily_max', sets: null, reps: '1+1', pct: dmPct, baseLift: 'cj', rest: 300, isDailyMax: true, buildup: rampOlySaturday(dmPct, '1+1'), buildupNote: 'Peaking — true PR attempt. Each attempt = 1 clean + 1 jerk. Stop before a miss.' },
                { id: 'clean_pull', sets: 3, reps: 2, pct: pullPct, baseLift: 'cj', rest: 180 },
                { id: 'front_squat', sets: 3, reps: 2, pct: B3.fs_tue_pct[w], baseLift: 'fs', rest: 240 },
              ]},
            ],
          },
          wednesday: {
            title: 'Wednesday — Technical (Light)',
            totalMin: 60,
            sections: [
              { title: 'Technical Block', color: 'gold', note: 'Light technical work only — 60–70%. Pure feel.', exercises: [
                { id: 'power_snatch', sets: 3, reps: 2, pct: 70, baseLift: 'snatch', rest: 120 },
                { id: 'jerk_rack', sets: 3, reps: 2, pct: 70, baseLift: 'cj', rest: 120 },
                { id: 'pause_front_squat', sets: 2, reps: 2, pct: 65, baseLift: 'fs', rest: 120 },
              ]},
            ],
          },
          thursday: {
            title: 'Thursday — Snatch Daily Max (Peaking)',
            totalMin: 90,
            sections: [
              { title: 'Olympic Block', color: 'gold', exercises: [
                { id: 'zone2_warmup', duration: '15 min', rest: 0 },
                { id: 'snatch_warmup', sets: 3, reps: 2, pct: 60, baseLift: 'snatch', rest: 90 },
                { id: 'snatch_floor', sets: 2, reps: 2, pct: olyPct, baseLift: 'snatch', rest: 240 },
                { id: 'snatch_daily_max', sets: null, reps: '1', pct: dmPct, baseLift: 'snatch', rest: 300, isDailyMax: true, buildup: rampOlySaturday(dmPct, '1'), buildupNote: 'Peaking — true PR attempt. Stop before a miss.' },
                { id: 'snatch_pull', sets: 2, reps: 2, pct: pullPct, baseLift: 'snatch', rest: 180 },
                { id: 'back_squat', sets: 3, reps: 2, pct: B3.bs_thu_pct[w], baseLift: 'bs', rest: 240 },
              ]},
            ],
          },
          friday: {
            title: 'Friday — C&J Daily Max (Peaking)',
            totalMin: 90,
            sections: [
              { title: 'Olympic Block', color: 'gold', exercises: [
                { id: 'cj_warmup', sets: 2, reps: '2+1', pct: 60, baseLift: 'cj', rest: 90 },
                { id: 'cj_floor', sets: 2, reps: '1+1', pct: olyPct, baseLift: 'cj', rest: 240 },
                { id: 'cj_daily_max', sets: null, reps: '1+1', pct: dmPct, baseLift: 'cj', rest: 300, isDailyMax: true, buildup: rampOlySaturday(dmPct, '1+1'), buildupNote: 'Peaking — true PR attempt. Each attempt = 1 clean + 1 jerk. Stop before a miss.' },
                { id: 'jerk_rack', sets: 3, reps: 2, pct: 88, baseLift: 'cj', rest: 240 },
                { id: 'clean_pull', sets: 2, reps: 2, pct: pullPct, baseLift: 'cj', rest: 180 },
                { id: 'front_squat', sets: 3, reps: 2, pct: B3.fs_fri_pct[w], baseLift: 'fs', rest: 240 },
              ]},
              { title: 'Maintenance Hypertrophy', color: 'blue', exercises: [
                { id: 'flat_bench', sets: 2, repRange: [3, 5], pct: 80, baseLift: 'bench', rest: 180 },
              ]},
            ],
          },
          saturday: {
            title: 'Saturday — Competition Simulation',
            totalMin: 90,
            sections: [
              { title: 'Max Effort Block', color: 'gold', note: 'Weeks 10–11: select attempts based on daily max performances in Weeks 9–10.', exercises: [
                { id: 'snatch_daily_max', sets: null, reps: '1', pct: dmPct, baseLift: 'snatch', rest: 360, isDailyMax: true, buildup: rampOlySaturday(dmPct, '1'), buildupNote: 'Competition simulation — pick attempts per the Guide. Stop before a miss.' },
                { id: 'cj_daily_max', sets: null, reps: '1+1', pct: dmPct, baseLift: 'cj', rest: 360, isDailyMax: true, buildup: rampOlySaturday(dmPct, '1+1'), buildupNote: 'Competition simulation. Each attempt = 1 clean + 1 jerk.' },
              ]},
            ],
          },
          sunday: makeDays(B1, 0).sunday,
        }[dayKey];
      },
    },
    {
      id: 4,
      name: 'Week 12: Deload',
      weeks: 1,
      startWeek: 12,
      description: '50% of normal volume. 60–70% intensity. Re-test all maxes at end of week — these become training maxes for the next macrocycle.',
    },
  ],

  // ── Helper: get prescribed weight ─────────────────────────────────────────
  calcWeight(maxes, baseLift, pct) {
    const max = maxes[baseLift];
    if (!max || !pct) return null;
    // Round to nearest 2.5 lbs
    return Math.round((max * pct / 100) / 2.5) * 2.5;
  },

  // ── Helper: get a day's workout ───────────────────────────────────────────
  getDayWorkout(blockId, weekInBlock, dayKey) {
    const block = this.blocks.find(b => b.id === blockId);
    if (!block || !block.getDay) return null;
    return block.getDay(dayKey, weekInBlock);
  },

  // Full resolver: block/week day, with cutting modifications applied if active.
  getWorkout(blockId, weekInBlock, dayKey, cutting) {
    const day = this.getDayWorkout(blockId, weekInBlock, dayKey);
    return cutting ? this.applyCutting(day) : day;
  },

  // ── Cutting Phase Modifications (from the program document) ────────────────
  // In a deficit the goal is muscle RETENTION, which needs far less volume than
  // building — provided intensity holds. Applied as a transform over any block:
  //   • Hypertrophy: drop to 2 working sets, RPE 9–10. Exception: face pulls
  //     (shoulder-health work) stay at full volume.
  //   • Olympic lifting (lifts, derivatives, pulls, squats, technical, push press):
  //     drop ONE working set per exercise; keep frequency and percentages identical
  //     (intensity is what preserves strength and skill in a deficit).
  //   • Cardio: add ~15–20 min to the Sunday Zone 2 session. VO₂max unchanged.
  //   • Plyometrics (jumps): no change — volume is already minimal.
  applyCutting(day) {
    if (!day || !day.sections) return day; // rest / testing days unaffected
    const clone = JSON.parse(JSON.stringify(day));
    clone.cutting = true;
    clone.sections.forEach(sec => {
      sec.exercises.forEach(ex => {
        const def = EX[ex.id];
        if (!def) return;
        const t = def.type;
        if (t === 'hypertrophy') {
          if (ex.id === 'face_pull') return; // mandatory shoulder health — keep full
          if (typeof ex.sets === 'number' && ex.sets > 2) ex.sets = 2;
          ex.cutNote = 'Cut: 2 sets · RPE 9–10';
        } else if (t === 'oly' || t === 'strength' || t === 'technical') {
          if (typeof ex.sets === 'number' && ex.sets > 1) {
            ex.sets = ex.sets - 1;
            ex.cutNote = '−1 set (cut)';
          }
        } else if (t === 'cardio' && ex.id === 'zone2_warmup' &&
                   typeof ex.duration === 'string' && ex.duration.includes('60–75')) {
          ex.duration = '75–95 min';
          ex.cutNote = '+15–20 min (cut)';
        }
      });
    });
    return clone;
  },

  // Day order for the week
  dayKeys: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],

  // Lift display names
  liftNames: {
    snatch: 'Snatch',
    cj: 'Clean & Jerk',
    bs: 'Back Squat',
    fs: 'Front Squat',
    pp: 'Push Press',
    bench: 'Bench Press',
  },
};
