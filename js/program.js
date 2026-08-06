// ─────────────────────────────────────────────────────────────────────────────
// PROGRAM DATA — 13-week block
// Priority order: Olympic weightlifting → Hypertrophy → Athleticism → Longevity
// Mirrors the approved Training System document supplied with this repository update.
// ─────────────────────────────────────────────────────────────────────────────

const EX = {
  // ── Olympic / technical ───────────────────────────────────────────────────
  tall_snatch: {
    name: 'Tall Snatch', type: 'technical', baseLift: 'snatch',
    notes: 'Turnover with zero leg drive — the most specific drill for pulling under.',
    cues: ['Feet stay flat', 'Punch under, do not lift the bar', 'Full depth catch'],
  },
  drop_snatch: {
    name: 'Drop Snatch', type: 'technical', baseLift: 'snatch',
    notes: 'Speed under the bar plus footwork. No dip-drive — just drop.',
    cues: ['Fast feet', 'Punch to lockout as you drop', 'Stand up every rep'],
  },
  snatch_floor: {
    name: 'Snatch (full, from floor)', type: 'oly', baseLift: 'snatch',
    notes: 'The lift. Catch depth is NOT a criterion here — a controlled high catch you stand up is a make.',
    cues: ['Drive the floor away', 'Bar close', 'Finish tall, then move'],
  },
  snatch_balance: {
    name: 'Snatch Balance', type: 'technical', baseLift: 'snatch',
    notes: 'Receiving position under load. Commit down; do not press up.',
    cues: ['Dip, drive, drop', 'Lock before you land', 'Stand under control'],
  },
  hh_snatch: {
    name: 'High-Hang Snatch → Full Catch', type: 'technical', baseLift: 'snatch',
    notes: 'RECEIVING DRILL — below parallel is mandatory, 1s pause in the receive. A high catch is a failed rep.',
    cues: ['Bar at the hip crease', 'Turn over fast', 'Pause 1s in the bottom, then stand'],
  },
  ohs: {
    name: 'Overhead Squat', type: 'technical', baseLift: 'snatch',
    notes: 'Positional exposure. Slow and controlled, full depth.',
    cues: ['Bar over mid-foot', 'Push up into the bar', 'Knees out'],
  },
  jerk_balance: {
    name: 'Jerk Balance', type: 'technical', baseLift: 'jerk',
    notes: 'DEFAULT jerk drill — hold one drill for the whole 4-week block; rotating every session teaches nothing. Substitute only if you know a different fault: pause/dip-hold jerk (forward dip displacement) · press in split or jerk recovery (unstable split) · tall jerk (not moving under at all).',
    cues: ['Front foot lands first and stays', 'Commit under, do not press', 'Recover front foot, then back'],
  },
  cj_floor: {
    name: 'Clean & Jerk (full)', type: 'oly', baseLift: 'cj',
    notes: 'The lift. Catch depth is NOT a criterion here.',
    cues: ['Bar close off the floor', 'Elbows fast', 'Deliberate split, no chase'],
  },
  jerk_rack: {
    name: 'Jerk from Rack — technical', type: 'technical', baseLift: 'jerk',
    notes: 'Footwork, timing, consistency. No press-outs count as makes.',
    cues: ['Vertical dip', 'Drive through the whole foot', 'Punch and lock before the feet land'],
  },
  jerk_rack_heavy: {
    name: 'Jerk from Rack — heavy singles', type: 'oly', baseLift: 'jerk',
    notes: 'Your binding constraint, loaded. No press-outs or unstable recoveries count as makes.',
    cues: ['Same dip every rep', 'Commit to the split', 'Stable overhead before recovering'],
  },
  split_jerk_rack: {
    name: 'Split Jerk from Rack', type: 'technical', baseLift: 'jerk',
    notes: 'Third weekly jerk exposure, loaded off the jerk TM rather than buried in a complex.',
    cues: ['Deliberate split', 'Lock before the feet land'],
  },
  hh_clean: {
    name: 'High-Hang Clean → Full Catch', type: 'technical', recvKey: 'hh_clean',
    notes: 'RECEIVING DRILL — below parallel mandatory, 1s pause. Load progresses on CATCH QUALITY, not a percentage: +5 lb next week only if all 8 catches were below parallel. Cap 210.',
    cues: ['Bar at the hip crease', 'Elbows around fast', 'Pause 1s in the bottom, stand it up'],
  },
  recv_clean: {
    name: 'Clean, Received Below Parallel', type: 'technical', recvKey: 'recv_clean',
    notes: 'RECEIVING DRILL from the floor. +5 lb next week only if all 3 were below parallel and stood up cleanly. Cap 220. A high catch is a failed rep — drop 10 lb and repeat.',
    cues: ['Full pull, then move under', 'Catch low, not high', 'Stand under control'],
  },

  // ── Strength ──────────────────────────────────────────────────────────────
  back_squat: { name: 'Back Squat', type: 'strength', baseLift: 'bs', notes: 'No grinding. Stop if the next rep would exceed ~RPE 8.5. If you undershoot the target RPE, add 5–10 lb at the next scheduled exposure; if you overshoot it, reduce 5% immediately.', cues: ['Brace before you unrack', 'Knees track toes', 'Drive the floor away'] },
  front_squat: { name: 'Front Squat', type: 'strength', baseLift: 'fs', notes: 'Specific to the clean receive. No grinding; stop if the next rep would exceed ~RPE 8.5. If you undershoot the target RPE, add 5–10 lb at the next scheduled exposure; if you overshoot it, reduce 5% immediately.', cues: ['Elbows up', 'Upright torso', 'No collapse out of the hole'] },
  rdl: { name: 'Romanian Deadlift', type: 'hypertrophy', notes: 'Long-length hip extension — squats and cleans do not supply it. ~2 RIR. On Friday so the soreness lands in the weekend, not on heavy cleans.', cues: ['Push the hips back', 'Bar drags the thigh', 'Stop where the hamstring ends, not the back'] },
  bench: { name: 'Bench Press', type: 'hypertrophy', baseLift: 'bench', notes: '3–6 reps — strength-biased on purpose. The three incline slots carry upper-chest hypertrophy.', cues: ['Shoulder blades down and back', 'Touch, no bounce', 'Full lockout'] },
  weighted_pullup: { name: 'Weighted Pull-Up (neutral grip)', type: 'hypertrophy', notes: 'Dip belt. An effective loadable vertical pull.', cues: ['Full hang at the bottom', 'Chest toward the bar', 'Control the descent'] },

  // ── Upper chest (SPECIALIZATION) ──────────────────────────────────────────
  incline_db_press: { name: '30° Incline Dumbbell Press', type: 'hypertrophy', notes: 'Upper chest — lagging. 30°, not 45°.', cues: ['Deep stretch at the bottom', 'Do not clash the bells', '~2s eccentric'] },
  low_high_fly: { name: 'Low-to-High Cable Fly', type: 'hypertrophy', notes: 'Resisted shoulder adduction for the clavicular pec — additive to pressing, not a replacement.', cues: ['Slight forward lean', 'Wide arc, soft elbows', 'Squeeze up and across'] },

  // ── Side delts (SPECIALIZATION) ───────────────────────────────────────────
  cable_lateral_behind: { name: 'Cable Lateral Raise (cable behind body)', type: 'hypertrophy', notes: 'Side delts — lagging. Cable behind you so the bottom position stays loaded.', cues: ['Lead with the elbow', 'Stop at shoulder height', 'Slow negative'] },
  cable_lateral: { name: 'Cable Lateral Raise', type: 'hypertrophy', notes: 'Side delts — lagging. Constant tension. Direct comparison shows growth similar to dumbbells, not superior — cable is the default, not a proven winner.', cues: ['Lead with the elbow', 'No shrugging', 'Control down'] },

  // ── Traps (SPECIALIZATION) ────────────────────────────────────────────────
  db_shrug: { name: 'Dumbbell Shrug', type: 'hypertrophy', notes: 'Traps — lagging. Straps if grip limits. Controlled elevation, 2s pause at the top.', cues: ['Straight up, no rolling', '2s squeeze', 'Full controlled descent'] },

  // ── Back ──────────────────────────────────────────────────────────────────
  cs_row: { name: 'Chest-Supported Row', type: 'hypertrophy', notes: 'Mid-back with ZERO spinal loading — protects a day that also has front squats. That is priority 1 doing the choosing.', cues: ['Natural protraction/retraction', 'Elbows to the hips', 'No torso english'] },
  cs_high_row: { name: 'Chest-Supported High Row', type: 'hypertrophy', notes: 'High elbow angle — traps and rhomboids under a different line than shrugs.', cues: ['Elbows high and wide', 'Pull to the upper chest'] },
  oa_cable_row: { name: 'One-Arm Cable Row', type: 'hypertrophy', notes: 'Lats, deep stretch, unilateral.', cues: ['Let the shoulder travel at the stretch', 'Drive the elbow back and down'] },
  reverse_pec_deck: { name: 'Reverse Pec Deck', type: 'hypertrophy', notes: 'Rear delts.', cues: ['Soft elbows, fixed angle', 'Lead with the pinkies'] },
  reverse_cable_fly: { name: 'Reverse Cable Fly', type: 'hypertrophy', notes: 'Rear delts. Replaced face pulls — the rear-delt growth benefit is real; the shoulder-health case for face pulls is mechanistic and weakly evidenced.', cues: ['Cables crossed, high pulley', 'Wide arc', 'Squeeze at the back'] },

  // ── Arms ──────────────────────────────────────────────────────────────────
  incline_db_curl: { name: 'Incline Dumbbell Curl', type: 'hypertrophy', notes: 'Bench 45–60°, biceps at a long muscle length. Recent direct work on lengthened-position biceps training returned null findings — reasonable, not proven.', cues: ['Arms hang behind the torso', 'Full stretch at the bottom', 'No swing'] },
  cable_curl: { name: 'Standing Cable Curl', type: 'hypertrophy', notes: 'Constant tension through the mid-range.', cues: ['Elbows pinned', 'Squeeze at the top'] },
  reverse_curl: { name: 'Reverse-Grip Cable Curl', type: 'hypertrophy', notes: 'Brachioradialis + wrist extensors — the forearm side the hook grip never trains. Saturday-only ON PURPOSE: the next time a barbell is in your hands is Monday, so grip fatigue here costs nothing. Direct forearm evidence is thin; this is the cheap hedge, not a proven dose.', cues: ['Knuckles up, wrists straight', 'Elbows pinned', 'No wrist flick at the top'] },
  oh_cable_tri: { name: 'Overhead Cable Triceps Extension (rope)', type: 'hypertrophy', notes: 'Triceps long head at length.', cues: ['Elbows in and high', 'Full stretch behind the head', 'Lock out'] },
  cable_pressdown: { name: 'Cable Rope Pressdown', type: 'hypertrophy', notes: 'Triceps lateral and medial heads.', cues: ['Elbows pinned to the ribs', 'Spread the rope at lockout'] },

  // ── Legs, calves, trunk ───────────────────────────────────────────────────
  leg_ext: { name: 'Leg Extension', type: 'hypertrophy', notes: 'Rectus femoris — squats under-stimulate it because it crosses the hip. Friday so it cannot degrade Thursday.', cues: ['Full extension', 'Pause at the top', 'Control down'] },
  seated_leg_curl: { name: 'Seated Leg Curl', type: 'hypertrophy', notes: 'Knee-flexion hamstring hypertrophy. Loads better than a Nordic.', cues: ['Full range', 'Slow eccentric'] },
  nordic: { name: 'Nordic Curl (band-assisted)', type: 'hypertrophy', bodyweight: true, notes: 'Injury-prevention exposure, not physique volume. Weeks 1–2: 2×3 assisted. Week 3+: 2×4–6 toward unassisted. Stop before uncontrolled collapse.', cues: ['Hips locked out', 'Lower as slowly as you can control', 'Catch with the hands'] },
  standing_calf: { name: 'Standing Calf Raise', type: 'hypertrophy', notes: 'Gastrocnemius. 2s pause in the stretch.', cues: ['Full stretch at the bottom', 'Pause 2s', 'All the way up'] },
  seated_calf: { name: 'Seated Calf Raise', type: 'hypertrophy', notes: 'Soleus bias — the gastroc goes slack at 90° knee flexion. Whether that yields better chronic soleus growth than standing work is unconfirmed and trials disagree; one seated exposure of three is a hedge.', cues: ['Full range', 'Pause at the bottom'] },
  copenhagen: { name: 'Copenhagen Plank', type: 'core', notes: 'Adductors — the common injury in cutting sports. Progresses: 1) bottom knee on bench 2×20s · 2) 2×40s · 3) foot on bench 2×20s · 4) 2×30–40s · 5) + dumbbell on the top hip. Advance when you clear the top of the range on both sides.', cues: ['Hips stacked', 'Do not let the hip sag'] },
  cable_crunch: { name: 'Cable Crunch', type: 'hypertrophy', notes: 'Loaded spinal flexion — small increments, safe near failure. Strong inference, not a head-to-head winner.', cues: ['Curl the ribs to the pelvis', 'Hips stay put', 'Do not hinge'] },
  hanging_pelvic_curl: { name: 'Hanging Pelvic Curl', type: 'hypertrophy', bodyweight: true, notes: 'Curl the PELVIS toward the ribs. A straight hanging leg raise is mostly hip flexor.', cues: ['Posterior tilt is the rep', 'Hips curl up, not just legs', 'No swing'] },

  // ── Field — individual drills, loggable like lifts ────────────────────────
  pogo_hops: { name: 'Pogo Hops', type: 'jump', bodyweight: true, notes: 'Stiff-ankle elastic bounces — reactive, not maximal. Minimal knee bend.', cues: ['Ankles like springs', 'Short ground contact', 'Tall posture'] },
  cmj: { name: 'Countermovement Jump', type: 'jump', bodyweight: true, notes: 'Maximal vertical intent every rep. STOP the exercise when height visibly drops.', cues: ['Dip fast, jump faster', 'Full arm swing', 'Stick the landing quietly'] },
  broad_jump: { name: 'Broad Jump + Stick', type: 'jump', bodyweight: true, notes: 'Maximal horizontal jump, stuck landing — no stumble, no extra hop.', cues: ['Big arm drive', 'Land in a quarter squat', 'Hold the landing 2 s'] },
  lateral_bound: { name: 'Lateral Bound + Stick', type: 'jump', bodyweight: true, notes: 'Per side. Push laterally off one leg, stick on the other.', cues: ['Push, don\'t step', 'Stick one-legged, knee steady', 'Hold 2 s before the next'] },
  accel_stop: { name: 'Accel-to-Stop + Submax Cuts', type: 'jump', bodyweight: true, notes: 'Controlled prep for the shuttle: 2 accelerate-and-brake runs, then 2 sub-maximal direction cuts per side.', cues: ['Brake low and quiet', 'Chest over toes on the cut'] },
  shuttle_5105: { name: '5-10-5 Shuttle', type: 'jump', bodyweight: true, notes: 'Pro-agility. Maximal intent; stop the exercise when times visibly slow.', cues: ['Stay low through the turns', 'Push off the outside leg', 'Eyes forward, not down'] },
  drop_jump: { name: 'Low Drop Jump (8–12" box)', type: 'jump', bodyweight: true, gymOnly: true, notes: 'Step off the box, minimal ground contact, straight into a maximal jump. ONLY with sound landings — if landings deteriorate, switch to countermovement jumps.', cues: ['Step off, don\'t jump off', 'Ground is hot — leave it fast', 'Land like the broad jump'] },
  hurdle_hop: { name: 'Low Hurdle Hop', type: 'jump', bodyweight: true, gymOnly: true, notes: 'Continuous double-leg hops over low hurdles. Elastic, short contacts.', cues: ['Bounce, don\'t squat-jump', 'Arms drive the rhythm'] },
  reactive_drill: { name: 'Reactive Agility', type: 'jump', bodyweight: true, notes: 'React to a CUE, not a cone — ball drop, partner point, or a random phone timer deciding left/right. The perceptual half is the point.', cues: ['Move on the cue, not before', 'First step wins'] },
  sled_sprint: { name: 'Resisted Sled Sprint — 15 m', type: 'jump', gymOnly: true, notes: '~30% BW is a STARTING load — friction varies by sled and surface, so keep both constant and adjust by feel. Log the added load as the weight.', cues: ['45° body lean', 'Punch the ground back', 'Full effort, full recovery'] },
  sprint_20: { name: 'Sprint — 20 m', type: 'jump', bodyweight: true, notes: 'Maximal acceleration from a standing start.', cues: ['Push the first 10 m', 'Rise gradually, no pop-up'] },
  sprint_build_20: { name: 'Build-Up — 20 m', type: 'jump', bodyweight: true, notes: 'Progressive build to ~90% across 20 m. Primer for the flying sprints.', cues: ['Smooth acceleration', 'Tall and relaxed at the top end'] },
  flying_20: { name: 'Flying 20 m (20 m run-in)', type: 'jump', bodyweight: true, notes: 'Build through 20 m, then hold MAXIMAL velocity for 20 m. The upright top-speed exposure accelerations don\'t give.', cues: ['Relax the face and hands', 'Fast hips, tall posture', 'Don\'t reach — cycle'] },
  sprint_10: { name: 'Sprint — 10 m', type: 'jump', bodyweight: true, notes: 'Pure acceleration.', cues: ['Violent first three steps', 'Stay low'] },
  sprint_30: { name: 'Sprint — 30 m', type: 'jump', bodyweight: true, notes: 'Acceleration through to upright running.', cues: ['Build through the whole 30', 'Finish tall'] },
  bike_intervals: { name: 'Bike Intervals', type: 'cardio', notes: 'Build INTO each interval, climbing toward ~90–95% max HR in the latter portion. Do not sprint the first minute to force HR up. Skip if pickup already gave ~12+ min above 90% HRmax this week.' },
  zone2: { name: 'Zone 2 Cycling', type: 'cardio', notes: 'Separated ≥6h from lifting. Conversational, ~117–137 bpm. Cycling not running — less impact and eccentric cost.' },

  // ── Prep ──────────────────────────────────────────────────────────────────
  daily_mobility: { name: 'Needs-Based Positional Work', type: 'mobility', notes: 'Only what you need that day: ankle knee-to-wall, adductor rock-backs, thoracic rotations, scapular push-ups, band pull-aparts, PVC pass-throughs, deep-squat pry. If everything moves fine, skip straight to the bar.' },
  prep_bar_snatch: { name: 'Raise + Snatch Bar Rounds', type: 'warmup', notes: 'Raise 3–5 min on a bike, rower or rope. Then TWO empty-bar snatch rounds: muscle snatch ×3 · overhead squat ×3 · snatch press ×3 · hang snatch ×2.' },
  prep_bar_cj: { name: 'Raise + Clean & Jerk Bar Rounds', type: 'warmup', notes: 'Raise 3–5 min on a bike, rower or rope. Then TWO empty-bar clean & jerk rounds: muscle clean ×3 · front squat ×3 · press in split ×3 · tall clean ×2 · jerk footwork ×3.' },
  prep_bar_mixed: { name: 'Raise + Snatch and Clean Bar Rounds', type: 'warmup', notes: 'Raise 3–5 min. This session receives BOTH lifts, so do one round of each. Snatch round: muscle snatch ×3 · overhead squat ×3 · snatch press ×3 · hang snatch ×2. Clean round: muscle clean ×3 · front squat ×3 · press in split ×3 · tall clean ×2 · jerk footwork ×3.' },
  prep_bar_squats: { name: 'Raise + Squat/Bench Prep', type: 'warmup', notes: 'Raise 3–5 min. Empty-bar back squat ×5 · empty-bar front squat ×5 · scapular push-ups ×10 — then follow each lift\'s ramp to the opening attempt.' },
  prep_accessories: { name: 'Quick Upper Prep — no barbell today', type: 'warmup', notes: 'Band pull-aparts ×15 · arm circles ×10 each way · scapular push-ups ×10. Then ramp the first isolation exercise with one set of 12–15 at ~half load.' },
  field_warmup: { name: 'Field Warm-Up', type: 'warmup', notes: '5 min easy movement · A-skip, lateral shuffle and backward run 2×15–20 m each · leg swings 10 each direction · 2 accelerations at ~70% · 2 at ~85–90%. Begin maximal work only when movement feels crisp.' },
};

