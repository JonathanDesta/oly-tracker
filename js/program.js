'use strict';
// Revision 6: source is the September 13, 2026 failure-work-set program.
// Pure prescription functions; logs never depend on a mutable current template.
const EX = {
  snatch: [
    'Full snatch from floor',
    'quality',
    'Full receive; secure overhead; stand every rep. Reset doubles 10–20 s on the floor.',
  ],
  cj: [
    'Full clean & jerk',
    'quality',
    'One full clean + one jerk per pair. Secure receive, stable fixation and recovery; no press-out.',
  ],
  hang: [
    'Above-knee hang full snatch',
    'quality',
    'Pause 1 s above the knee. Full receive; stand every rep.',
  ],
  jerk: [
    'Rack jerk',
    'quality',
    'Vertical dip, secure fixation and recovery. Reset doubles 10–20 s; use two singles 30 s apart if reracking is awkward.',
  ],
  pull: [
    'Explosive snatch pull',
    'quality',
    'Position rehearsal, not failure work. Stop if speed or positions deteriorate.',
  ],
  clean: [
    'Full clean assessment',
    'quality',
    'Technical reference, not a max. Stop at effort 8 or the first technical error; no retry.',
  ],
  front_squat: [
    'Front squat',
    'failure',
    'Full comfortable depth. Safeties set; stop at the last valid rep when another cannot be completed with the same form. No collapsed rep.',
  ],
  back_squat: [
    'High-bar back squat',
    'failure',
    'Same high-bar setup and depth each time. Safeties set; strict-form 0 RIR, no collapsed rep.',
  ],
  bench: [
    'Flat barbell bench press',
    'failure',
    'Brief pause on chest, no bounce. Safeties or competent spotter; last valid rep at strict-form 0 RIR.',
  ],
  incline: [
    'Incline machine press · 30–45°',
    'failure',
    'Comfortable angle, stable deep range. Controlled attempt at the safe stop; no forced reps.',
  ],
  lateral: [
    'Cable lateral raise',
    'failure',
    'Slightly forward arm plane, about shoulder height; no torso swing or shortened-ROM finishers. DB is an equivalent menu option.',
  ],
  row: [
    'Chest-supported row',
    'failure',
    'Chest stays on support; full comfortable reach, no trunk heave.',
  ],
  pulldown: [
    'Lat pulldown',
    'failure',
    'Controlled overhead reach; pull to upper chest without swing.',
  ],
  shrug: [
    'Supported machine or DB shrug',
    'failure',
    'Full comfortable elevation and controlled lowering. Straps allowed; no neck circles.',
  ],
  rear_delt: [
    'Reverse pec deck',
    'failure',
    'Stable torso and comfortable rear-delt range; no lumbar extension.',
  ],
  curl: [
    'Cable curl · arms beside torso',
    'failure',
    'Supinated grip, neutral shoulders; full comfortable elbow range, no torso assist.',
  ],
  triceps: [
    'Overhead cable triceps extension',
    'failure',
    'Upper arms comfortably overhead and stable; controlled deep elbow bend. Pressdown only for actual overhead intolerance.',
  ],
  leg_curl: [
    'Seated leg curl',
    'failure',
    'Hip flexed, pelvis secured; full comfortable knee range, no hip lifting.',
  ],
  calf: [
    'Standing calf raise',
    'failure',
    'Knees extended; 2 s down, 1 s bottom pause, full rise; no bouncing. Supported knee-extended calf press is the fallback.',
  ],
  leg_ext: [
    'Supported reclined leg extension',
    'failure',
    'Prefer about 40° anatomical hip flexion (interior torso–thigh angle about 140°). Back/pelvis supported, knee aligned. Use upright seated extension if the machine cannot support this securely; do not arch the spine.',
  ],
  crunch: [
    'Machine abdominal crunch',
    'failure',
    'Controlled trunk flexion; supported machine with a safe stop, no hip pulling or neck strain.',
  ],
  press: [
    'Supported seated overhead press',
    'failure',
    'Machine or supported DB. A monitored fixation-strength trial; replaces one incline set.',
  ],
  pause_jerk: [
    'Pause-dip jerk',
    'quality',
    'Pause 1 s in the dip. Assistance trial replaces the first two C jerk sets; effort ≤7.',
  ],
  jump: [
    'Countermovement jump',
    'speed',
    'Maximal intent, controlled landing. Reset 10 s between reps; stop for falling height or altered landing.',
  ],
  sprint: [
    'Standing-start acceleration',
    'speed',
    'Smooth acceleration, full recovery. Stop for pain, altered gait, or two comparable runs >3% slower with reliable timing.',
  ],
  fly: [
    'Flying 10 m · 20 m run-in',
    'speed',
    'Smooth 20 m build, then a timed 10 m fly. Full 3–4 min rest.',
  ],
  cut: [
    '45° cut · 5 m in / 5 m out',
    'speed',
    'One cut per side per set. 20–30 s between sides, 2 min between sets.',
  ],
  aerobic: [
    'Easy cycle or brisk walk',
    'aerobic',
    'RPE 3–4/10; full-sentence talk test. Actual moving minutes only.',
  ],
};
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const ACCESSORIES = [
  ['incline', 3, 6, 10, 210],
  ['lateral', 4, 12, 20, 150],
  ['row', 2, 8, 12, 180],
  ['pulldown', 1, 8, 12, 180],
  ['shrug', 1, 10, 15, 150],
  ['rear_delt', 1, 12, 20, 150],
  ['curl', 1, 8, 12, 150],
  ['triceps', 1, 10, 15, 150],
  ['leg_curl', 2, 8, 12, 150],
  ['calf', 2, 10, 15, 150],
  ['leg_ext', 1, 10, 15, 150],
  ['crunch', 1, 10, 15, 150],
];
const WARMUP =
  '4–6 min easy cycle/walk (RPE 2–3). Ankle rocks 8/side; bodyweight squat 6; reverse lunge 4/side; thoracic rotation 5/side; wrist circles 10 each direction; wall slide 8; light band external rotation 10/side. All warm-ups submaximal.';
