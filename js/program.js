// ─────────────────────────────────────────────────────────────────────────────
// PROGRAM DATA — 13-week block
// Priority order: Olympic weightlifting → Hypertrophy → Athleticism → Longevity
// Mirrors ~/Desktop/OL-Program-FINAL.md. Edit that doc first, then mirror here.
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
  back_squat: { name: 'Back Squat', type: 'strength', baseLift: 'bs', notes: 'No grinding. Stop if the next rep would exceed ~RPE 8.5.', cues: ['Brace before you unrack', 'Knees track toes', 'Drive the floor away'] },
  front_squat: { name: 'Front Squat', type: 'strength', baseLift: 'fs', notes: 'Specific to the clean receive. Elbows high throughout.', cues: ['Elbows up', 'Upright torso', 'No collapse out of the hole'] },
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
  oh_cable_tri: { name: 'Overhead Cable Triceps Extension (rope)', type: 'hypertrophy', notes: 'Triceps long head at length.', cues: ['Elbows in and high', 'Full stretch behind the head', 'Lock out'] },
  cable_pressdown: { name: 'Cable Rope Pressdown', type: 'hypertrophy', notes: 'Triceps lateral and medial heads.', cues: ['Elbows pinned to the ribs', 'Spread the rope at lockout'] },

  // ── Legs, calves, trunk ───────────────────────────────────────────────────
  leg_ext: { name: 'Leg Extension', type: 'hypertrophy', notes: 'Rectus femoris — squats under-stimulate it because it crosses the hip. Friday so it cannot degrade Thursday.', cues: ['Full extension', 'Pause at the top', 'Control down'] },
  seated_leg_curl: { name: 'Seated Leg Curl', type: 'hypertrophy', notes: 'Knee-flexion hamstring hypertrophy. Loads better than a Nordic.', cues: ['Full range', 'Slow eccentric'] },
  nordic: { name: 'Nordic Curl (band-assisted)', type: 'hypertrophy', notes: 'Injury-prevention exposure, not physique volume. Weeks 1–2: 2×3 assisted. Week 3+: 2×4–6 toward unassisted. Stop before uncontrolled collapse.', cues: ['Hips locked out', 'Lower as slowly as you can control', 'Catch with the hands'] },
  standing_calf: { name: 'Standing Calf Raise', type: 'hypertrophy', notes: 'Gastrocnemius. 2s pause in the stretch.', cues: ['Full stretch at the bottom', 'Pause 2s', 'All the way up'] },
  seated_calf: { name: 'Seated Calf Raise', type: 'hypertrophy', notes: 'Soleus bias — the gastroc goes slack at 90° knee flexion. Whether that yields better chronic soleus growth than standing work is unconfirmed and trials disagree; one seated exposure of three is a hedge.', cues: ['Full range', 'Pause at the bottom'] },
  copenhagen: { name: 'Copenhagen Plank', type: 'core', notes: 'Adductors — the common injury in cutting sports. Progresses: 1) bottom knee on bench 2×20s · 2) 2×40s · 3) foot on bench 2×20s · 4) 2×30–40s · 5) + dumbbell on the top hip. Advance when you clear the top of the range on both sides.', cues: ['Hips stacked', 'Do not let the hip sag'] },
  cable_crunch: { name: 'Cable Crunch', type: 'hypertrophy', notes: 'Loaded spinal flexion — small increments, safe near failure. Strong inference, not a head-to-head winner.', cues: ['Curl the ribs to the pelvis', 'Hips stay put', 'Do not hinge'] },
  hanging_pelvic_curl: { name: 'Hanging Pelvic Curl', type: 'hypertrophy', notes: 'Curl the PELVIS toward the ribs. A straight hanging leg raise is mostly hip flexor.', cues: ['Posterior tilt is the rep', 'Hips curl up, not just legs', 'No swing'] },

  // ── Field / aerobic ───────────────────────────────────────────────────────
  jumps_cod: { name: 'Jumps + Reactive Agility', type: 'jump', notes: 'AM session, ≥6h before lifting. Maximal intent, low volume. STOP when jump height drops, contacts slow, or landings deteriorate.' },
  sprints_sled: { name: 'Sprints + Resisted Sled', type: 'jump', notes: 'AM session, ≥6h before lifting. Sled ~30% BW is a STARTING load — friction varies by sled and surface, so keep both constant and adjust by feel.' },
  bike_intervals: { name: 'Bike Intervals', type: 'cardio', notes: 'Build INTO each interval, climbing toward ~90–95% max HR in the latter portion. Do not sprint the first minute to force HR up. Skip if pickup already gave ~12+ min above 90% HRmax this week.' },
  zone2: { name: 'Zone 2 Cycling', type: 'cardio', notes: 'Separated ≥6h from lifting. Conversational, ~117–137 bpm. Cycling not running — less impact and eccentric cost.' },

  // ── Prep ──────────────────────────────────────────────────────────────────
  daily_mobility: { name: 'Needs-Based Positional Work', type: 'mobility', notes: 'Only what you need that day: ankle knee-to-wall, adductor rock-backs, thoracic rotations, scapular push-ups, band pull-aparts, PVC pass-throughs, deep-squat pry. If everything moves fine, skip to the bar.' },
  presession_prep: { name: 'Raise + Empty-Bar Round', type: 'warmup', notes: '3–5 min easy bike/rower/rope, then ONE empty-bar round for the day. Snatch: muscle snatch ×3 · OHS ×3 · snatch press ×3 · hang snatch ×2. C&J: muscle clean ×3 · front squat ×3 · press in split ×3 · tall clean ×2 · jerk footwork ×3. A second round only if the first did not prepare you.' },
};