// ─── Progression tables ───────────────────────────────────────────────────────
const LOAD1 = { // Weeks 1–3
  startWeek: 1, fieldPhase: 'foundation', accessoryRamp: [0, 1, 2],
  snatch_vol: [65, 70, 72.5], snatch_hvy: [75, 80, 82.5],
  cj_vol: [65, 70, 72.5], cj_hvy: [75, 80, 82.5],
  jerk_tue: [70, 72.5, 75], jerk_wed: [72.5, 75, 77.5], jerk_fri: [80, 82.5, 85],
  hh_snatch: [55, 60, 65],
  bs_mon: [70, 72.5, 75], bs_thu: [75, 77.5, 80],
  fs_tue: [70, 72.5, 75], fs_fri: [75, 77.5, 80],
  sets: { snVol: 5, cjVol: 5, snHvy: 5, cjHvy: 5, bsMon: 3, bsThu: 3, fsTue: 3, fsFri: 2, jerkFri: 3 },
  reps: { bsMon: 5, bsThu: 3, fsTue: 4, fsFri: 3 },
  intervalSec: 180,
};

const LOAD2 = { // Weeks 5–7
  startWeek: 5, fieldPhase: 'reactive', accessoryRamp: [1, 2, 2],
  snatch_vol: [72.5, 75, 77.5], snatch_hvy: [82.5, 85, 87.5],
  cj_vol: [72.5, 75, 77.5], cj_hvy: [82.5, 85, 87.5],
  jerk_tue: [75, 77.5, 78], jerk_wed: [75, 77.5, 80], jerk_fri: [85, 87.5, 90],
  hh_snatch: [60, 65, 70],
  bs_mon: [75, 77.5, 80], bs_thu: [82.5, 85, 87.5],
  fs_tue: [77.5, 80, 82.5], fs_fri: [80, 82.5, 85],
  sets: { snVol: 5, cjVol: 5, snHvy: [5, 5, 4], cjHvy: [5, 5, 4], bsMon: 3, bsThu: 3, fsTue: 3, fsFri: 2, jerkFri: 4 },
  reps: { bsMon: 4, bsThu: 2, fsTue: 3, fsFri: 2 },
  intervalSec: 240,
};