const RAMPS = {
  snatch:
    'Light bar: snatch RDL 5, muscle snatch 3, overhead squat 3 (2 s pause), high-hang snatch 3. Then 40% SN ×3, 50% ×2, 60% ×1; add 70% ×1 for work ≥75%, 80% ×1 for work ≥85%. Skip stages at/above work weight.',
  cj: 'Light bar: clean RDL 5, tall clean 3, front squat 3, dip 3, footwork 3, light jerk 3. Then 40% CJ ×2 cleans + 2 jerks, 50% ×1+1, 60% ×1+1; add 70% ×1+1 for work ≥75%, 80% ×1+1 for work ≥85%. Skip stages at/above work weight.',
  jerk: 'Light rack hold 10 s, dip 3, footwork 3. Then 40% of intended work weight ×3, 60% ×2, 80% ×1. Assessment uses its replacement ramp.',
  squat: 'Empty bar ×5; 40% of work weight ×5, 60% ×3, 80% ×1, optional 90% ×1.',
  bench: 'Empty bar ×10; 40% of work weight ×6, 60% ×3, 80% ×1; 90% ×1 on the low-rep day.',
  incline: '40% of work weight ×8, 65% ×4; rest 60–90 s. No failure warm-ups.',
  field:
    '4–5 min easy walk/jog. Ankle rocks and leg swings 8/side; marching 2×10 m; 3×20 m runs at 50%, 65%, 80%. Walk back; rest 90 s before work.',
};
const copy = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
function weekInfo(week) {
  week = clamp(week, 1, 13);
  const phase = week <= 4 ? 'F' : week <= 8 ? 'B' : week <= 11 ? 'R' : week === 12 ? 'T' : 'P';
  return {
    week,
    phase,
    checkpoint: week === 4 || week === 8,
    held: [4, 8, 9, 10, 11, 12, 13].includes(week),
    name: { F: 'Foundation', B: 'Build', R: 'Realization', T: 'Taper & test', P: 'Pivot' }[phase],
  };
}
function defaults() {
  return {
    revision: 6,
    cycle: 1,
    week: 1,
    exposure: 1,
    onboarding: true,
    entryStage: 1,
    phaseGate: 'F',
    anchors: { snatch: 155, cj: 205, jerk: null, clean: null },
    increment: 2.5,
    split: false,
    omitPull: false,
    reduceMondaySnatch: false,
    reduceCJerk: false,
    lateral: 'cable',
    tricepsFallback: false,
    calfFallback: false,
    legExtUpright: false,
    athletics: {
      enabled: false,
      stage: 0,
      day: 'monday',
      secondary: 0,
      variation: 'none',
      variationEffort: 90,
    },
    cardio: { enabled: false, minutes: 40 },
    mobility: [],
    mobilitySeconds: 30,
    mobilityDays: 3,
    trial: { kind: 'none', day: 'friday', exercise: 'shrug' },
    established: [],
    heavy: { snatch: 0, cj: 0, extraSnatch: 0, extraCj: 0 },
    assessment: 'none',
    rackLoad: null,
    review: [],
    recovery: 'normal',
  };
}
function oly(id, sets, reps, range, anchor, effort = 7, rest = 150, extra = {}) {
  return {
    id,
    key: id,
    name: EX[id][0],
    kind: 'quality',
    sets,
    reps,
    range,
    anchor,
    effort,
    rest,
    note: EX[id][2],
    warmup:
      RAMPS[id] ||
      (id === 'hang'
        ? RAMPS.snatch
        : id === 'pull'
          ? 'Three controlled floor starts at 60% of intended pull weight.'
          : ''),
    ...extra,
  };
}
function failure(id, sets, lo, hi, rest, extra = {}) {
  return {
    id,
    key: id,
    name: EX[id][0],
    kind: 'failure',
    sets,
    reps: `${lo}–${hi}`,
    repRange: [lo, hi],
    rest,
    rir: 0,
    note: EX[id][2],
    tempo: 'About 2 s lowering',
    warmup:
      RAMPS[id] ||
      (['front_squat', 'back_squat'].includes(id)
        ? RAMPS.squat
        : 'One easy set of 6–8 reps; rest 60–90 s. No failure.'),
    ...extra,
  };
}
function conventional(config, phase, day, oneEach = false) {
  const low = day === 'tuesday',
    stage = config.onboarding && config.cycle === 1 ? config.entryStage : 3;
  const squatRange = phase === 'F' || phase === 'P' ? [4, 6] : [3, 5];
  const rows = [
    failure(low ? 'front_squat' : 'back_squat', 1, ...squatRange, 270),
    failure('bench', 1, ...(low ? [3, 5] : [6, 8]), 240, {
      key: low ? 'bench_low' : 'bench_moderate',
    }),
  ];
  ACCESSORIES.forEach(([id, n, lo, hi, rest]) => {
    let sets = n;
    if (stage === 1 || oneEach) sets = 1;
    else if (stage === 2) sets = { incline: 2, lateral: 3, row: 2 }[id] || 1;
    rows.push(failure(id, sets, lo, hi, rest));
  });
  if (config.lateral === 'db') rows.find((e) => e.id === 'lateral').name = 'Dumbbell lateral raise';
  if (config.tricepsFallback)
    Object.assign(
      rows.find((e) => e.id === 'triceps'),
      {
        name: 'Cable pressdown · intolerance fallback',
        note: 'Keep elbows beside the torso. Controlled extension and return, stable upper arms, no torso heave. Use this when overhead positioning is intolerable.',
      },
    );
  if (config.calfFallback)
    rows.find((e) => e.id === 'calf').name = 'Supported knee-extended calf press';
  if (config.legExtUpright)
    Object.assign(
      rows.find((e) => e.id === 'leg_ext'),
      {
        name: 'Upright seated leg extension · setup fallback',
        note: 'Back and pelvis supported, knee aligned with the machine axis. Full comfortable knee range. Use the secure upright setup because this machine cannot support the reclined option.',
      },
    );
  const active = config.trial || {};
  const trials = [...(config.established || []), active].filter(
    (t) => t.day === day && ['F', 'B', 'R'].includes(phase),
  );
  if (trials.some((t) => t.kind === 'press')) {
    rows.find((e) => e.id === 'incline').sets -= 1;
    rows.splice(
      2,
      0,
      failure('press', 1, 6, 10, 210, { warmup: RAMPS.incline, trial: active.kind === 'press' }),
    );
  }
  const squats = oneEach ? 0 : trials.filter((t) => t.kind === 'squat').length;
  if (squats)
    rows.splice(
      1,
      0,
      failure(low ? 'front_squat' : 'back_squat', squats, 3, 5, 270, {
        key: 'squat_support',
        trial: active.kind === 'squat',
      }),
    );
  if (!oneEach)
    trials
      .filter((t) => t.kind === 'set')
      .forEach((t) => {
        const row = rows.find((e) => e.id === t.exercise);
        if (row) {
          row.sets++;
          if (t === active) row.trial = true;
        }
      });
  if (trials.some((t) => t.kind === 'calf_partial')) {
    const row = rows.find((e) => e.id === 'calf');
    row.sets--;
    rows.splice(
      rows.indexOf(row) + 1,
      0,
      failure('calf', 1, 10, 15, 150, {
        key: 'calf_partial',
        name: 'Standing calf · heel-down to neutral partial',
        note: 'Planned fixed partial ROM only: heel-down to neutral; same supported setup. 2 s down, no bouncing.',
        trial: active.kind === 'calf_partial',
      }),
    );
  }
  return rows.filter((e) => e.sets > 0);
}
function normalOlympic(config, phase, day) {
  const p = { F: 0, B: 1, R: 2 }[phase],
    effort = phase === 'F' ? 7 : 8,
    row = [];
  if (day === 'monday') {
    row.push(
      oly(
        'snatch',
        [6, 6, 5][p],
        [2, 2, 1][p],
        [
          [65, 75],
          [70, 80],
          [78, 85],
        ][p],
        'snatch',
        effort,
      ),
    );
    row.push(
      oly(
        'cj',
        3,
        '1+1',
        [
          [60, 70],
          [65, 75],
          [70, 78],
        ][p],
        'cj',
        effort,
      ),
    );
  }
  if (day === 'tuesday') {
    row.push(
      oly(
        'cj',
        [6, 6, 5][p],
        '1+1',
        [
          [65, 75],
          [72, 82],
          [78, 85],
        ][p],
        'cj',
        effort,
      ),
    );
    row.push(
      oly(
        'hang',
        3,
        [2, 2, 1][p],
        [
          [55, 65],
          [60, 70],
          [65, 75],
        ][p],
        'snatch',
        effort,
        120,
      ),
    );
  }
  if (day === 'thursday') {
    row.push(
      oly(
        'snatch',
        [6, 5, 4][p],
        1,
        [
          [70, 80],
          [75, 85],
          [75, 82],
        ][p],
        'snatch',
        effort,
      ),
    );
    if (config.anchors.jerk)
      row.push(
        oly(
          'jerk',
          [3, 4, 3][p],
          [2, 1, 1][p],
          [
            [75, 85],
            [85, 95],
            [90, 100],
          ][p],
          'jerk',
          effort,
          150,
          { workingLoad: config.rackLoad || null },
        ),
      );
    else
      row.push(
        oly('jerk', 3, 2, [50, 70], 'cj', 6, 150, {
          note:
            EX.jerk[2] +
            ' RJ unassessed: secure light practice only; this uses CJ, not an assumed jerk max.',
        }),
      );
    if (p < 2 && !config.omitPull)
      row.push(
        oly(
          'pull',
          2,
          3,
          [
            [90, 100],
            [95, 105],
          ][p],
          'snatch',
          7,
          150,
        ),
      );
  }
  if (day === 'friday') {
    ['snatch', 'cj'].forEach((id) =>
      row.push(
        oly(
          id,
          4,
          id === 'cj' ? '1+1' : 1,
          p === 0 ? [75, 85] : [80, 90],
          id,
          8,
          210,
          p === 0
            ? {}
            : {
                sequence:
                  p === 1
                    ? [
                        [80, 80],
                        [85, 85],
                        [88, 88],
                        [88, 90],
                      ]
                    : [
                        [80, 80],
                        [85, 85],
                        [88, 90],
                        [90, 90],
                      ],
              },
        ),
      ),
    );
  }
  // Earned heavy practice REPLACES attempts. Configuration records a reviewed dose.
  if (config.week !== 12)
    ['snatch', 'cj'].forEach((id) => {
      const ex = row.find((e) => e.id === id);
      if (!ex) return;
      const level = config.heavy?.[id] || 0,
        extra = config.heavy?.[id === 'snatch' ? 'extraSnatch' : 'extraCj'] || 0;
      if (level && day === 'friday') {
        ex.sequence = ex.sequence || Array.from({ length: ex.sets }, () => ex.range.slice());
        ex.sequence[ex.sets - 1] =
          phase === 'F'
            ? [85, Math.min(level, 90)]
            : [Math.min(level, phase === 'R' ? 95 : 92), Math.min(level, phase === 'R' ? 95 : 92)];
        ex.finalEffort = phase === 'F' ? 8 : 9;
      }
      if (extra && phase !== 'F') {
        const target = id === 'snatch' ? 'thursday' : 'tuesday';
        let count =
          day === target
            ? 1
            : day === 'friday' && extra >= 2
              ? 1
              : day === 'monday' && extra >= 3
                ? 1
                : 0;
        // Further reviewed replacements: remaining C/B, then A; keep one light A set.
        if (day === target) count += Math.min(Math.max(extra - 3, 0), ex.sets - 1);
        if (day === 'monday')
          count += Math.max(0, extra - 3 - ((id === 'snatch' ? [6, 5, 4][p] : [6, 6, 5][p]) - 1));
        count = Math.min(count, ex.sets - (day === 'monday' ? 1 : 0));
        if (count) {
          ex.rest = 180;
          ex.sequence = ex.sequence || Array.from({ length: ex.sets }, () => ex.range.slice());
          ex.repSequence = Array(ex.sets).fill(ex.reps);
          const end = day === 'friday' ? ex.sets - 1 : ex.sets;
          for (let i = Math.max(0, end - count); i < end; i++) {
            ex.sequence[i] = [90, 92];
            ex.repSequence[i] = id === 'cj' ? '1+1' : 1;
          }
        }
      }
    });
  if (config.reduceMondaySnatch && day === 'monday' && row[0]?.reps === 2)
    row[0].sets = Math.min(4, row[0].sets);
  if (config.reduceCJerk && day === 'thursday') {
    const jerk = row.find((e) => e.id === 'jerk');
    if (jerk) jerk.sets = Math.max(1, jerk.sets - 1);
  }
  // Assessment is an explicit replacement, available only in F/B including green checkpoints.
  if (['F', 'B'].includes(phase) && config.assessment === 'clean' && day === 'tuesday') {
    row[0] = oly('cj', 3, '1+1', [60, 70], 'cj', 7);
    row.splice(
      1,
      0,
      oly('clean', 3, 1, null, null, 8, 210, {
        assessment: true,
        note:
          EX.clean[2] +
          ' Start at a known secure clean, usually CJ or lower. Add 5–10 lb only after a secure single.',
      }),
    );
  }
  if (['F', 'B'].includes(phase) && config.assessment === 'jerk' && day === 'thursday') {
    const i = row.findIndex((e) => e.id === 'jerk'),
      reps = row[i].sets * Number(row[i].reps);
    row[i] = oly('jerk', Math.min(5, reps), 1, null, null, 8, 210, {
      assessment: true,
      warmup:
        'Replaces the ordinary rack-jerk ramp: light bar; 40%, 60%, 75% of intended first single ×3/2/1.',
      note: 'First single about 80% CJ or lower. Effort ≤6: add 10–20 lb; 7: add 5–10 lb; 8 or first error: stop, no retry. Heaviest valid single is RJ, not a 1RM.',
    });
  }
  if (
    ['F', 'B', 'R'].includes(phase) &&
    config.week !== 11 &&
    !config.reduceCJerk &&
    config.assessment !== 'jerk' &&
    [...(config.established || []), config.trial].some((t) => t?.kind === 'pause_jerk') &&
    day === 'thursday'
  ) {
    const i = row.findIndex((e) => e.id === 'jerk');
    if (config.anchors.jerk) {
      row[i].sets -= 2;
      row.splice(
        i,
        0,
        oly('pause_jerk', 2, 1, [60, 75], 'jerk', 7, 180, { warmup: RAMPS.jerk, trial: true }),
      );
    } else
      row[i] = oly('pause_jerk', 3, 2, [40, 60], 'cj', 6, 150, {
        note:
          'Light technique regression, not the assessed-RJ assistance trial. ' + EX.pause_jerk[2],
        warmup: RAMPS.jerk,
      });
  }
  const entry = config.onboarding && config.cycle === 1 && config.entryStage === 1;
  if (entry)
    row.forEach((e) => {
      e.sets = Math.ceil((e.sets * 2) / 3);
      if (e.range) e.range = [e.range[0], e.range[0]];
      if (e.sequence) e.sequence = e.sequence.slice(0, e.sets).map((r) => [r[0], r[0]]);
    });
  row.forEach((e) => {
    if (e.sequence) e.sequence = e.sequence.slice(0, e.sets);
    if (e.repSequence) e.repSequence = e.repSequence.slice(0, e.sets);
  });
  return row.filter((e) => e.sets > 0);
}
function session(id, title, rows, kind = 'lifting', note = '') {
  return {
    id,
    title,
    kind,
    rows,
    note,
    warmup: kind === 'lifting' ? WARMUP : kind === 'field' ? RAMPS.field : '',
    totalMin: estimate(rows, kind),
  };
}
function estimate(rows, kind) {
  if (!rows.length) return 0;
  if (kind === 'cardio') return rows.reduce((n, e) => n + (e.minutes || 0), 0);
  const seconds = rows.reduce(
    (n, e) =>
      n +
      e.sets * ((e.kind === 'failure' ? Number(e.repRange[1]) * 3 : 30) + e.rest) +
      (e.warmup ? 150 : 45),
    0,
  );
  return Math.ceil((seconds / 60 + (kind === 'lifting' ? 10 : 8)) / 5) * 5;
}
function athleticDose(stage = 0) {
  const d = { jumpSets: 2, runs: 3, meters: 10, effort: '85–90%' };
  for (let i = 1; i <= clamp(stage, 0, 50); i++) {
    if (i === 1) d.jumpSets = 3;
    else if (i === 2) d.meters = 15;
    else if (i === 3) d.effort = '90–95%';
    else if (i % 2 === 0) d.jumpSets++;
    else if (d.meters < 20) d.meters = 20;
    else d.runs++;
  }
  return d;
}
function dayPlan(config, day, context = {}) {
  const c = {
    ...defaults(),
    ...copy(config),
    anchors: { ...defaults().anchors, ...config.anchors },
  };
  const info = weekInfo(c.week),
    { week } = info;
  let phase = info.phase;
  if (phase === 'B' && c.phaseGate === 'F') phase = 'F';
  if (phase === 'R' && c.phaseGate !== 'R') phase = c.phaseGate === 'B' ? 'B' : 'F';
  const plan = {
    day,
    week,
    cycle: c.cycle,
    phase,
    info,
    sessions: [],
    notes: [],
    title:
      {
        monday: 'A · Snatch practice',
        tuesday: 'B · Clean & jerk + failure work',
        thursday: 'C · Snatch + rack jerk',
        friday: 'D · Both lifts + failure work',
      }[day] || 'Recovery',
  };
  let ol = [],
    conv = [];
  if (week === 12) {
    plan.title =
      {
        monday: 'Taper · both lifts + low-rep bench',
        tuesday: 'Taper · both lifts',
        thursday: 'Easy technical practice',
        friday: 'Mock meet · snatch + clean & jerk',
        saturday: 'Moderate-rep bench',
      }[day] || 'Rest';
    const taper = { monday: [3, 75, 80, 7], tuesday: [2, 80, 85, 8], thursday: [2, 50, 60, 6] }[
      day
    ];
    if (taper) {
      const [n, l, h, e] = taper;
      ol = [oly('snatch', n, 1, [l, h], 'snatch', e), oly('cj', n, '1+1', [l, h], 'cj', e)];
    }
    if (day === 'monday' || day === 'saturday')
      conv = [
        failure('bench', 1, ...(day === 'monday' ? [3, 5] : [6, 8]), 240, {
          key: day === 'monday' ? 'bench_low' : 'bench_moderate',
        }),
      ];
    if (day === 'friday') {
      const technical = c.phaseGate !== 'R';
      ol = ['snatch', 'cj'].map((id) =>
        oly(
          id,
          3,
          id === 'snatch' ? 1 : '1+1',
          technical ? [75, 85] : [88, 92],
          id,
          technical ? 8 : 10,
          270,
          {
            test: true,
            technicalBenchmark: technical,
            note: technical
              ? 'Technical benchmark ≤85%; phase gate not met.'
              : 'Three scored attempts; misses count. Open 88–92%, then 97–100% if easy, then smallest PR if secure. Bad 80–85% warm-ups: use ≤85% technical benchmark. Rest 8–10 min between lifts, then ramp CJ.',
          },
        ),
      );
    }
    if (day === 'saturday')
      plan.notes.push(
        'Bench follows the Olympic test. If testing moved, defer bench until after it; preserve ≥48 actual hours before the next bench. Larger/unfamiliar alcohol event: move bench after the event, on a ready day.',
      );
  } else if (week === 13) {
    if (['monday', 'thursday'].includes(day))
      ol = [
        oly('snatch', 4, 1, [60, 70], 'snatch', 6, 120),
        oly('cj', 3, '1+1', [60, 70], 'cj', 6, 120),
      ];
    if (['tuesday', 'friday'].includes(day))
      conv = conventional(c, 'P', day, context.pivotResidual);
  } else {
    ol = normalOlympic(c, phase, day);
    if (['tuesday', 'friday'].includes(day))
      conv = conventional(c, phase, day, week === 11 && day === 'friday');
  }
  if (ol.length || conv.length) {
    if (c.split && conv.some((e) => e.id === 'row')) {
      const split = conv.findIndex((e) => e.id === 'row');
      plan.sessions.push(
        session('main', 'Visit 1 · priority lifts & muscles', [...ol, ...conv.slice(0, split)]),
      );
      plan.sessions.push(
        session(
          'accessories',
          'Visit 2 · remaining accessories',
          conv.slice(split),
          'lifting',
          'At least 3 h after visit 1. Re-warm 3–5 min and use local ramps.',
        ),
      );
      plan.sessions[1].warmup =
        '3–5 min easy movement, then local exercise warm-ups. No failure in preparation.';
    } else plan.sessions.push(session('main', plan.title, [...ol, ...conv]));
  }
  const a = c.athletics || {};
  if (
    a.enabled &&
    week !== 12 &&
    (day === (week === 11 ? 'monday' : a.day || 'monday') ||
      (week !== 11 && a.secondary && day === 'thursday' && a.day !== 'thursday'))
  ) {
    const secondary = week !== 11 && day === 'thursday' && a.day !== 'thursday';
    if (!(week === 11 && secondary)) {
      let d = secondary
        ? { jumpSets: 2, runs: a.secondary >= 2 ? 2 : 0, meters: 10, effort: '85–90%' }
        : athleticDose(a.stage);
      if (week === 11)
        d = { ...d, jumpSets: Math.ceil(d.jumpSets / 2), runs: Math.ceil(d.runs / 2) };
      const rows = [
        {
          id: 'jump',
          key: 'jump',
          name: EX.jump[0],
          kind: 'speed',
          sets: d.jumpSets,
          reps: 3,
          rest: 120,
          note: EX.jump[2],
        },
      ];
      if (d.runs)
        rows.push({
          id: 'sprint',
          key: 'sprint',
          name: EX.sprint[0],
          kind: 'speed',
          sets: d.runs,
          reps: `${d.meters} m`,
          effort: d.effort,
          rest: 180,
          note: EX.sprint[2],
        });
      if (!secondary && week !== 11 && a.variation !== 'none' && d.runs >= 4 && d.meters === 20) {
        rows[1].sets -= 2;
        const id = a.variation === 'fly' ? 'fly' : 'cut';
        rows.push({
          id,
          key: id,
          name: EX[id][0],
          kind: 'speed',
          sets: 2,
          reps: id === 'fly' ? '10 m' : '1/side',
          effort: `${a.variationEffort || (id === 'fly' ? 90 : 80)}%`,
          rest: id === 'fly' ? 240 : 120,
          note: EX[id][2],
        });
      }
      plan.sessions.push(
        session(
          'field',
          secondary ? 'Secondary athletic exposure' : 'Jumps & accelerations',
          rows,
          'field',
          'After priority lifting, preferably ≥3 h later. If one visit: 5-min transition before the running warm-up.',
        ),
      );
    }
  }
  if (c.cardio?.enabled && week !== 12 && ['wednesday', 'saturday'].includes(day)) {
    const total = Math.max(40, Number(c.cardio.minutes) || 40),
      first = Math.ceil(total / 10) * 5,
      minutes = day === 'wednesday' ? first : total - first;
    plan.sessions.push(
      session(
        'cardio',
        'Easy aerobic work',
        [
          {
            id: 'aerobic',
            key: 'aerobic',
            name: EX.aerobic[0],
            kind: 'aerobic',
            minutes,
            reps: `${minutes} min`,
            note: EX.aerobic[2],
          },
        ],
        'cardio',
      ),
    );
  }
  if (
    c.mobility?.length &&
    ['wednesday', 'saturday', 'sunday', ...(c.mobilityDays === 4 ? ['monday'] : [])].includes(day)
  ) {
    plan.mobility = c.mobility
      .slice(0, 2)
      .map(
        (name) =>
          `${name}: 2 × ${c.mobilitySeconds || 30} s/side, 15 s rest, then 5 active reps. Mild–moderate tension, no failure.`,
      );
  }
  if (info.checkpoint)
    plan.notes.push(
      'Green checkpoint: repeat the preceding successful dose. No additions; load corrections and eligible component assessments are exceptions.',
    );
  if (phase !== info.phase)
    plan.notes.push(
      `Phase gate held: use ${phase === 'F' ? 'Foundation' : 'Build'} prescriptions until its exit criteria are met.`,
    );
  if (c.cutting)
    plan.notes.push(
      'Cutting: retain the current plan initially. Reduce set count only when recovery calls for it; failure endpoints stay the same.',
    );
  return applyReadiness(plan, context, c.recovery);
}
function applyReadiness(plan, context = {}, recovery = 'normal') {
  const p = copy(plan),
    level = context.readiness || 'green';
  if (context.event === 'verification')
    p.sessions
      .filter((s) => s.kind === 'field')
      .forEach((s) => {
        s.skipped = true;
        s.skipReason =
          'Verification return: defer optional athletic work until the next normal exposure.';
      });
  const red = level === 'red' || context.event === 'unsafe',
    defer = context.event === 'game';
  if (red || defer) {
    p.sessions.forEach((s) => {
      s.skipped = true;
      s.skipReason = red
        ? 'No loaded, explosive, failure or conditioning work.'
        : 'Demanding game: defer the affected whole session to a ready day; do not double up.';
    });
    p.notes.push(
      red
        ? 'Red readiness: stop training. Do not use warm-ups to test sobriety.'
        : 'Keep the A–B–rest–C–D sequence when rolling whole sessions; no missed-volume debt.',
    );
    return p;
  }
  const amber = level === 'amber',
    verify = context.event === 'verification';
  if (amber)
    p.notes.push(
      'Amber: rest 3 min, use 5–10% less Olympic load and floor(⅔ sets), effort ≤7. Omit all failure work; rescue bench on a ready day. If reduced work is still poor, ≤4 easy singles at 50–60% within remaining attempts, or stop.',
    );
  if (recovery !== 'normal')
    p.notes.push(
      recovery === 'reset'
        ? 'Full reset: half Olympic sets at 50–65%, effort ≤6; no pulls/squats/accessories. Bench only if locally ready.'
        : 'Targeted reduction: half Olympic sets at low range, no pulls; one squat/bench set if locally ready. Incline/laterals at most 2; other accessory rows at most 1.',
    );
  p.sessions.forEach((s) => {
    if ((amber || recovery !== 'normal') && s.kind !== 'lifting') {
      s.skipped = true;
      s.skipReason = 'Omitted during recovery reduction.';
      return;
    }
    s.rows = s.rows
      .filter((e) => {
        if (amber && e.kind === 'failure') return false;
        if (recovery === 'reset' && (e.id === 'pull' || (e.kind === 'failure' && e.id !== 'bench')))
          return false;
        if (recovery === 'targeted' && e.id === 'pull') return false;
        if (
          context.localIssue === 'upper' &&
          [
            'snatch',
            'cj',
            'hang',
            'jerk',
            'pause_jerk',
            'clean',
            'bench',
            'incline',
            'lateral',
            'row',
            'pulldown',
            'shrug',
            'rear_delt',
            'curl',
            'triceps',
            'press',
          ].includes(e.id)
        )
          return false;
        if (
          context.localIssue === 'lower' &&
          [
            'snatch',
            'cj',
            'hang',
            'jerk',
            'pause_jerk',
            'clean',
            'pull',
            'front_squat',
            'back_squat',
            'leg_curl',
            'calf',
            'leg_ext',
            'sprint',
            'jump',
            'fly',
            'cut',
          ].includes(e.id)
        )
          return false;
        return true;
      })
      .map((e) => {
        if (e.kind === 'quality' && (amber || recovery !== 'normal')) {
          e.sets = Math.max(1, amber ? Math.floor((e.sets * 2) / 3) : Math.ceil(e.sets / 2));
          e.sequence = null;
          e.repSequence = null;
          e.finalEffort = null;
          e.test = false;
          e.assessment = false;
          if (amber && e.id === 'pull') e.effort = 7;
          e.effort = recovery === 'reset' ? 6 : Math.min(7, e.effort);
          if (recovery === 'reset') {
            e.range = [50, 65];
            if (!e.anchor) e.anchor = e.id === 'clean' ? 'cj' : e.id === 'jerk' ? 'cj' : 'snatch';
            e.workingLoad = null;
          } else if (e.range) {
            e.range = amber
              ? e.range.map((v) => Math.round(v * 0.925 * 10) / 10)
              : [e.range[0], e.range[0]];
          }
          if (amber && e.workingLoad) e.workingLoad *= 0.925;
          if (!e.range && !e.workingLoad) {
            e.range = [50, 60];
            e.anchor = 'cj';
          }
        }
        if (e.kind === 'quality' && verify) {
          if (e.range) e.range = [e.range[0], e.range[0]];
          e.sequence = null;
          e.finalEffort = null;
          e.test = false;
          e.assessment = false;
        }
        if (e.kind === 'failure' && (verify || context.localIssue)) e.sets = 1;
        if (e.kind === 'failure' && recovery === 'targeted')
          e.sets = Math.min(e.sets, ['incline', 'lateral'].includes(e.id) ? 2 : 1);
        return e;
      });
    if (!s.rows.length) {
      s.skipped = true;
      s.skipReason = 'No eligible work under today’s readiness.';
    }
    s.totalMin = estimate(s.rows, s.kind);
  });
  if (verify)
    p.notes.push(
      'Verification return: confirmed sober and recovered; low-end Olympic work, no PRs, at most 1 failure set per already prescribed row. No athletic progression.',
    );
  if (context.localIssue)
    p.notes.push(
      'Isolated issue: affected work omitted; unaffected failure rows limited to one set only if their warm-ups are normal.',
    );
  return p;
}
function loadRange(ex, anchors, index = 0, increment = 2.5) {
  if (ex.test && !ex.technicalBenchmark && index > 0) return null;
  if (ex.workingLoad) return [ex.workingLoad, ex.workingLoad];
  const range = ex.sequence?.[index] || ex.range;
  const anchor = anchors[ex.anchor];
  if (!range || !anchor) return null;
  return range.map((p) => Math.floor(((anchor * p) / 100 + 1e-8) / increment) * increment);
}
function nextLoad(ex, exposures) {
  const history = exposures.filter((x) => x.rows?.length),
    last = history.at(-1);
  if (!last)
    return {
      action: 'choose',
      text: 'Choose a familiar conservative load; log actual failure reps.',
    };
  const rows = last.rows,
    valid = last.normal && rows.length === ex.sets && rows.every((r) => r.endpoint === 'failure');
  const weight = Number(rows.at(-1).weight),
    min = ex.repRange[0],
    max = ex.repRange[1];
  if (!valid)
    return {
      action: 'hold',
      weight,
      text: 'Hold or reassess: prior exposure was incomplete, TECH, or pain-limited.',
    };
  if (rows.some((r) => r.reps < min))
    return { action: 'reduce', weight: weight * 0.925, text: 'Below range: reduce about 5–10%.' };
  const allTop = rows.every((r) => r.reps >= max),
    same = rows.every((r) => Number(r.weight) === weight);
  const special = ['front_squat', 'back_squat'].includes(ex.id) || ex.key === 'bench_low';
  if (special && rows.every((r) => r.reps > max))
    return {
      action: 'increase',
      weight: weight + 2.5,
      text: 'Above the rep window: +2.5–5 lb next eligible exposure, if recovery stayed normal.',
    };
  const two = ex.sets === 1 || special,
    prev = history.at(-2);
  const repeat =
    prev &&
    prev.normal &&
    prev.rows.length === ex.sets &&
    prev.rows.every(
      (r) => r.endpoint === 'failure' && r.reps >= max && Number(r.weight) === weight,
    );
  if (allTop && same && (!two || repeat))
    return {
      action: 'increase',
      weight: special ? weight + 2.5 : weight,
      text: special
        ? '+2.5–5 lb if subsequent recovery was normal.'
        : 'Add the smallest available increment if subsequent recovery was normal.',
    };
  return {
    action: 'hold',
    weight,
    text:
      allTop && two
        ? 'Upper bound once: repeat successfully before adding load.'
        : 'Keep the load while valid reps build inside the range.',
  };
}
function benchWindow(records, at = Date.now()) {
  const times = records
    .flatMap((r) =>
      (r.sets || [])
        .filter((s) => s.exerciseId === 'bench')
        .map((s) => s.at || r.endedAt || r.startedAt),
    )
    .filter(Number.isFinite);
  const last = Math.max(0, ...times.filter((t) => t <= at));
  return {
    last,
    eligibleAt: last ? last + 48 * 3600000 : 0,
    ready: !last || at - last >= 48 * 3600000,
  };
}
const PROGRAM = {
  revision: 6,
  days: DAYS,
  exercises: EX,
  accessories: ACCESSORIES,
  warmup: WARMUP,
  ramps: RAMPS,
  defaults,
  weekInfo,
  dayPlan,
  loadRange,
  nextLoad,
  benchWindow,
  athleticDose,
  failure,
  session,
};
if (typeof module !== 'undefined') module.exports = { PROGRAM, EX };