// ─── Progression tables ───────────────────────────────────────────────────────
const LOAD1 = { // Weeks 1–3
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
  snatch_vol: [72.5, 75, 77.5], snatch_hvy: [82.5, 85, 87.5],
  cj_vol: [72.5, 75, 77.5], cj_hvy: [82.5, 85, 87.5],
  jerk_tue: [75, 77.5, 78], jerk_wed: [75, 77.5, 80], jerk_fri: [85, 87.5, 90],
  hh_snatch: [60, 65, 70],
  bs_mon: [75, 77.5, 80], bs_thu: [82.5, 85, 87.5],
  fs_tue: [77.5, 80, 82.5], fs_fri: [80, 82.5, 85],
  sets: { snVol: 5, cjVol: 5, snHvy: 5, cjHvy: 5, bsMon: 3, bsThu: 3, fsTue: 3, fsFri: 2, jerkFri: 4 },
  reps: { bsMon: 4, bsThu: 2, fsTue: 3, fsFri: 2 },
  intervalSec: 240,
};

const LOAD3 = { // Weeks 9–11
  snatch_vol: [75, 77.5, 80], snatch_hvy: [85, 87.5, 91],
  cj_vol: [75, 77.5, 80], cj_hvy: [85, 87.5, 91],
  jerk_tue: [75, 77.5, 80], jerk_wed: [77.5, 79, 80], jerk_fri: [85, 88.5, 92],
  hh_snatch: [65, 67.5, 70],
  bs_mon: [80, 82.5, 85], bs_thu: [85, 87.5, 90],
  fs_tue: [80, 82.5, 85], fs_fri: [82.5, 85, 87.5],
  sets: { snVol: 4, cjVol: 4, snHvy: 4, cjHvy: 4, bsMon: 3, bsThu: 3, fsTue: 3, fsFri: 2, jerkFri: 4 },
  reps: { bsMon: 3, bsThu: 2, fsTue: 3, fsFri: 2 },
  intervalSec: 240,
};

// Accessory ramp across weeks 1–3 of a loading block, and the RIR wave.
const RAMP = { 2: [1, 2, 2], 3: [2, 3, 3], 4: [3, 3, 4], 5: [4, 4, 5] };
const RIR = ['~3 RIR', '~2 RIR', '~1 RIR'];
function rampSets(full, w) { const r = RAMP[full]; return r ? r[Math.min(w, 2)] : full; }
function acc(id, full, w, repRange, rest, extra) {
  return Object.assign({ id, sets: rampSets(full, w), repRange, rest, fullSets: full, rirNote: RIR[Math.min(w, 2)] }, extra || {});
}

// ─── Warm-up ramps ────────────────────────────────────────────────────────────
function rampOly(targetPct, reps) {
  const t = Math.round(targetPct), steps = [];
  [[40, '3', 60], [50, '3', 75], [60, '2', 90], [70, '1', 120]].forEach(([p, r, rest]) => { if (p < t) steps.push({ pct: p, reps: r, rest }); });
  if (t >= 80) steps.push({ pct: Math.round(t - 8), reps: String(reps), rest: 150 });
  steps.push({ pct: t, reps: String(reps), rest: 180, top: true });
  return steps;
}
const RAMP_PRESS = [{ pct: 50, reps: '5', rest: 60 }, { pct: 75, reps: '3', rest: 90, top: true }];
const RAMP_PULL = [{ pct: 60, reps: '6', rest: 60, top: true }];
const RAMP_ONE = [{ pct: 60, reps: '5', rest: 60, top: true }];