const LOAD3 = { // Weeks 9–11
  startWeek: 9, fieldPhase: 'mixed', accessoryRamp: [1, 2, 2],
  snatch_vol: [75, 77.5, 80], snatch_hvy: [85, 87.5, 90],
  cj_vol: [75, 77.5, 80], cj_hvy: [85, 87.5, 90],
  jerk_tue: [75, 77.5, 80], jerk_wed: [77.5, 79, 80], jerk_fri: [85, 87.5, 90],
  hh_snatch: [65, 67.5, 70],
  bs_mon: [80, 82.5, 85], bs_thu: [85, 87.5, 90],
  fs_tue: [80, 82.5, 85], fs_fri: [82.5, 85, 87.5],
  sets: { snVol: 4, cjVol: 4, snHvy: [4, 4, 3], cjHvy: [4, 4, 3], bsMon: 3, bsThu: 3, fsTue: 3, fsFri: 2, jerkFri: [4, 4, 3] },
  reps: { bsMon: 3, bsThu: 2, fsTue: 3, fsFri: 2 },
  intervalSec: 240,
};

// Accessory ramp. Weeks 1–3 use 70% → 85% → 100%; weeks 5 and 9 restart
// at ~85%, then weeks 6–7 and 10–11 use the full prescription.
const RAMP = { 2: [1, 2, 2], 3: [2, 3, 3], 4: [3, 3, 4], 5: [4, 4, 5] };
const RIR = ['~3 RIR', '~2 RIR', '~1 RIR'];
function rampSets(full, stage) { const r = RAMP[full]; return r ? r[Math.min(stage, 2)] : full; }
function acc(id, full, phase, repRange, rest, extra) {
  return Object.assign({
    id, sets: rampSets(full, phase.ramp), repRange, rest,
    fullSets: full, cutSets: full, rampStage: phase.ramp,
    rirNote: RIR[Math.min(phase.rir, 2)],
  }, extra || {});
}

// ─── Warm-up ramps ────────────────────────────────────────────────────────────
function rampOly(targetPct, reps) {
  const t = Number(targetPct), steps = [];
  [[40, '3', 60], [50, '3', 75], [60, '2', 90], [70, '1', 120]].forEach(([p, r, rest]) => { if (p < t) steps.push({ pct: p, reps: r, rest }); });
  // A heavy-day feeder is a single between 75% and the work weight. The working
  // percentage itself is NOT a ramp set; adding it here silently adds volume.
  if (t >= 80) {
    const feeder = Math.round(Math.max(75, t - 7.5) / 2.5) * 2.5;
    if (!steps.some(s => s.pct === feeder)) steps.push({ pct: feeder, reps: '1', rest: 150, top: true });
  }
  return steps;
}
const RAMP_PRESS = [{ relativeToWork: 50, reps: '5', rest: 60 }, { relativeToWork: 75, reps: '3', rest: 90, top: true }];
const RAMP_PULL = [{ relativeToWork: 60, reps: '6', rest: 60, top: true }];
const RAMP_ONE = [{ relativeToWork: 60, reps: '5', rest: 60, top: true }];

const COPENHAGEN_STEPS = {
  1: { label: 'Short lever — bottom knee on bench', duration: '20s/side', targetSec: 20 },
  2: { label: 'Short lever — bottom knee on bench', duration: '40s/side', targetSec: 40 },
  3: { label: 'Long lever — foot on bench', duration: '20s/side', targetSec: 20 },
  4: { label: 'Long lever — foot on bench', duration: '30–40s/side', targetSec: 40 },
  5: { label: 'Long lever + dumbbell on top hip', duration: '20–30s/side', targetSec: 30 },
};

// ─── Field sessions, split like the lifts ─────────────────────────────────────
// Each drill is an individually loggable slot. A session whose drills need gym
// equipment (gymOnly: sled, box, hurdles) opens that day's LIFTING session
// instead of running as a separate AM trip.
function tuesdayField(phase) {
  if (phase === 'foundation') return [
    { id: 'pogo_hops', sets: 2, reps: 10, rest: 90 },
    { id: 'cmj', sets: 3, reps: 3, rest: 150 },
    { id: 'broad_jump', sets: 3, reps: 3, rest: 150 },
    { id: 'lateral_bound', sets: 3, reps: 3, rest: 120, note: 'Per side.' },
    { id: 'accel_stop', sets: 2, reps: 2, rest: 60 },
    { id: 'shuttle_5105', sets: 3, reps: 1, rest: 180 },
  ];
  if (phase === 'reactive') return [
    { id: 'pogo_hops', sets: 2, reps: 10, rest: 90 },
    { id: 'drop_jump', sets: 3, reps: 3, rest: 150 },
    { id: 'broad_jump', sets: 3, reps: 3, rest: 150 },
    { id: 'lateral_bound', sets: 3, reps: 3, rest: 120, note: 'Per side.' },
    { id: 'shuttle_5105', sets: 2, reps: 1, rest: 180 },
    { id: 'reactive_drill', sets: 2, reps: 1, rest: 120 },
  ];
  return [ // mixed
    { id: 'hurdle_hop', sets: 3, reps: 3, rest: 150 },
    { id: 'cmj', sets: 3, reps: 2, rest: 150 },
    { id: 'broad_jump', sets: 3, reps: 2, rest: 150 },
    { id: 'reactive_drill', sets: 4, reps: 1, rest: 120 },
  ];
}

function thursdayField(phase) {
  if (phase === 'foundation') return [
    { id: 'sled_sprint', sets: 3, reps: 1, rest: 180 },
    { id: 'sprint_20', sets: 3, reps: 1, rest: 180 },
  ];
  if (phase === 'reactive') return [
    { id: 'sled_sprint', sets: 3, reps: 1, rest: 180 },
    { id: 'sprint_build_20', sets: 2, reps: 1, rest: 120 },
    { id: 'flying_20', sets: 3, reps: 1, rest: 240 },
  ];
  return [ // mixed
    { id: 'sprint_10', sets: 3, reps: 1, rest: 180 },
    { id: 'sprint_30', sets: 3, reps: 1, rest: 300 },
  ];
}

function fieldIsGymBound(exs) { return exs.some(e => (EX[e.id] || {}).gymOnly); }
function halveField(exs) {
  return exs.map(e => ({ ...e, sets: Math.max(1, Math.ceil(e.sets / 2)),
    note: (e.note ? e.note + ' ' : '') + 'Deload: half volume at FULL intent.' }));
}

// Build the field section for a day. Separate-session form carries session:'field';
// gym-bound form is flagged fieldSection and opens the lifting session.
function fieldSectionFor(dayLabel, exs, deload) {
  const gymBound = fieldIsGymBound(exs);
  const work = deload ? halveField(exs) : exs;
  const sec = {
    title: gymBound
      ? `Field Block — opens the session (${dayLabel} drills need gym equipment)`
      : `AM — ${dayLabel} (≥6h before lifting)`,
    color: 'red',
    fieldSection: true,
    note: gymBound
      ? 'Sled/box/hurdle work lives in the gym, so it runs FIRST, fresh, before the barbell. Full recoveries — this is speed work, not conditioning.'
      : 'Separate morning session. Maximal intent, low volume. Stop when output visibly drops.',
    exercises: [{ id: 'field_warmup', duration: '10 min', timerSec: 600, rest: 0 }, ...work],
  };
  if (!gymBound) sec.session = 'field';
  return { sec, gymBound };
}

