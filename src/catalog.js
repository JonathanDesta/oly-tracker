// Source-verified exercise descriptions, doses and preparation: PDF pages 2, 8–14, 21.
export const EXERCISES = {
  mobility: [
    "Targeted mobility",
    "mobility",
    "Mild-to-moderate tension, never pain. Finish with five slow active reps and recheck the position.",
  ],
  snatch: [
    "Full snatch from floor",
    "quality",
    "Full receive; secure overhead; stand every rep. Reset doubles 10–20 s on the floor.",
  ],
  cj: [
    "Full clean & jerk",
    "quality",
    "One full clean + one jerk per pair. Secure receive, stable fixation and recovery; no press-out.",
  ],
  hang: [
    "Above-knee hang full snatch",
    "quality",
    "Pause 1 s above the knee. Full receive; stand every rep.",
  ],
  jerk: [
    "Rack jerk",
    "quality",
    "Vertical dip, secure fixation and recovery. Reset doubles 10–20 s; use two singles 30 s apart if reracking is awkward.",
  ],
  pull: [
    "Explosive snatch pull",
    "quality",
    "Position rehearsal, not failure work. Stop if speed or positions deteriorate.",
  ],
  clean: [
    "Full clean assessment",
    "quality",
    "Technical reference, not a max. Stop at effort 8 or the first technical error; no retry.",
  ],
  front_squat: [
    "Front squat",
    "failure",
    "Full comfortable depth. Verify rack safeties just below the bottom with a light bar; stop at the last valid rep when another cannot be completed with the same form. No collapsed rep.",
  ],
  back_squat: [
    "High-bar back squat",
    "failure",
    "Same high-bar setup and depth each time. Verify rack safeties just below the bottom with a light bar; strict-form 0 RIR, no collapsed rep.",
  ],
  bench: [
    "Flat barbell bench press",
    "failure",
    "Thumb-around grip, feet and upper back stable; brief chest pause, no bounce. Test safeties with the empty bar and use a competent spotter, especially for low reps. Last valid rep at strict-form 0 RIR; no forced reps.",
  ],
  incline: [
    "Incline machine press · 30–45°",
    "failure",
    "Comfortable angle, stable deep range. Controlled attempt at the safe stop; no forced reps.",
  ],
  lateral: [
    "Cable lateral raise",
    "failure",
    "Slightly forward arm plane, about shoulder height; no torso swing or shortened-ROM finishers. DB is an equivalent menu option.",
  ],
  row: [
    "Chest-supported row",
    "failure",
    "Chest stays on support; full comfortable reach, no trunk heave.",
  ],
  pulldown: [
    "Lat pulldown",
    "failure",
    "Controlled overhead reach; pull to upper chest without swing.",
  ],
  shrug: [
    "Supported machine or DB shrug",
    "failure",
    "Full comfortable elevation and controlled lowering. Straps allowed; no neck circles.",
  ],
  rear_delt: [
    "Reverse pec deck",
    "failure",
    "Stable torso and comfortable rear-delt range; no lumbar extension.",
  ],
  curl: [
    "Cable curl · arms beside torso",
    "failure",
    "Supinated grip, neutral shoulders; full comfortable elbow range, no torso assist.",
  ],
  triceps: [
    "Overhead cable triceps extension",
    "failure",
    "Upper arms comfortably overhead and stable; controlled deep elbow bend. Pressdown only for actual overhead intolerance.",
  ],
  leg_curl: [
    "Seated leg curl",
    "failure",
    "Hip flexed, pelvis secured; full comfortable knee range, no hip lifting.",
  ],
  calf: [
    "Standing calf raise",
    "failure",
    "Knees extended; 2 s down, 1 s bottom pause, full rise; no bouncing. Supported knee-extended calf press is the fallback.",
  ],
  leg_ext: [
    "Supported reclined leg extension",
    "failure",
    "Prefer about 40° anatomical hip flexion (interior torso–thigh angle about 140°). Back/pelvis supported, knee aligned. Use upright seated extension if the machine cannot support this securely; do not arch the spine.",
  ],
  crunch: [
    "Machine abdominal crunch",
    "failure",
    "Controlled trunk flexion; supported machine with a safe stop, no hip pulling or neck strain.",
  ],
  press: [
    "Supported seated overhead press",
    "failure",
    "Machine or supported DB. A monitored fixation-strength trial; replaces one incline set.",
  ],
  pause_jerk: [
    "Pause-dip jerk",
    "quality",
    "Pause 1 s in the dip. Assistance trial replaces the first two C jerk sets; effort ≤7.",
  ],
  jump: [
    "Countermovement jump",
    "speed",
    "Maximal intent, controlled landing. Reset 10 s between reps; stop for falling height or altered landing.",
  ],
  sprint: [
    "Standing-start acceleration",
    "speed",
    "Smooth acceleration, full recovery. Stop for pain, altered gait, or two comparable runs >3% slower with reliable timing.",
  ],
  fly: [
    "Flying 10 m · 20 m run-in",
    "speed",
    "Smooth 20 m build, then a timed 10 m fly. Full 3–4 min rest.",
  ],
  cut: [
    "45° cut · 5 m in / 5 m out",
    "speed",
    "One cut per side per set. 20–30 s between sides, 2 min between sets.",
  ],
  aerobic: [
    "Easy cycle or brisk walk",
    "aerobic",
    "RPE 3–4/10; full-sentence talk test. Actual moving minutes only.",
  ],
};
export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
export const ACCESSORIES = [
  ["incline", 3, 6, 10, 210],
  ["lateral", 4, 12, 20, 150],
  ["row", 2, 8, 12, 180],
  ["pulldown", 1, 8, 12, 180],
  ["shrug", 1, 10, 15, 150],
  ["rear_delt", 1, 12, 20, 150],
  ["curl", 1, 8, 12, 150],
  ["triceps", 1, 10, 15, 150],
  ["leg_curl", 2, 8, 12, 150],
  ["calf", 2, 10, 15, 150],
  ["leg_ext", 1, 10, 15, 150],
  ["crunch", 1, 10, 15, 150],
];
export const WARMUP =
  "4–6 min easy cycle/walk (RPE 2–3). Ankle rocks 8/side; bodyweight squat 6; reverse lunge 4/side; thoracic rotation 5/side; wrist circles 10 each direction; wall slide 8; light band external rotation 10/side. All warm-ups submaximal. If idle >15 min: 2 min easy movement and two brief ascending rehearsals. Before catches: three secure light overhead-squat, front-squat and split-catch rehearsals, pain-free; safe release instruction before challenging catches. Use a technique bar if the standard bar distorts positions.";