// ─── Loading-week day builder ─────────────────────────────────────────────────
function makeDays(B, w) {
  const P = (a) => a[Math.min(w, a.length - 1)];
  const S = B.sets, R = B.reps;

  return {
    monday: {
      title: 'Monday — Snatch Volume · Back Squat · Push',
      totalMin: 71,
      sections: [
        { title: 'Olympic Block', color: 'gold', exercises: [
          { id: 'tall_snatch', sets: 2, reps: 3, pct: 30, baseLift: 'snatch', rest: 60 },
          { id: 'drop_snatch', sets: 3, reps: 2, pct: 48, baseLift: 'snatch', rest: 90 },
          { id: 'snatch_floor', sets: S.snVol, reps: 2, pct: P(B.snatch_vol), baseLift: 'snatch', rest: 150,
            buildup: rampOly(P(B.snatch_vol), 2), buildupNote: 'Ramp to the work weight. Ramp sets never count toward a set total.' },
          { id: 'snatch_balance', sets: 3, reps: 2, pct: 75, baseLift: 'snatch', rest: 150 },
          { id: 'back_squat', sets: S.bsMon, reps: R.bsMon, pct: P(B.bs_mon), baseLift: 'bs', rest: 180, buildup: rampOly(P(B.bs_mon), R.bsMon) },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', exercises: [
          acc('incline_db_press', 4, w, [6, 8], 150, { buildup: RAMP_PRESS, buildupNote: 'First press of the session — ramp both steps.' }),
          acc('cable_lateral_behind', 3, w, [12, 15], 90, { note: 'First isolation for this muscle — one set of 12–15 at ~half load first.' }),
          acc('oh_cable_tri', 3, w, [10, 12], 90),
          acc('standing_calf', 3, w, [8, 12], 90),
          acc('cable_crunch', 3, w, [10, 15], 60, { note: 'Pairs with the lateral raise — same tower, different height.' }),
        ]},
      ],
    },

    tuesday: {
      title: 'Tuesday — C&J · Technical Jerk · Front Squat · Bench',
      totalMin: 129,
      sections: [
        { title: 'AM — Jumps + Reactive Agility (≥6h before lifting)', color: 'red',
          note: '~35 min. Maximal intent, low volume. Stop when quality drops.', exercises: [
          { id: 'jumps_cod', duration: '35 min', rest: 0, note: w === 0
            ? 'Pogo 2×10 · CMJ 3×3 · Broad jump + stick 3×3 · Lateral bound + stick 3×3/side · 2 accel-to-stops + 2 submax cuts per side, then 5-10-5 ×3'
            : 'Pogo 2×10 · Low drop jump 8–12" 3×3 (only if landings are sound) · Broad jump 3×3 · Lateral bound 3×3/side · 5-10-5 ×2 + reactive drill ×2' },
        ]},
        { title: 'Olympic Block', color: 'gold', exercises: [
          { id: 'jerk_balance', sets: 3, reps: 3, pct: 38, baseLift: 'jerk', rest: 60 },
          { id: 'cj_floor', sets: S.cjVol, reps: '1+1', pct: P(B.cj_vol), baseLift: 'cj', rest: 180, buildup: rampOly(P(B.cj_vol), '1+1') },
          { id: 'jerk_rack', sets: 3, reps: 2, pct: P(B.jerk_tue), baseLift: 'jerk', rest: 150 },
          { id: 'front_squat', sets: S.fsTue, reps: R.fsTue, pct: P(B.fs_tue), baseLift: 'fs', rest: 180, buildup: rampOly(P(B.fs_tue), R.fsTue) },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', exercises: [
          acc('bench', 4, w, [3, 6], 180, { buildup: RAMP_PRESS, buildupNote: 'At 3–6 reps near failure you need both ramp steps.' }),
          acc('cs_row', 4, w, [8, 10], 120, { buildup: RAMP_PULL }),
          acc('seated_leg_curl', 3, w, [8, 12], 90),
          acc('db_shrug', 3, w, [10, 12], 90),
          acc('cable_lateral', 3, w, [12, 20], 90),
          acc('incline_db_curl', 3, w, [10, 12], 90, { note: 'Shrug, curl and Copenhagen all run from one bench — grab a heavy pair and a light pair at the start.' }),
          { id: 'nordic', sets: 2, reps: w < 2 ? '3' : '4–6', rest: 120, note: w < 2 ? 'Weeks 1–2: band-assisted, 2×3.' : 'Week 3+: 2×4–6, toward unassisted eccentrics.' },
          { id: 'copenhagen', sets: 2, duration: '20–30s/side', rest: 60 },
        ]},
      ],
    },

    wednesday: {
      title: 'Wednesday — Full-Catch Technique · Upper Hypertrophy',
      totalMin: 109,
      sections: [
        { title: 'Receiving Block', color: 'gold',
          note: 'Below parallel is MANDATORY on the high-hang work, 1s pause. A high catch is a failed rep — drop 10 lb and repeat. Stand every rep completely.', exercises: [
          { id: 'ohs', sets: 2, reps: 5, pct: 52, baseLift: 'snatch', rest: 120 },
          { id: 'hh_snatch', sets: 4, reps: 2, pct: P(B.hh_snatch), baseLift: 'snatch', rest: 120 },
          { id: 'hh_clean', sets: 4, reps: 2, rest: 150, recvKey: 'hh_clean' },
          { id: 'split_jerk_rack', sets: 3, reps: '1–2', pct: P(B.jerk_wed), baseLift: 'jerk', rest: 120 },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', note: 'Eight separate stations — no legitimate pairing. Run it straight with tight rest.', exercises: [
          acc('incline_db_press', 4, w, [8, 10], 150, { buildup: RAMP_PRESS }),
          acc('low_high_fly', 3, w, [12, 15], 90),
          acc('cable_lateral', 5, w, [12, 20], 90),
          acc('db_shrug', 2, w, [12, 15], 90),
          acc('oa_cable_row', 3, w, [8, 12], 120, { buildup: RAMP_PULL }),
          acc('reverse_pec_deck', 3, w, [15, 20], 75),
          acc('seated_calf', 3, w, [10, 20], 90),
          acc('cable_pressdown', 3, w, [10, 15], 75),
        ]},
        { title: 'Zone 2 — separated ≥6h', color: 'green', exercises: [
          { id: 'zone2', duration: '30–40 min', rest: 0 },
        ]},
      ],
    },

    thursday: {
      title: 'Thursday — Heavy Snatch · Back Squat · Push',
      totalMin: 92,
      sections: [
        { title: 'AM — Sprints + Sled (≥6h before lifting)', color: 'red',
          note: '~30 min. Rest long enough that every rep stays fast.', exercises: [
          { id: 'sprints_sled', duration: '30 min', rest: 0, note: w === 0
            ? '3 × 15 m resisted sled (~30% BW start), 3 min rest · 3 × 20 m unresisted, 3 min rest'
            : '3 × 20 m build-up · 3 × flying 20 m off a 20 m run-in, 4 min rest' },
        ]},
        { title: 'Olympic Block', color: 'gold', exercises: [
          { id: 'snatch_floor', sets: S.snHvy, reps: 1, pct: P(B.snatch_hvy), baseLift: 'snatch', rest: 180,
            buildup: rampOly(P(B.snatch_hvy), 1), buildupNote: 'Week 11 tops at 90–92.5% only if the lifts are pristine.' },
          { id: 'snatch_balance', sets: 2, reps: 2, pct: 75, baseLift: 'snatch', rest: 120 },
          { id: 'back_squat', sets: S.bsThu, reps: R.bsThu, pct: P(B.bs_thu), baseLift: 'bs', rest: 180, buildup: rampOly(P(B.bs_thu), R.bsThu) },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', exercises: [
          acc('incline_db_press', 3, w, [8, 12], 150, { buildup: RAMP_ONE, buildupNote: 'Third incline exposure this week — one ramp set is enough.' }),
          acc('cable_lateral', 3, w, [12, 20], 90),
          acc('standing_calf', 3, w, [8, 15], 90),
          acc('hanging_pelvic_curl', 3, w, [10, 15], 60),
        ]},
      ],
    },

    friday: {
      title: 'Friday — Heavy C&J · Heavy Jerk · Front Squat · Bench',
      totalMin: 87,
      sections: [
        { title: 'Olympic Block', color: 'gold',
          note: 'No clean pulls this block — you clean 255 and power clean 255, so pulling high is the one thing you are already excellent at. That slot goes to cleans you actually receive.', exercises: [
          { id: 'cj_floor', sets: S.cjHvy, reps: '1+1', pct: P(B.cj_hvy), baseLift: 'cj', rest: 210, buildup: rampOly(P(B.cj_hvy), '1+1') },
          { id: 'jerk_rack_heavy', sets: S.jerkFri, reps: 1, pct: P(B.jerk_fri), baseLift: 'jerk', rest: 180 },
          { id: 'recv_clean', sets: 3, reps: 1, rest: 150, recvKey: 'recv_clean' },
          { id: 'front_squat', sets: S.fsFri, reps: R.fsFri, pct: P(B.fs_fri), baseLift: 'fs', rest: 180, buildup: rampOly(P(B.fs_fri), R.fsFri) },
        ]},
        { title: 'Hypertrophy Block', color: 'blue', exercises: [
          acc('rdl', 3, w, [6, 8], 150, { buildup: RAMP_ONE, buildupNote: 'One light ramp set — this is one people skip and should not.' }),
          acc('bench', 4, w, [3, 6], 180, { buildup: RAMP_PRESS }),
          acc('cs_high_row', 3, w, [8, 12], 120, { buildup: RAMP_PULL }),
          acc('weighted_pullup', 3, w, [6, 10], 150),
          acc('leg_ext', 3, w, [10, 15], 90),
        ]},
      ],
    },

    saturday: {
      title: 'Saturday — Upper Accessories · Bike Intervals',
      totalMin: 15,          // played pickup → intervals skipped
      totalMinNoSport: 40,   // no pickup → intervals included
      sections: [
        { title: 'Accessories (moved off Friday)', color: 'blue',
          note: 'Isolation only. The last three all run off one dual-pulley tower — reverse fly high, raise and curl low.', exercises: [
          acc('db_shrug', 3, w, [10, 12], 90),
          acc('cable_lateral', 4, w, [12, 20], 90),
          acc('reverse_cable_fly', 3, w, [15, 20], 75),
          acc('cable_curl', 3, w, [10, 15], 90),
        ]},
        { title: 'Bike Intervals', color: 'red', exercises: [
          { id: 'bike_intervals', duration: `4 × ${B.intervalSec / 60} min on / 3 min off`, rest: 0,
            interval: { rounds: 4, workSec: B.intervalSec, restSec: 180, lastRest: false },
            optional: true,
            optNote: 'Skipped because you played pickup this week — a hard hour already supplied the stimulus. Flip to "No Pickup" in Settings to reinstate.',
            note: 'On a cut, hold at 4 × 3 min rather than progressing to 4 × 4.' },
        ]},
      ],
    },

    sunday: { title: 'Sunday — Complete Rest', isRest: true, totalMin: 0,
      note: 'Walking, food, fluids. Nothing structured.' },
  };
}