// ─── Loading-week day builder ─────────────────────────────────────────────────
function makeDays(B, w) {
  const P = (a) => a[Math.min(w, a.length - 1)];
  const N = (v) => Array.isArray(v) ? P(v) : v;
  const S = B.sets, R = B.reps;
  const A = { ramp: B.accessoryRamp[w], rir: w, globalWeek: B.startWeek + w };
  const peakWeek = B.startWeek === 9 && w === 2;
  return {
    monday: {
      title: 'Monday — Snatch Volume · Back Squat · Push',
      sessionMinutes: { main: 105 },
      totalMin: 71,
      sections: [
        { title: 'Olympic Block', color: 'gold', exercises: [
          { id: 'tall_snatch', sets: 2, reps: 3, pct: 30, baseLift: 'snatch', rest: 60 },
          { id: 'drop_snatch', sets: 3, reps: 2, pct: 48, baseLift: 'snatch', rest: 90 },
          { id: 'snatch_floor', sets: S.snVol, reps: 2, pct: P(B.snatch_vol), baseLift: 'snatch', rest: 150,
            buildup: rampOly(P(B.snatch_vol), 2), buildupNote: 'Ramp to the work weight. Ramp sets never count toward a set total.' },
          { id: 'snatch_balance', sets: 3, reps: 2, pct: 75, baseLift: 'snatch', rest: 150 },
          { id: 'back_squat', sets: S.bsMon, cutSets: 2, reps: R.bsMon, pct: P(B.bs_mon), baseLift: 'bs', rest: 180, buildup: rampOly(P(B.bs_mon), R.bsMon) },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', exercises: [
          acc('incline_db_press', 4, A, [6, 8], 150, { cutSets: 3, slotKey: 'mon_incline', buildup: RAMP_PRESS, buildupNote: 'First press of the session — ramp both steps.' }),
          acc('cable_lateral_behind', 3, A, [12, 15], 90, { cutSets: 2, slotKey: 'mon_lateral', note: 'First isolation for this muscle — one set of 12–15 at ~half load first.' }),
          acc('oh_cable_tri', 3, A, [10, 12], 90, { cutSets: 2, slotKey: 'mon_triceps' }),
          acc('standing_calf', 3, A, [8, 12], 90, { cutSets: 2, slotKey: 'mon_calf' }),
          acc('cable_crunch', 3, A, [10, 15], 60, { cutSets: 2, slotKey: 'mon_crunch', note: 'Pairs with the lateral raise — same tower, different height.' }),
        ]},
      ],
    },

    tuesday: (() => {
      const field = fieldSectionFor('Jumps + Reactive Agility', tuesdayField(B.fieldPhase));
      return {
      title: 'Tuesday — C&J · Technical Jerk · Front Squat · Bench',
      sessionMinutes: field.gymBound ? { main: 160 } : { field: 35, main: 130 },
      totalMin: 129,
      sections: [
        field.sec,
        { title: 'Olympic Block', color: 'gold', exercises: [
          { id: 'jerk_balance', sets: 3, reps: 3, pct: 40, baseLift: 'jerk', rest: 60 },
          { id: 'cj_floor', sets: S.cjVol, reps: '1+1', pct: P(B.cj_vol), baseLift: 'cj', rest: 180, buildup: rampOly(P(B.cj_vol), '1+1') },
          { id: 'jerk_rack', sets: 3, reps: 2, pct: P(B.jerk_tue), baseLift: 'jerk', rest: 150 },
          { id: 'front_squat', sets: S.fsTue, cutSets: 2, reps: R.fsTue, pct: P(B.fs_tue), baseLift: 'fs', rest: 180, buildup: rampOly(P(B.fs_tue), R.fsTue) },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', exercises: [
          acc('bench', 4, A, [3, 6], 180, { cutSets: 3, slotKey: 'tue_bench', buildup: RAMP_PRESS, buildupNote: 'At 3–6 reps near failure you need both ramp steps.' }),
          acc('cs_row', 4, A, [8, 10], 120, { cutSets: 3, slotKey: 'tue_row', buildup: RAMP_PULL }),
          acc('seated_leg_curl', 3, A, [8, 12], 90, { cutSets: 3, slotKey: 'tue_leg_curl' }),
          acc('db_shrug', 3, A, [10, 12], 90, { cutSets: 2, slotKey: 'tue_shrug' }),
          acc('cable_lateral', 3, A, [12, 20], 90, { cutSets: 2, slotKey: 'tue_lateral' }),
          acc('incline_db_curl', 3, A, [10, 12], 90, { cutSets: 2, slotKey: 'tue_curl', note: 'Shrug, curl and Copenhagen all run from one bench — grab a heavy pair and a light pair at the start.' }),
          { id: 'copenhagen', sets: rampSets(2, A.ramp), fullSets: 2, cutSets: 2, rampStage: A.ramp, duration: '20–30s/side', rest: 60, warmupNote: 'Do one easier short-lever hold before the work sets.' },
        ]},
      ],
    };})(),

    wednesday: {
      title: 'Wednesday — Full-Catch Technique · Upper Hypertrophy',
      sessionMinutes: { main: 110, cardio: 35 },
      totalMin: 109,
      sections: [
        { title: 'Receiving Block', color: 'gold',
          note: 'Below parallel is MANDATORY on the high-hang work, 1s pause. A high catch is a failed rep — drop 10 lb and repeat. Stand every rep completely.', exercises: [
          { id: 'ohs', sets: 2, reps: 5, pct: 52, baseLift: 'snatch', rest: 120 },
          { id: 'hh_snatch', sets: 4, reps: 2, pct: P(B.hh_snatch), baseLift: 'snatch', rest: 120, receivingDepth: true, qualityCeiling: B.startWeek === 9 },
          { id: 'hh_clean', sets: 4, reps: 2, rest: 150, recvKey: 'hh_clean' },
          { id: 'split_jerk_rack', sets: 3, reps: '1–2', pct: P(B.jerk_wed), baseLift: 'jerk', rest: 120 },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', note: 'Eight separate stations — no legitimate pairing. Run it straight with tight rest.', exercises: [
          acc('incline_db_press', 4, A, [8, 10], 150, { cutSets: 3, slotKey: 'wed_incline', buildup: RAMP_ONE }),
          acc('low_high_fly', 3, A, [12, 15], 90, { cutSets: 2, slotKey: 'wed_fly' }),
          acc('cable_lateral', 5, A, [12, 20], 90, { cutSets: 4, slotKey: 'wed_lateral' }),
          acc('db_shrug', 2, A, [12, 15], 90, { cutSets: 2, slotKey: 'wed_shrug' }),
          acc('oa_cable_row', 3, A, [8, 12], 120, { cutSets: 2, slotKey: 'wed_row', buildup: RAMP_PULL }),
          acc('reverse_pec_deck', 3, A, [15, 20], 75, { cutSets: 2, slotKey: 'wed_rear_delt' }),
          acc('seated_calf', 3, A, [10, 20], 90, { cutSets: 2, slotKey: 'wed_calf' }),
          acc('cable_pressdown', 3, A, [10, 15], 75, { cutSets: 2, slotKey: 'wed_pressdown' }),
        ]},
        { title: 'Zone 2 — separated ≥6h', color: 'green', session: 'cardio', exercises: [
          { id: 'zone2', duration: '30–40 min', rest: 0 },
        ]},
      ],
    },

    thursday: (() => {
      const field = fieldSectionFor('Sprints + Sled', thursdayField(B.fieldPhase));
      return {
      title: 'Thursday — Heavy Snatch · Back Squat · Push',
      sessionMinutes: field.gymBound ? { main: 120 } : { field: 30, main: 95 },
      totalMin: 92,
      sections: [
        field.sec,
        { title: 'Olympic Block', color: 'gold', exercises: [
          { id: 'snatch_floor', sets: N(S.snHvy), reps: 1, pct: P(B.snatch_hvy), baseLift: 'snatch', rest: 180,
            buildup: rampOly(P(B.snatch_hvy), 1), buildupNote: 'Week 11 tops at 90–92.5% only if the lifts are pristine.' },
          ...(peakWeek ? [{ id: 'snatch_floor', slotKey: 'thu_snatch_optional_top', sets: 1, reps: 1, pct: 92.5, baseLift: 'snatch', rest: 240, optional: true, optionalTopSingle: true, note: 'Optional fourth single at up to 92.5% only if every 90% single was pristine.' }] : []),
          { id: 'snatch_balance', sets: 2, reps: 2, pct: 75, baseLift: 'snatch', rest: 120 },
          { id: 'back_squat', sets: S.bsThu, cutSets: 3, reps: R.bsThu, pct: P(B.bs_thu), baseLift: 'bs', rest: 180, buildup: rampOly(P(B.bs_thu), R.bsThu) },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', exercises: [
          acc('incline_db_press', 3, A, [8, 12], 150, { cutSets: 3, slotKey: 'thu_incline', buildup: RAMP_ONE, buildupNote: 'Third incline exposure this week — one ramp set is enough.' }),
          acc('cable_lateral', 3, A, [12, 20], 90, { cutSets: 3, slotKey: 'thu_lateral' }),
          acc('standing_calf', 3, A, [8, 15], 90, { cutSets: 2, slotKey: 'thu_calf' }),
          acc('hanging_pelvic_curl', 3, A, [10, 15], 60, { cutSets: 2, slotKey: 'thu_core' }),
        ]},
      ],
    };})(),

    friday: {
      title: 'Friday — Heavy C&J · Heavy Jerk · Front Squat · Bench',
      sessionMinutes: { main: 120 },
      totalMin: 87,
      sections: [
        { title: 'Olympic Block', color: 'gold',
          note: 'No clean pulls this block — you clean 255 and power clean 255, so pulling high is the one thing you are already excellent at. That slot goes to cleans you actually receive.', exercises: [
          { id: 'cj_floor', sets: N(S.cjHvy), reps: '1+1', pct: P(B.cj_hvy), baseLift: 'cj', rest: 210, buildup: rampOly(P(B.cj_hvy), '1+1') },
          ...(peakWeek ? [{ id: 'cj_floor', slotKey: 'fri_cj_optional_top', sets: 1, reps: '1+1', pct: 92.5, baseLift: 'cj', rest: 240, optional: true, optionalTopSingle: true, note: 'Optional fourth C&J at up to 92.5% only if every 90% single was pristine.' }] : []),
          { id: 'jerk_rack_heavy', sets: N(S.jerkFri), reps: 1, pct: P(B.jerk_fri), baseLift: 'jerk', rest: 180 },
          ...(peakWeek ? [{ id: 'jerk_rack_heavy', slotKey: 'fri_jerk_optional_top', sets: 1, reps: 1, pct: 92.5, baseLift: 'jerk', rest: 240, optional: true, optionalTopSingle: true, note: 'Optional fourth jerk at up to 92.5% only after three technical successes.' }] : []),
          { id: 'recv_clean', sets: 3, reps: 1, rest: 150, recvKey: 'recv_clean' },
          { id: 'front_squat', sets: S.fsFri, cutSets: 2, reps: R.fsFri, pct: P(B.fs_fri), baseLift: 'fs', rest: 180, buildup: rampOly(P(B.fs_fri), R.fsFri) },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', exercises: [
          acc('rdl', 3, A, [6, 8], 150, { cutSets: 3, slotKey: 'fri_rdl', rirNote: '~2 RIR', buildup: RAMP_ONE, buildupNote: 'One light ramp set — this is one people skip and should not.' }),
          acc('bench', 4, A, [3, 6], 180, { cutSets: 3, slotKey: 'fri_bench', buildup: RAMP_PRESS }),
          acc('cs_high_row', 3, A, [8, 12], 120, { cutSets: 2, slotKey: 'fri_high_row', buildup: RAMP_PULL }),
          acc('weighted_pullup', 3, A, [6, 10], 150, { cutSets: 3, slotKey: 'fri_pullup' }),
          acc('leg_ext', 3, A, [10, 15], 90, { cutSets: 2, slotKey: 'fri_leg_ext' }),
          { id: 'nordic', sets: 2, cutSets: 2, reps: A.globalWeek <= 2 ? '3' : '4–6', rest: 120, slotKey: 'fri_nordic', warmupNote: 'Do one easier, more-assisted controlled set first.', note: A.globalWeek <= 2 ? 'Weeks 1–2: band-assisted, 2×3.' : 'Week 3+: 2×4–6, toward unassisted eccentrics. Stop before uncontrolled collapse.' },
        ]},
      ],
    },

    saturday: {
      title: 'Saturday — Upper Accessories · Bike Intervals',
      sessionMinutes: { main: 75 },
      totalMin: 15,          // played pickup → intervals skipped
      totalMinNoSport: 40,   // no pickup → intervals included
      sections: [
        { title: 'Accessories (moved off Friday)', color: 'blue',
          note: 'Isolation only. The last four all run off one dual-pulley tower — reverse fly high, raises and both curls low.', exercises: [
          acc('db_shrug', 3, A, [10, 12], 90, { cutSets: 2, slotKey: 'sat_shrug' }),
          acc('cable_lateral', 4, A, [12, 20], 90, { cutSets: 3, slotKey: 'sat_lateral' }),
          acc('reverse_cable_fly', 3, A, [15, 20], 75, { cutSets: 2, slotKey: 'sat_rear_delt' }),
          acc('cable_curl', 3, A, [10, 15], 90, { cutSets: 2, slotKey: 'sat_curl' }),
          acc('reverse_curl', 2, A, [12, 15], 75, { cutSets: 2, slotKey: 'sat_reverse_curl' }),
        ]},
        { title: 'Bike Intervals', color: 'red', exercises: [
          { id: 'bike_intervals', duration: `4 × ${B.intervalSec / 60} min on / 3 min off`, rest: 0,
            interval: { warmupSec: 720, rounds: 4, workSec: B.intervalSec, restSec: 180, lastRest: false, cooldownSec: 480 },
            note: 'On a cut, hold at 4 × 3 min rather than progressing to 4 × 4.' },
        ]},
      ],
    },

    sunday: { title: 'Sunday — Complete Rest', isRest: true, totalMin: 0,
      note: 'Walking, food, fluids. Nothing structured.' },
  };
}