export const RAMPS = {
  snatch:
    "Light bar: snatch RDL 5, muscle snatch 3, overhead squat 3 (2 s pause), high-hang snatch 3. Then 40% SN ×3, 50% ×2, 60% ×1; add 70% ×1 for work ≥75%, 80% ×1 for work ≥85%. Skip stages at/above work weight. Early rests 45–90 s; late rests 120 s.",
  cj: "Light bar: clean RDL 5, tall clean 3, front squat 3, dip 3, footwork 3, light jerk 3. Then 40% CJ ×2 cleans + 2 jerks, 50% ×1+1, 60% ×1+1; add 70% ×1+1 for work ≥75%, 80% ×1+1 for work ≥85%. Skip stages at/above work weight. Early rests 60–120 s; late rests 120–180 s.",
  jerk: "Light rack hold 10 s, dip 3, footwork 3. Then 40% of intended work weight ×3, 60% ×2, 80% ×1. Skip stages at/above work. Early rests 60–120 s; late rests 120–180 s. Assessment uses its replacement ramp.",
  squat:
    "Empty bar ×5; 40% of work weight ×5, 60% ×3, 80% ×1, optional 90% ×1. Early rests 60–120 s; rest 180 s before work.",
  bench:
    "Empty bar ×10; 40% of work weight ×6, 60% ×3, 80% ×1; 90% ×1 on the low-rep day. Early rests 60–120 s; rest 180 s before work.",
  incline: "40% of work weight ×8, 65% ×4; rest 60–90 s. No failure warm-ups.",
  field:
    "4–5 min easy walk/jog, RPE 2–3. Ankle rocks and leg swings 8/side; marching 2×10 m; 3×20 m runs at 50%, 65%, 80%. Walk back; rest 90 s before work. Stop for altered gait, painful stiffness or unusual heaviness.",
};