// ─── Deload weeks (4 and 8) ───────────────────────────────────────────────────
function makeDeload() {
  const holdNote = 'Receiving load HOLDS on a deload — no progression this week.';
  return {
    monday: { title: 'Monday — Deload', totalMin: 50, sections: [
      { title: 'Olympic Block', color: 'gold', note: 'Half the work sets, capped 60–70%.', exercises: [
        { id: 'drop_snatch', sets: 2, reps: 2, pct: 45, baseLift: 'snatch', rest: 90 },
        { id: 'snatch_floor', sets: 3, reps: 2, pct: 65, baseLift: 'snatch', rest: 150 },
        { id: 'back_squat', sets: 2, reps: 4, pct: 67, baseLift: 'bs', rest: 180 },
      ]},
      { title: 'Hypertrophy — half sets, ~4 RIR', color: 'blue', exercises: [
        { id: 'incline_db_press', sets: 2, repRange: [8, 10], rest: 150 },
        { id: 'cable_lateral_behind', sets: 2, repRange: [12, 15], rest: 90 },
        { id: 'cable_crunch', sets: 2, repRange: [10, 15], rest: 60 },
      ]},
    ]},
    tuesday: { title: 'Tuesday — Deload', totalMin: 55, sections: [
      { title: 'AM — half volume', color: 'red', exercises: [
        { id: 'jumps_cod', duration: '18 min', rest: 0, note: 'Half the reps at FULL intent.' },
      ]},
      { title: 'Olympic Block', color: 'gold', exercises: [
        { id: 'cj_floor', sets: 3, reps: '1+1', pct: 65, baseLift: 'cj', rest: 180 },
        { id: 'jerk_rack', sets: 2, reps: 2, pct: 62, baseLift: 'jerk', rest: 150 },
        { id: 'front_squat', sets: 2, reps: 3, pct: 67, baseLift: 'fs', rest: 180 },
      ]},
      { title: 'Hypertrophy — half sets, ~4 RIR', color: 'blue', exercises: [
        { id: 'bench', sets: 2, repRange: [3, 6], rest: 180 },
        { id: 'cs_row', sets: 2, repRange: [8, 10], rest: 120 },
        { id: 'cable_lateral', sets: 2, repRange: [12, 20], rest: 90 },
        { id: 'copenhagen', sets: 2, duration: '20–30s/side', rest: 60 },
      ]},
    ]},
    wednesday: { title: 'Wednesday — Deload', totalMin: 45, sections: [
      { title: 'Receiving Block', color: 'gold', note: holdNote, exercises: [
        { id: 'hh_snatch', sets: 2, reps: 2, pct: 55, baseLift: 'snatch', rest: 120 },
        { id: 'hh_clean', sets: 2, reps: 2, rest: 150, recvKey: 'hh_clean', note: holdNote },
        { id: 'split_jerk_rack', sets: 2, reps: 1, pct: 65, baseLift: 'jerk', rest: 120 },
      ]},
      { title: 'Hypertrophy — half sets', color: 'blue', exercises: [
        { id: 'incline_db_press', sets: 2, repRange: [8, 10], rest: 150 },
        { id: 'cable_lateral', sets: 2, repRange: [12, 20], rest: 90 },
        { id: 'seated_calf', sets: 2, repRange: [10, 20], rest: 90 },
      ]},
      { title: 'Easy aerobic — intervals replaced', color: 'green', exercises: [
        { id: 'zone2', duration: '25–35 min', rest: 0, note: 'Deload week: easy spin replaces the intervals.' },
      ]},
    ]},
    thursday: { title: 'Thursday — Deload', totalMin: 45, sections: [
      { title: 'AM — half volume', color: 'red', exercises: [
        { id: 'sprints_sled', duration: '15 min', rest: 0, note: 'Half the reps at FULL intent after a complete warm-up, or skip if readiness or warm-up quality is poor.' },
      ]},
      { title: 'Olympic Block', color: 'gold', exercises: [
        { id: 'snatch_floor', sets: 3, reps: 1, pct: 70, baseLift: 'snatch', rest: 180 },
        { id: 'back_squat', sets: 2, reps: 3, pct: 67, baseLift: 'bs', rest: 180 },
      ]},
      { title: 'Hypertrophy — half sets', color: 'blue', exercises: [
        { id: 'incline_db_press', sets: 2, repRange: [8, 12], rest: 150 },
        { id: 'standing_calf', sets: 2, repRange: [8, 15], rest: 90 },
      ]},
    ]},
    friday: { title: 'Friday — Deload', totalMin: 55, sections: [
      { title: 'Olympic Block', color: 'gold', exercises: [
        { id: 'cj_floor', sets: 3, reps: '1+1', pct: 70, baseLift: 'cj', rest: 210 },
        { id: 'jerk_rack_heavy', sets: 2, reps: 1, pct: 67, baseLift: 'jerk', rest: 180 },
        { id: 'recv_clean', sets: 2, reps: 1, rest: 150, recvKey: 'recv_clean', note: holdNote },
      ]},
      { title: 'Hypertrophy — half sets', color: 'blue', exercises: [
        { id: 'rdl', sets: 2, repRange: [6, 8], rest: 150 },
        { id: 'bench', sets: 2, repRange: [3, 6], rest: 180 },
        { id: 'weighted_pullup', sets: 2, repRange: [6, 10], rest: 150 },
        { id: 'leg_ext', sets: 2, repRange: [10, 15], rest: 90 },
      ]},
    ]},
    saturday: { title: 'Saturday — Deload', totalMin: 40, sections: [
      { title: 'Accessories — half sets', color: 'blue', exercises: [
        { id: 'db_shrug', sets: 2, repRange: [10, 12], rest: 90 },
        { id: 'cable_lateral', sets: 2, repRange: [12, 20], rest: 90 },
        { id: 'reverse_cable_fly', sets: 2, repRange: [15, 20], rest: 75 },
        { id: 'cable_curl', sets: 2, repRange: [10, 15], rest: 90 },
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
    monday: { title: 'Monday — Taper', totalMin: 35, note: noAcc, sections: [
      { title: 'Taper', color: 'gold', exercises: [
        { id: 'snatch_floor', sets: 3, reps: 1, pct: 72, baseLift: 'snatch', rest: 180, buildup: rampOly(72, 1) },
        { id: 'back_squat', sets: 2, reps: 2, pct: 70, baseLift: 'bs', rest: 180 },
      ]},
    ]},
    tuesday: { title: 'Tuesday — Taper', totalMin: 35, note: noAcc, sections: [
      { title: 'Taper', color: 'gold', exercises: [
        { id: 'cj_floor', sets: 3, reps: '1+1', pct: 72, baseLift: 'cj', rest: 210, buildup: rampOly(72, '1+1') },
        { id: 'front_squat', sets: 2, reps: 2, pct: 70, baseLift: 'fs', rest: 180 },
      ]},
    ]},
    wednesday: { title: 'Wednesday — Optional Technique', totalMin: 30, sections: [
      { title: 'Optional — ≤60%', color: 'gold', note: 'Optional 30 min. Skip it if you feel flat.', exercises: [
        { id: 'hh_snatch', sets: 2, reps: 2, pct: 58, baseLift: 'snatch', rest: 120, optional: true },
        { id: 'hh_clean', sets: 2, reps: 2, rest: 150, recvKey: 'hh_clean', optional: true, note: 'Optional. Hold the weight — do not progress.' },
      ]},
    ]},
    thursday: { title: 'Thursday — Rest', isRest: true, totalMin: 0, note: 'Full rest.' },
    friday: { title: 'Friday — Light Primers', totalMin: 30, sections: [
      { title: 'Primers', color: 'gold', exercises: [
        { id: 'snatch_floor', sets: 2, reps: 1, pct: 70, baseLift: 'snatch', rest: 180 },
        { id: 'cj_floor', sets: 2, reps: '1+1', pct: 70, baseLift: 'cj', rest: 180 },
      ]},
    ]},
    saturday: { title: 'Saturday — Rest or easy spin', totalMin: 20, sections: [
      { title: 'Optional', color: 'green', exercises: [{ id: 'zone2', duration: '20 min easy', rest: 0, optional: true }] },
    ]},
    sunday: { title: 'Sunday — Complete Rest', isRest: true, totalMin: 0 },
  };
}

// ─── Week 13 — test week ──────────────────────────────────────────────────────
// Uses the app's testing flow: `lifts[]` write achieved maxes straight to STATE.maxes.
const TEST_NOTE = 'Rest 5+ min between attempts. Stop at two misses. Nothing else this week — no accessories, no field work, no intervals.';
function makeTest() {
  return {
    monday: {
      title: 'Day 1 — Snatch 1RM', isTesting: true, totalMin: 60,
      note: 'Fresh, priority 1. Ramp, then take singles. ' + TEST_NOTE,
      lifts: [{ lift: 'snatch', label: 'Snatch — 1RM', cues: ['Catch depth is not a criterion — a controlled high catch you stand up counts', 'Stop at two misses'] }],
    },
    tuesday: {
      title: 'Day 2 — Clean & Jerk 1RM', isTesting: true, totalMin: 60,
      note: 'Fresh, priority 1. ' + TEST_NOTE,
      lifts: [{ lift: 'cj', label: 'Clean & Jerk — 1RM', cues: ['Heaviest COMPLETED C&J', 'Clean it but miss the jerk and it does not count'] }],
    },
    wednesday: { title: 'Day 3 — Rest', isRest: true, note: 'Rest, or 20 min easy spin.' },
    thursday: {
      title: 'Day 4 — Rack Jerk 1RM + Below-Parallel Clean', isTesting: true, totalMin: 70,
      note: 'Jerk FIRST — it is the binding constraint. ' + TEST_NOTE,
      lifts: [
        { lift: 'jerk', label: 'Jerk from Rack — 1RM', cues: ['No press-outs', 'Deliberate recovery from the split, not a scramble'] },
        { lift: 'clean', label: 'Clean received BELOW PARALLEL — 1RM', cues: ['Heaviest clean you catch below parallel and stand up', 'A high catch does not count', 'The gap to 255 is the deficit this program exists to close'] },
      ],
    },
    friday: {
      title: 'Day 5 — Squats + Bench', isTesting: true, totalMin: 75,
      note: 'Squats as DOUBLES, not singles — less fatigue, and it protects the bench that follows. Convert: a double at RPE 8 = 89% of 1RM, at RPE 9 = 92%. ' + TEST_NOTE,
      lifts: [
        { lift: 'bs', label: 'Back Squat — 2RM (convert to 1RM)' },
        { lift: 'fs', label: 'Front Squat — 2RM (convert to 1RM)' },
        { lift: 'bench', label: 'Bench Press — 1RM' },
      ],
    },
    saturday: { title: 'Days 6–7 — Rest', isRest: true, note: 'Rest. Rebuild the next cycle from these seven numbers.' },
    sunday: { title: 'Days 6–7 — Rest', isRest: true, note: 'When you are ready, switch back to Block 1 in Settings with the new maxes.' },
  };
}

// ─── Main program export ──────────────────────────────────────────────────────
const PROGRAM = {
  exercises: EX,
  testingWeek: makeTest(),

  // Absolute-load receiving work — progresses on catch quality, not a percentage.
  receiving: {
    hh_clean:   { name: 'High-Hang Clean', start: 165, cap: 210, step: 5, gate: 'all 8 catches below parallel with a 1s pause' },
    recv_clean: { name: 'Received Clean',  start: 190, cap: 220, step: 5, gate: 'all 3 below parallel and stood up cleanly' },
  },

  blocks: [
    { id: 1, name: 'Weeks 1–3: Accumulation', weeks: 3, startWeek: 1,
      description: 'Technical volume at 65–82.5%. Accessories ramp 70% → 85% → 100% across the three weeks; RIR waves 3 → 2 → 1.',
      getDay: (dayKey, w) => makeDays(LOAD1, w)[dayKey] },
    { id: 2, name: 'Week 4: Deload', weeks: 1, startWeek: 4,
      description: 'Half the work sets, capped 60–70%. Field work halved at full intent. Intervals replaced by easy spin. Receiving loads HOLD.',
      getDay: (dayKey) => makeDeload()[dayKey] },
    { id: 3, name: 'Weeks 5–7: Intensification', weeks: 3, startWeek: 5,
      description: 'Volume work to 77.5%, heavy singles to 87.5%. Accessories restart at ~85% of full.',
      getDay: (dayKey, w) => makeDays(LOAD2, w)[dayKey] },
    { id: 4, name: 'Week 8: Deload', weeks: 1, startWeek: 8,
      description: 'Same reduction as week 4.',
      getDay: (dayKey) => makeDeload()[dayKey] },
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

  makePrepSection() {
    return {
      title: 'Prep', color: 'green',
      note: 'Needs-based only. Ramp the first loaded exposure of a joint or muscle in a session — not every exercise.',
      exercises: [
        { id: 'daily_mobility', duration: '5–8 min', rest: 0 },
        { id: 'presession_prep', duration: '8 min', rest: 0 },
      ],
    };
  },

  getWorkout(blockId, weekInBlock, dayKey, cutting) {
    let day = this.getDayWorkout(blockId, weekInBlock, dayKey);
    // Taper (6) and test (7) prescribe their own reduced volume — never cut them.
    if (cutting && blockId !== 6 && blockId !== 7) day = this.applyCutting(day);
    if (day && day.sections && !day.isRest) {
      day = { ...day, totalMin: (day.totalMin || 0) + 17, sections: [this.makePrepSection(), ...day.sections] };
    }
    return day;
  },

  // ── Cut phase ─────────────────────────────────────────────────────────────
  // Competition-lift frequency and set/rep structure are IDENTICAL in both
  // phases. On a cut: Thursday/Friday top intensity caps at 87.5%, and accessory
  // + squat volume drops to the C-column counts. Field work and hamstring volume
  // are unchanged. Saturday intervals hold at 4 × 3 min.
  CUT_SETS: {
    incline_db_press: { 4: 3, 3: 3 }, low_high_fly: { 3: 2 },
    cable_lateral_behind: { 3: 2 }, cable_lateral: { 3: 2, 4: 3, 5: 4 },
    db_shrug: { 3: 2, 2: 2 }, oh_cable_tri: { 3: 2 }, cable_pressdown: { 3: 2 },
    standing_calf: { 3: 2 }, seated_calf: { 3: 2 },
    cable_crunch: { 3: 2 }, hanging_pelvic_curl: { 3: 2 },
    bench: { 4: 3 }, cs_row: { 4: 3 }, cs_high_row: { 3: 2 }, oa_cable_row: { 3: 2 },
    reverse_pec_deck: { 3: 2 }, reverse_cable_fly: { 3: 2 },
    incline_db_curl: { 3: 2 }, cable_curl: { 3: 2 }, leg_ext: { 3: 2 },
    back_squat: { 3: 2 }, front_squat: { 3: 2 },
    // Unchanged on a cut — hamstrings, pull-ups, adductors:
    rdl: { 3: 3 }, nordic: { 2: 2 }, seated_leg_curl: { 3: 3 },
    copenhagen: { 2: 2 }, weighted_pullup: { 3: 3 },
  },
  CUT_INTENSITY_CAP: 87.5,

  applyCutting(day) {
    if (!day || !day.sections) return day;
    const clone = JSON.parse(JSON.stringify(day));
    clone.cutting = true;
    clone.sections.forEach(sec => {
      sec.exercises.forEach(ex => {
        const def = EX[ex.id];
        if (!def) return;
        if (def.type === 'oly' && typeof ex.pct === 'number' && ex.pct > this.CUT_INTENSITY_CAP) {
          ex.pct = this.CUT_INTENSITY_CAP;
          ex.cutNote = `Cut: capped at ${this.CUT_INTENSITY_CAP}%`;
          if (ex.buildup) ex.buildup = rampOly(this.CUT_INTENSITY_CAP, ex.reps);
        }
        const map = this.CUT_SETS[ex.id];
        if (map && typeof ex.sets === 'number' && map[ex.sets] != null && map[ex.sets] < ex.sets) {
          ex.sets = map[ex.sets];
          ex.cutNote = (ex.cutNote ? ex.cutNote + ' · ' : '') + 'Cut volume';
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