// ─── Deload weeks (4 and 8) ───────────────────────────────────────────────────
function makeDeload(fieldPhase) {
  const holdNote = 'Receiving load HOLDS on a deload — no progression this week.';
  const rir = '~4 RIR';
  return {
    monday: { title: 'Monday — Deload', totalMin: 70, sessionMinutes: { main: 70 }, sections: [
      { title: 'Olympic Block', color: 'gold', note: 'Half the work sets, capped 60–70%.', exercises: [
        { id: 'tall_snatch', sets: 1, reps: 3, pct: 30, baseLift: 'snatch', rest: 60 },
        { id: 'drop_snatch', sets: 2, reps: 2, pct: 45, baseLift: 'snatch', rest: 90 },
        { id: 'snatch_floor', sets: 3, reps: 2, pct: 65, baseLift: 'snatch', rest: 150, buildup: rampOly(65, 2) },
        { id: 'snatch_balance', sets: 2, reps: 2, pct: 70, baseLift: 'snatch', rest: 120 },
        { id: 'back_squat', sets: 2, cutSets: 2, reps: 4, pct: 67, baseLift: 'bs', rest: 180, buildup: rampOly(67, 4) },
      ]},
      { title: 'Hypertrophy — half sets, ~4 RIR', color: 'blue', exercises: [
        { id: 'incline_db_press', sets: 2, cutSets: 2, repRange: [6, 8], rest: 150, rirNote: rir, slotKey: 'mon_incline' },
        { id: 'cable_lateral_behind', sets: 2, cutSets: 1, repRange: [12, 15], rest: 90, rirNote: rir, slotKey: 'mon_lateral' },
        { id: 'oh_cable_tri', sets: 2, cutSets: 1, repRange: [10, 12], rest: 90, rirNote: rir, slotKey: 'mon_triceps' },
        { id: 'standing_calf', sets: 2, cutSets: 1, repRange: [8, 12], rest: 90, rirNote: rir, slotKey: 'mon_calf' },
        { id: 'cable_crunch', sets: 2, cutSets: 1, repRange: [10, 15], rest: 60, rirNote: rir, slotKey: 'mon_crunch' },
      ]},
    ]},
    tuesday: (() => {
      const field = fieldSectionFor('Jumps + Reactive Agility', tuesdayField(fieldPhase), true);
      return { title: 'Tuesday — Deload', totalMin: 95,
      sessionMinutes: field.gymBound ? { main: 90 } : { field: 25, main: 70 }, sections: [
      field.sec,
      { title: 'Olympic Block', color: 'gold', exercises: [
        { id: 'jerk_balance', sets: 2, reps: 3, pct: 35, baseLift: 'jerk', rest: 60 },
        { id: 'cj_floor', sets: 3, reps: '1+1', pct: 65, baseLift: 'cj', rest: 180, buildup: rampOly(65, '1+1') },
        { id: 'jerk_rack', sets: 2, reps: 2, pct: 62, baseLift: 'jerk', rest: 150 },
        { id: 'front_squat', sets: 2, cutSets: 2, reps: 3, pct: 67, baseLift: 'fs', rest: 180, buildup: rampOly(67, 3) },
      ]},
      { title: 'Hypertrophy — half sets, ~4 RIR', color: 'blue', exercises: [
        { id: 'bench', sets: 2, cutSets: 2, repRange: [3, 6], rest: 180, rirNote: rir, slotKey: 'tue_bench' },
        { id: 'cs_row', sets: 2, cutSets: 2, repRange: [8, 10], rest: 120, rirNote: rir, slotKey: 'tue_row' },
        { id: 'seated_leg_curl', sets: 2, cutSets: 2, repRange: [8, 12], rest: 90, rirNote: rir, slotKey: 'tue_leg_curl' },
        { id: 'db_shrug', sets: 2, cutSets: 1, repRange: [10, 12], rest: 90, rirNote: rir, slotKey: 'tue_shrug' },
        { id: 'cable_lateral', sets: 2, cutSets: 1, repRange: [12, 20], rest: 90, rirNote: rir, slotKey: 'tue_lateral' },
        { id: 'incline_db_curl', sets: 2, cutSets: 1, repRange: [10, 12], rest: 90, rirNote: rir, slotKey: 'tue_curl' },
        { id: 'copenhagen', sets: 1, cutSets: 1, duration: '20–30s/side', rest: 60 },
      ]},
    ]};})(),
    wednesday: { title: 'Wednesday — Deload', totalMin: 105, sessionMinutes: { main: 70, cardio: 35 }, sections: [
      { title: 'Receiving Block', color: 'gold', note: holdNote, exercises: [
        { id: 'ohs', sets: 1, reps: 5, pct: 50, baseLift: 'snatch', rest: 120 },
        { id: 'hh_snatch', sets: 2, reps: 2, pct: 55, baseLift: 'snatch', rest: 120, receivingDepth: true },
        { id: 'hh_clean', sets: 2, reps: 2, rest: 150, recvKey: 'hh_clean', note: holdNote },
        { id: 'split_jerk_rack', sets: 2, reps: 1, pct: 65, baseLift: 'jerk', rest: 120 },
      ]},
      { title: 'Hypertrophy — half sets', color: 'blue', exercises: [
        { id: 'incline_db_press', sets: 2, cutSets: 2, repRange: [8, 10], rest: 150, rirNote: rir, slotKey: 'wed_incline' },
        { id: 'low_high_fly', sets: 2, cutSets: 1, repRange: [12, 15], rest: 90, rirNote: rir, slotKey: 'wed_fly' },
        { id: 'cable_lateral', sets: 3, cutSets: 2, repRange: [12, 20], rest: 90, rirNote: rir, slotKey: 'wed_lateral' },
        { id: 'db_shrug', sets: 1, cutSets: 1, repRange: [12, 15], rest: 90, rirNote: rir, slotKey: 'wed_shrug' },
        { id: 'oa_cable_row', sets: 2, cutSets: 1, repRange: [8, 12], rest: 120, rirNote: rir, slotKey: 'wed_row' },
        { id: 'reverse_pec_deck', sets: 2, cutSets: 1, repRange: [15, 20], rest: 75, rirNote: rir, slotKey: 'wed_rear_delt' },
        { id: 'seated_calf', sets: 2, cutSets: 1, repRange: [10, 20], rest: 90, rirNote: rir, slotKey: 'wed_calf' },
        { id: 'cable_pressdown', sets: 2, cutSets: 1, repRange: [10, 15], rest: 75, rirNote: rir, slotKey: 'wed_pressdown' },
      ]},
      { title: 'Zone 2 — separated ≥6h', color: 'green', session: 'cardio', exercises: [
        { id: 'zone2', duration: '30–40 min', rest: 0 },
      ]},
    ]},
    thursday: (() => {
      const field = fieldSectionFor('Sprints + Sled', thursdayField(fieldPhase), true);
      return { title: 'Thursday — Deload', totalMin: 85,
      sessionMinutes: field.gymBound ? { main: 80 } : { field: 20, main: 65 }, sections: [
      field.sec,
      { title: 'Olympic Block', color: 'gold', exercises: [
        { id: 'snatch_floor', sets: 3, reps: 1, pct: 70, baseLift: 'snatch', rest: 180, buildup: rampOly(70, 1) },
        { id: 'snatch_balance', sets: 1, reps: 2, pct: 70, baseLift: 'snatch', rest: 120 },
        { id: 'back_squat', sets: 2, cutSets: 2, reps: 3, pct: 67, baseLift: 'bs', rest: 180, buildup: rampOly(67, 3) },
      ]},
      { title: 'Hypertrophy — half sets', color: 'blue', exercises: [
        { id: 'incline_db_press', sets: 2, cutSets: 2, repRange: [8, 12], rest: 150, rirNote: rir, slotKey: 'thu_incline' },
        { id: 'cable_lateral', sets: 2, cutSets: 2, repRange: [12, 20], rest: 90, rirNote: rir, slotKey: 'thu_lateral' },
        { id: 'standing_calf', sets: 2, cutSets: 1, repRange: [8, 15], rest: 90, rirNote: rir, slotKey: 'thu_calf' },
        { id: 'hanging_pelvic_curl', sets: 2, cutSets: 1, repRange: [10, 15], rest: 60, rirNote: rir, slotKey: 'thu_core' },
      ]},
    ]};})(),
    friday: { title: 'Friday — Deload', totalMin: 75, sessionMinutes: { main: 75 }, sections: [
      { title: 'Olympic Block', color: 'gold', exercises: [
        { id: 'cj_floor', sets: 3, reps: '1+1', pct: 70, baseLift: 'cj', rest: 210, buildup: rampOly(70, '1+1') },
        { id: 'jerk_rack_heavy', sets: 2, reps: 1, pct: 67, baseLift: 'jerk', rest: 180 },
        { id: 'recv_clean', sets: 2, reps: 1, rest: 150, recvKey: 'recv_clean', note: holdNote },
      ]},
      { title: 'Hypertrophy — half sets', color: 'blue', exercises: [
        { id: 'rdl', sets: 2, cutSets: 2, repRange: [6, 8], rest: 150, rirNote: '~2 RIR', slotKey: 'fri_rdl' },
        { id: 'bench', sets: 2, cutSets: 2, repRange: [3, 6], rest: 180, rirNote: rir, slotKey: 'fri_bench' },
        { id: 'cs_high_row', sets: 2, cutSets: 1, repRange: [8, 12], rest: 120, rirNote: rir, slotKey: 'fri_high_row' },
        { id: 'weighted_pullup', sets: 2, cutSets: 2, repRange: [6, 10], rest: 150, rirNote: rir, slotKey: 'fri_pullup' },
        { id: 'leg_ext', sets: 2, cutSets: 1, repRange: [10, 15], rest: 90, rirNote: rir, slotKey: 'fri_leg_ext' },
        { id: 'nordic', sets: 1, cutSets: 1, reps: '4–6', rest: 120, slotKey: 'fri_nordic', note: 'One controlled deload exposure; stop before collapse.' },
      ]},
    ]},
    saturday: { title: 'Saturday — Deload', totalMin: 55, sessionMinutes: { main: 55 }, sections: [
      { title: 'Accessories — half sets', color: 'blue', exercises: [
        { id: 'db_shrug', sets: 2, cutSets: 1, repRange: [10, 12], rest: 90, rirNote: rir, slotKey: 'sat_shrug' },
        { id: 'cable_lateral', sets: 2, cutSets: 2, repRange: [12, 20], rest: 90, rirNote: rir, slotKey: 'sat_lateral' },
        { id: 'reverse_cable_fly', sets: 2, cutSets: 1, repRange: [15, 20], rest: 75, rirNote: rir, slotKey: 'sat_rear_delt' },
        { id: 'cable_curl', sets: 2, cutSets: 1, repRange: [10, 15], rest: 90, rirNote: rir, slotKey: 'sat_curl' },
        { id: 'reverse_curl', sets: 1, cutSets: 1, repRange: [12, 15], rest: 75, rirNote: rir, slotKey: 'sat_reverse_curl' },
      ]},
      { title: 'Easy aerobic', color: 'green', exercises: [
        { id: 'zone2', duration: '25–35 min', rest: 0 },
      ]},
    ]},
    sunday: { title: 'Sunday — Complete Rest', isRest: true, totalMin: 0 },
  };
}

// ─── Week 12 — taper ──────────────────────────────────────────────────────────
function makeTaper() {
  const noAcc = 'No accessories anywhere in week 12 — one week costs nothing measurable and it makes the taper unambiguous.';
  return {
    monday: { title: 'Monday — Taper', totalMin: 35, sessionMinutes: { main: 35 }, note: noAcc, sections: [
      { title: 'Taper', color: 'gold', exercises: [
        { id: 'snatch_floor', sets: 3, reps: 1, pct: 72, baseLift: 'snatch', rest: 180, buildup: rampOly(72, 1) },
        { id: 'back_squat', sets: 2, reps: 2, pct: 70, baseLift: 'bs', rest: 180, buildup: rampOly(70, 2) },
      ]},
    ]},
    tuesday: { title: 'Tuesday — Taper', totalMin: 35, sessionMinutes: { main: 35 }, note: noAcc, sections: [
      { title: 'Taper', color: 'gold', exercises: [
        { id: 'cj_floor', sets: 3, reps: '1+1', pct: 72, baseLift: 'cj', rest: 210, buildup: rampOly(72, '1+1') },
        { id: 'jerk_rack', sets: 2, reps: 1, pct: 67.5, baseLift: 'jerk', rest: 150, buildup: rampOly(67.5, 1) },
        { id: 'front_squat', sets: 2, reps: 2, pct: 70, baseLift: 'fs', rest: 180, buildup: rampOly(70, 2) },
      ]},
    ]},
    wednesday: { title: 'Wednesday — Optional Technique', totalMin: 30, sessionMinutes: { main: 30 }, sections: [
      { title: 'Optional — ≤60%', color: 'gold', note: 'Optional 30 min. Skip it if you feel flat.', exercises: [
        { id: 'hh_snatch', sets: 2, reps: 2, pct: 58, baseLift: 'snatch', rest: 120, optional: true, receivingDepth: true },
        { id: 'hh_clean', sets: 2, reps: 2, pct: 60, baseLift: 'clean', rest: 150, optional: true, holdReceiving: true, receivingDepth: true, note: 'Optional and capped at 60% of the clean TM. No receiving-load progression.' },
      ]},
    ]},
    thursday: { title: 'Thursday — Rest', isRest: true, totalMin: 0, note: 'Full rest.' },
    friday: { title: 'Friday — Light Primers', totalMin: 30, sessionMinutes: { main: 30 }, sections: [
      { title: 'Primers', color: 'gold', exercises: [
        { id: 'snatch_floor', sets: 2, reps: 1, pct: 70, baseLift: 'snatch', rest: 180, buildup: rampOly(70, 1) },
        { id: 'cj_floor', sets: 2, reps: '1+1', pct: 70, baseLift: 'cj', rest: 180, buildup: rampOly(70, '1+1') },
      ]},
    ]},
    saturday: { title: 'Saturday — Rest or easy spin', totalMin: 20, sessionMinutes: { cardio: 20 }, sections: [
      { title: 'Optional', color: 'green', session: 'cardio', exercises: [{ id: 'zone2', duration: '20 min easy', rest: 0, optional: true }] },
    ]},
    sunday: { title: 'Sunday — Complete Rest', isRest: true, totalMin: 0 },
  };
}

// ─── Week 13 — test week ──────────────────────────────────────────────────────
// Uses the app's testing flow: `lifts[]` stage all seven results, then update the
// next cycle's maxes atomically.
const TEST_NOTE = 'Rest 5+ min between attempts. Stop at two misses. Nothing else this week — no accessories, no field work, no intervals.';
function makeTest() {
  return {
    monday: {
      title: 'Day 1 — Snatch 1RM', isTesting: true, totalMin: 60,
      note: 'Fresh, priority 1. Ramp, then take singles. ' + TEST_NOTE,
      lifts: [{ lift: 'snatch', label: 'Snatch — 1RM', testReps: 1, cues: ['Catch depth is not a criterion — a controlled high catch you stand up counts', 'Stop at two misses'] }],
    },
    tuesday: {
      title: 'Day 2 — Clean & Jerk 1RM', isTesting: true, totalMin: 60,
      note: 'Fresh, priority 1. ' + TEST_NOTE,
      lifts: [{ lift: 'cj', label: 'Clean & Jerk — 1RM', testReps: 1, cues: ['Heaviest COMPLETED C&J', 'Clean it but miss the jerk and it does not count'] }],
    },
    wednesday: { title: 'Day 3 — Rest or Optional Easy Spin', totalMin: 20, sessionMinutes: { cardio: 20 }, sections: [
      { title: 'Optional 20-Minute Easy Spin', color: 'green', session: 'cardio', note: 'Complete rest is equally acceptable.', exercises: [
        { id: 'zone2', duration: '20 min easy', rest: 0, optional: true },
      ]},
    ]},
    thursday: {
      title: 'Day 4 — Rack Jerk 1RM + Below-Parallel Clean', isTesting: true, totalMin: 70,
      note: 'Jerk FIRST — it is the binding constraint. ' + TEST_NOTE,
      lifts: [
        { lift: 'jerk', label: 'Jerk from Rack — 1RM', testReps: 1, cues: ['No press-outs', 'Deliberate recovery from the split, not a scramble'] },
        { lift: 'clean', label: 'Clean received BELOW PARALLEL — 1RM', testReps: 1, cues: ['Heaviest clean you catch below parallel and stand up', 'A high catch does not count', 'The gap to 255 is the deficit this program exists to close'] },
      ],
    },
    friday: {
      title: 'Day 5 — Squats + Bench', isTesting: true, totalMin: 75,
      note: 'Squats as DOUBLES, not singles — less fatigue, and it protects the bench that follows. Convert: a double at RPE 8 = 89% of 1RM, at RPE 9 = 92%. ' + TEST_NOTE,
      lifts: [
        { lift: 'bs', label: 'Back Squat — heavy double at known RPE', testReps: 2, requiresRpe: true },
        { lift: 'fs', label: 'Front Squat — heavy double at known RPE', testReps: 2, requiresRpe: true },
        { lift: 'bench', label: 'Bench Press — 1RM', testReps: 1 },
      ],
    },
    saturday: { title: 'Days 6–7 — Rest', isRest: true, note: 'Rest. Rebuild the next cycle from these seven numbers.' },
    sunday: { title: 'Days 6–7 — Rest', isRest: true, note: 'Apply all seven staged results together; the app then starts the next cycle at week 1.' },
  };
}

function durationSeconds(value) {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const amount = Number(match[1]);
  return /\bmin\b/i.test(String(value)) ? amount * 60 : amount;
}

// A consistent time-cost model used only to scale a documented session length
// after readiness/pickup rules remove sets or whole exercises. Unmodified plans
// retain their authored durations exactly.
function slotTimeUnits(ex) {
  if (ex.interval) {
    const cfg = ex.interval;
    return (cfg.warmupSec || 0) + (cfg.cooldownSec || 0)
      + cfg.rounds * cfg.workSec
      + (cfg.lastRest ? cfg.rounds : Math.max(0, cfg.rounds - 1)) * cfg.restSec;
  }
  if (ex.timerSec) return ex.timerSec;
  if (ex.duration && !ex.sets) return durationSeconds(ex.duration) || 60;
  const sets = Math.max(1, Number(ex.sets) || 1);
  const ramp = (ex.buildup || []).reduce((sum, step) => sum + 30 + (Number(step.rest) || 0), 0);
  return ramp + sets * (30 + (Number(ex.rest) || 60));
}

function sessionTimeUnits(session) {
  return (session.sections || []).reduce((total, sec) => total
    + sec.exercises.reduce((sum, ex) => sum + slotTimeUnits(ex), 0), 0);
}

function scaleTransformedSessionTime(session, baseline) {
  if (!baseline || session.skipped || !session.totalMin) return;
  const after = sessionTimeUnits(session);
  if (baseline.units && after < baseline.units - 1) {
    const scaled = baseline.minutes * after / baseline.units;
    const floor = session.kind === 'lifting' ? 15 : 5;
    session.totalMin = Math.max(floor, Math.ceil(scaled / 5) * 5);
  }
  if (session.contextMaxMinutes != null) {
    session.totalMin = Math.min(session.totalMin, session.contextMaxMinutes);
    delete session.contextMaxMinutes;
  }
}

// ─── Main program export ──────────────────────────────────────────────────────
const PROGRAM = {
  exercises: EX,
  testingWeek: makeTest(),
  copenhagenSteps: COPENHAGEN_STEPS,

  // Absolute-load receiving work — progresses on catch quality, not a percentage.
  receiving: {
    hh_clean:   { name: 'High-Hang Clean', start: 165, cap: 210, step: 5, requiredReps: 8, gate: 'all 8 catches below parallel with a 1s pause' },
    recv_clean: { name: 'Received Clean',  start: 190, cap: 220, step: 5, requiredReps: 3, gate: 'all 3 below parallel and stood up cleanly' },
  },

  blocks: [
    { id: 1, name: 'Weeks 1–3: Accumulation', weeks: 3, startWeek: 1,
      description: 'Technical volume at 65–82.5%. Accessories ramp 70% → 85% → 100% across the three weeks; RIR waves 3 → 2 → 1.',
      getDay: (dayKey, w) => makeDays(LOAD1, w)[dayKey] },
    { id: 2, name: 'Week 4: Deload', weeks: 1, startWeek: 4,
      description: 'Half the work sets, capped 60–70%. Field work halved at full intent. Intervals replaced by easy spin. Receiving loads HOLD.',
      getDay: (dayKey) => makeDeload('foundation')[dayKey] },
    { id: 3, name: 'Weeks 5–7: Intensification', weeks: 3, startWeek: 5,
      description: 'Volume work to 77.5%, heavy singles to 87.5%. Accessories restart at ~85% of full.',
      getDay: (dayKey, w) => makeDays(LOAD2, w)[dayKey] },
    { id: 4, name: 'Week 8: Deload', weeks: 1, startWeek: 8,
      description: 'Same reduction as week 4.',
      getDay: (dayKey) => makeDeload('reactive')[dayKey] },
    { id: 5, name: 'Weeks 9–11: Realization', weeks: 3, startWeek: 9,
      description: 'Sets drop, intensity peaks. Week 11 tops at 90–92.5% only if the lifts are pristine.',
      getDay: (dayKey, w) => makeDays(LOAD3, w)[dayKey] },
    { id: 6, name: 'Week 12: Taper', weeks: 1, startWeek: 12,
      description: 'Intensity retained, volume stripped. No accessories, no field work, no intervals.',
      getDay: (dayKey) => makeTaper()[dayKey] },
    { id: 7, name: 'Week 13: Test', weeks: 1, startWeek: 13,
      description: 'Seven numbers across four days — snatch, C&J, rack jerk, below-parallel clean, back squat, front squat, bench. All seven become the next block\'s training maxes.',
      getDay: (dayKey) => makeTest()[dayKey] },
  ],

  calcWeight(maxes, baseLift, pct) {
    let max = maxes[baseLift];
    if (baseLift === 'jerk' && !max) max = maxes.cj;
    if (baseLift === 'clean' && !max) max = maxes.cj;
    if (!max || !pct) return null;
    return Math.round((max * pct / 100) / 2.5) * 2.5;
  },

  estimate1RM(weight, reps, rpe) {
    const factors = { 2: { 7: 0.86, 8: 0.89, 9: 0.92 } };
    const factor = factors[reps] && factors[reps][rpe];
    if (!weight || !factor) return null;
    return Math.round((weight / factor) / 2.5) * 2.5;
  },

  // Absolute receiving load, from STATE.receiving (falls back to the start value).
  recvWeight(recvState, key) {
    const def = this.receiving[key];
    if (!def) return null;
    const cur = (recvState && recvState[key] != null) ? recvState[key] : def.start;
    return Math.min(cur, def.cap);
  },

  getDayWorkout(blockId, weekInBlock, dayKey) {
    const block = this.blocks.find(b => b.id === blockId);
    if (!block || !block.getDay) return null;
    return block.getDay(dayKey, weekInBlock);
  },

  // Choose the empty-bar prep from what the session actually contains, so
  // deloads and the taper self-select (taper Friday primes BOTH lifts).
  prepIdForSession(session) {
    let snatchFam = false, cjFam = false, barbell = false;
    (session.sections || []).forEach(sec => (sec.exercises || []).forEach(ex => {
      const def = EX[ex.id] || {};
      if (!['oly', 'technical', 'strength'].includes(def.type)) return;
      barbell = true;
      const lift = ex.baseLift || def.baseLift || (ex.recvKey ? 'clean' : null);
      if (lift === 'snatch') snatchFam = true;
      if (['cj', 'jerk', 'clean', 'fs'].includes(lift)) cjFam = true;
    }));
    if (snatchFam && cjFam) return 'prep_bar_mixed';
    if (snatchFam) return 'prep_bar_snatch';
    if (cjFam) return 'prep_bar_cj';
    return barbell ? 'prep_bar_mixed' : 'prep_accessories';
  },

  makePrepSection(session) {
    const prepId = this.prepIdForSession(session || {});
    const barFree = prepId === 'prep_accessories';
    return {
      title: 'Prep', color: 'green',
      note: 'Needs-based only. Ramp the first loaded exposure of a joint or muscle in a session — not every exercise.',
      exercises: [
        { id: 'daily_mobility', duration: 'As needed', timerSec: 180, rest: 0, optional: true },
        { id: prepId, duration: barFree ? '2–3 min' : '7–10 min', timerSec: barFree ? 180 : 600, rest: 0 },
      ],
    };
  },

  getDayPlan(blockId, weekInBlock, dayKey, cutting, context) {
    let day = this.getDayWorkout(blockId, weekInBlock, dayKey);
    if (!day) return null;
    if (cutting && blockId !== 6 && blockId !== 7) day = this.applyCutting(day);
    const plan = JSON.parse(JSON.stringify(day));
    plan.dayKey = dayKey;
    plan.blockId = blockId;
    plan.weekInBlock = weekInBlock;
    const block = this.blocks.find(b => b.id === blockId);
    plan.programWeek = block ? block.startWeek + weekInBlock : null;

    if (plan.isRest) {
      plan.sessions = [];
      return plan;
    }
    if (plan.isTesting) {
      plan.sessions = [{
        id: 'test', kind: 'test', title: plan.title, totalMin: plan.totalMin,
        isTesting: true, lifts: plan.lifts || [], note: plan.note,
      }];
      return this.applyContext(plan, context || {});
    }

    const groups = [];
    (plan.sections || []).forEach(sec => {
      const id = sec.session || 'main';
      let group = groups.find(g => g.id === id);
      if (!group) {
        const kind = id === 'field' ? 'field' : id === 'cardio' ? 'cardio' : 'lifting';
        group = {
          id, kind,
          title: kind === 'field' ? sec.title
            : kind === 'cardio' ? sec.title
              : plan.title.replace(/^\w+\s+—\s+/, ''),
          totalMin: (plan.sessionMinutes && plan.sessionMinutes[id]) || plan.totalMin || 0,
          sections: [],
        };
        groups.push(group);
      }
      const copy = { ...sec };
      delete copy.session;
      group.sections.push(copy);
    });
    groups.forEach(session => {
      if (session.kind !== 'lifting') return;
      // A gym-bound field block opens the session; barbell prep follows it.
      const idx = session.sections[0]?.fieldSection ? 1 : 0;
      session.sections.splice(idx, 0, this.makePrepSection(session));
    });
    plan.sessions = groups;
    delete plan.sections;
    return this.applyContext(plan, context || {});
  },

  getWorkout(blockId, weekInBlock, dayKey, cutting, sessionId, context) {
    const plan = this.getDayPlan(blockId, weekInBlock, dayKey, cutting, context);
    if (!plan || plan.isRest) return plan;
    const session = plan.sessions.find(s => s.id === sessionId)
      || plan.sessions.find(s => !s.skipped)
      || plan.sessions[0];
    return session ? {
      ...session,
      dayKey,
      dayTitle: plan.title,
      blockId,
      weekInBlock,
      programWeek: plan.programWeek,
      contextNotes: plan.contextNotes || [],
    } : null;
  },

  // ── Cut phase ─────────────────────────────────────────────────────────────
  // Competition-lift frequency and set/rep structure are IDENTICAL in both
  // phases. On a cut: Thursday/Friday top intensity caps at 87.5%, and accessory
  // + squat volume drops to the C-column counts. Field work and hamstring volume
  // are unchanged. Saturday intervals hold at 4 × 3 min.
  CUT_INTENSITY_CAP: 87.5,

  applyCutting(day) {
    if (!day || !day.sections) return day;
    const clone = JSON.parse(JSON.stringify(day));
    clone.cutting = true;
    if (clone.sessionMinutes && clone.sessionMinutes.main) {
      clone.sessionMinutes.main = Math.max(20, clone.sessionMinutes.main - 15);
    } else if (clone.totalMin) {
      clone.totalMin = Math.max(20, clone.totalMin - 15);
    }
    clone.sections.forEach(sec => {
      sec.exercises.forEach(ex => {
        const def = EX[ex.id];
        if (!def) return;
        if (def.type === 'oly' && typeof ex.pct === 'number' && ex.pct > this.CUT_INTENSITY_CAP) {
          ex.pct = this.CUT_INTENSITY_CAP;
          ex.cutNote = `Cut: capped at ${this.CUT_INTENSITY_CAP}%`;
          if (ex.buildup) ex.buildup = rampOly(this.CUT_INTENSITY_CAP, ex.reps);
          if (ex.optionalTopSingle && ex.note) {
            ex.note = ex.note.replace(/every 90% single was pristine/i, 'every required 87.5% single was pristine');
          }
        }
        if (typeof ex.cutSets === 'number' && typeof ex.sets === 'number') {
          const next = typeof ex.rampStage === 'number'
            ? rampSets(ex.cutSets, ex.rampStage)
            : ex.cutSets;
          if (next < ex.sets) ex.cutNote = (ex.cutNote ? ex.cutNote + ' · ' : '') + 'Cut volume';
          ex.sets = next;
        }
        if (ex.id === 'bike_intervals' && ex.interval) {
          ex.interval.workSec = 180;
          ex.duration = '4 × 3 min on / 3 min off';
          ex.cutNote = 'Cut: hold at 4 × 3 min';
        }
      });
    });
    return clone;
  },

  applyContext(plan, context) {
    const clone = JSON.parse(JSON.stringify(plan));
    const baselineTiming = Object.fromEntries(clone.sessions.map(session => [session.id, {
      minutes: session.totalMin,
      units: sessionTimeUnits(session),
    }]));
    const pickupDays = Array.isArray(context.pickupDays) ? context.pickupDays : [];
    const timing = context.pickupTiming || {};
    const copenhagen = context.copenhagen || { step: 1, load: 0 };
    const technicalProgress = context.technicalProgress || { hhSnatchPct: 65 };
    const pickupCount = pickupDays.length;
    const notes = [];
    const dayCancelsTuesdayField = pickupDays.includes('monday') || pickupDays.includes('tuesday');
    const cancelThursdayField = pickupDays.includes('wednesday') || pickupDays.includes('thursday');
    const countFallbackField = pickupCount >= 2 && !dayCancelsTuesdayField && !cancelThursdayField;
    const cancelTuesdayField = dayCancelsTuesdayField || countFallbackField;
    const cancelIntervals = pickupDays.some(d => ['wednesday', 'friday', 'saturday'].includes(d)) || pickupCount >= 2;

    const fieldCancelled = (clone.dayKey === 'tuesday' && cancelTuesdayField)
      || (clone.dayKey === 'thursday' && cancelThursdayField);
    clone.sessions.forEach(session => {
      if (session.kind === 'field' && fieldCancelled) {
        session.skipped = true;
        session.skipReason = 'Replaced by pickup under the weekly contingency matrix.';
      }
      if (session.kind === 'lifting' && fieldCancelled
          && (session.sections || []).some(sec => sec.fieldSection)) {
        session.sections = session.sections.filter(sec => !sec.fieldSection);
        notes.push('Merged field block removed: pickup already supplied the jump/sprint stimulus this week.');
      }
      if (cancelIntervals) {
        session.sections = (session.sections || []).map(sec => ({
          ...sec,
          exercises: sec.exercises.filter(ex => ex.id !== 'bike_intervals'),
        })).filter(sec => sec.exercises.length);
        if (clone.dayKey === 'saturday' && session.id === 'main') {
          session.contextMaxMinutes = 25;
          notes.push('Saturday intervals removed because pickup supplied the hard conditioning stimulus. Upper accessories remain.');
        }
      }
    });

    const lowerIsolation = new Set(['seated_leg_curl', 'standing_calf', 'seated_calf', 'leg_ext', 'nordic', 'copenhagen']);
    const lowerHeavy = new Set(['back_squat', 'front_squat', 'rdl']);
    const todayTiming = pickupDays.includes(clone.dayKey) ? timing[clone.dayKey] : null;
    clone.sessions.forEach(session => {
      if (session.kind === 'test' && todayTiming === 'before') {
        session.skipped = true;
        session.skipReason = 'Pickup before testing: defer the maximal test to a fresh day.';
        notes.push('Pickup occurred before a test session: maximal testing deferred.');
        return;
      }
      if (session.kind !== 'lifting') return;
      if (todayTiming === 'after') {
        session.sections.forEach(sec => { sec.exercises = sec.exercises.filter(ex => !lowerIsolation.has(ex.id)); });
        notes.push('Same-day pickup after lifting: lower-body isolation removed.');
      }
      if (todayTiming === 'before') {
        session.sections = session.sections.filter(sec => !sec.fieldSection);
        session.sections.forEach(sec => {
          sec.exercises = sec.exercises.filter(ex => {
            if (lowerHeavy.has(ex.id) || lowerIsolation.has(ex.id) || ex.optionalTopSingle) return false;
            const def = EX[ex.id];
            if (def && (def.type === 'oly' || def.type === 'technical')) {
              if (typeof ex.pct === 'number') ex.pct = Math.min(ex.pct, 70);
              if (ex.recvKey) { ex.loadCapPct = 70; ex.loadCapBaseLift = 'clean'; }
              ex.sets = typeof ex.sets === 'number' ? Math.min(ex.sets, 3) : ex.sets;
              if (ex.buildup && ex.buildup.some(s => s.pct != null)) ex.buildup = rampOly(ex.pct, ex.reps);
              ex.contextNote = 'Pickup before lifting: technique only, capped at 70%.';
            }
            return true;
          });
        });
        notes.push('Same-day pickup before lifting: heavy lower work removed; Olympic work capped at 70%; upper work retained only with normal coordination.');
      }
    });

    const readiness = context.readiness || 'green';
    clone.readiness = readiness;
    if (readiness === 'yellow') {
      clone.sessions.forEach(session => {
        if (session.kind === 'test') {
          session.skipped = true;
          session.skipReason = 'Yellow readiness: defer maximal testing.';
          return;
        }
        (session.sections || []).forEach(sec => {
          sec.exercises = sec.exercises.filter(ex => !ex.optionalTopSingle);
          sec.exercises.forEach(ex => {
            const def = EX[ex.id];
            if (def && def.type === 'jump' && typeof ex.sets === 'number') {
              ex.contextNote = 'Yellow: reduced volume at full intent; stop earlier if output drops.';
            }
            if (ex.interval) {
              ex.interval.rounds = Math.max(1, Math.round(ex.interval.rounds * 0.75));
              ex.duration = `${ex.interval.rounds} × ${ex.interval.workSec / 60} min on / ${ex.interval.restSec / 60} min off`;
              ex.contextNote = 'Yellow: interval rounds reduced 25%; do not add them back later.';
            }
            if (typeof ex.sets === 'number' && def && !['warmup', 'mobility'].includes(def.type)) {
              ex.sets = Math.max(1, Math.round(ex.sets * 0.75));
            }
            if (typeof ex.pct === 'number' && def && ['oly', 'technical', 'strength'].includes(def.type)) {
              ex.pct = Math.round(ex.pct * 0.95 * 2) / 2;
              if (ex.buildup && ex.buildup.some(s => s.pct != null)) ex.buildup = rampOly(ex.pct, ex.reps);
              ex.readinessNote = 'Yellow: load ×0.95';
            }
            if (ex.recvKey) ex.loadMultiplier = 0.95;
          });
        });
      });
      notes.push('Yellow readiness: main-lift loads reduced 5%, work sets reduced 20–30%, optional top singles omitted.');
    } else if (readiness === 'red') {
      clone.sessions.forEach(session => {
        if (session.kind === 'field' || session.kind === 'cardio' || session.kind === 'test') {
          session.skipped = true;
          session.skipReason = 'Red readiness: rest; no maximal testing, sprinting, jumping or conditioning.';
          return;
        }
        session.title = 'Optional technique only — red readiness';
        (session.sections || []).forEach(sec => {
          sec.exercises = sec.exercises.filter(ex => {
            const def = EX[ex.id];
            if (ex.optionalTopSingle) return false;
            if (!def || !['oly', 'technical', 'warmup', 'mobility'].includes(def.type)) return false;
            if (typeof ex.pct === 'number') ex.pct = Math.min(ex.pct, 60);
            if (ex.recvKey) { ex.loadCapPct = 60; ex.loadCapBaseLift = 'clean'; }
            if (typeof ex.sets === 'number') ex.sets = Math.min(ex.sets, 2);
            if (ex.buildup && ex.buildup.some(s => s.pct != null)) ex.buildup = rampOly(ex.pct, ex.reps);
            ex.readinessNote = 'Red: optional technique ≤60% only if coordination is normal.';
            return true;
          });
        });
        const hasTechnique = (session.sections || []).some(sec => sec.exercises.some(ex => {
          const def = EX[ex.id];
          return def && ['oly', 'technical'].includes(def.type);
        }));
        if (!hasTechnique) {
          session.skipped = true;
          session.skipReason = 'Red readiness: no useful technique work is scheduled in this session.';
        }
      });
      notes.push('Red readiness: rest, or optional technique at ≤60% only with normal coordination. No heavy lifting, squats, field work or max testing.');
    }

    const copenhagenStep = Math.min(5, Math.max(1, Number(copenhagen.step) || 1));
    const copenhagenDef = this.copenhagenSteps[copenhagenStep];
    clone.sessions.forEach(session => (session.sections || []).forEach(sec => sec.exercises.forEach(ex => {
      if (ex.id === 'hh_snatch' && ex.qualityCeiling) {
        ex.pct = Math.min(ex.pct, Number(technicalProgress.hhSnatchPct) || 65);
      }
      if (ex.id !== 'copenhagen') return;
      ex.copenhagenStep = copenhagenStep;
      ex.duration = copenhagenDef.duration;
      ex.targetSec = copenhagenDef.targetSec;
      ex.timedSets = true;
      ex.externalLoad = copenhagenStep === 5 ? Math.max(0, Number(copenhagen.load) || 0) : 0;
      ex.note = `Step ${copenhagenStep}: ${copenhagenDef.label}. Advance only after both sides clear the target.`;
    })));

    clone.sessions.forEach(session => scaleTransformedSessionTime(session, baselineTiming[session.id]));

    clone.contextNotes = notes;
    return clone;
  },

  dayKeys: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],

  liftNames: {
    snatch: 'Snatch',
    cj: 'Clean & Jerk',
    jerk: 'Jerk (from rack)',
    clean: 'Clean (below parallel)',
    bs: 'Back Squat',
    fs: 'Front Squat',
    bench: 'Bench Press',
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROGRAM, EX };
}
