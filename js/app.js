'use strict';

// ─── Exercise slot cache (populated during render, used by modal) ─────────────
const EX_CACHE = {};

// ─── State ────────────────────────────────────────────────────────────────────
const STATE = {
  view: 'home',
  maxes: { snatch: null, cj: null, bs: null, fs: null, pp: null, bench: null },
  program: { blockId: 0, weekInBlock: 0 }, // start on Week 0 Testing; weekInBlock is 0-indexed
  log: {},           // { 'YYYY-MM-DD': { dayKey, sections: [...], sessionMin } }
  hypertrophyWeights: {}, // { exerciseId: { weight, sets } } last logged weights
  restTimer: { active: false, end: 0, prescribed: 0, interval: null },
  sessionTimer: { active: false, start: 0, interval: null },
  intervalTimer: {
    active: false, config: null, phases: [], phaseIdx: 0,
    phaseEnd: 0, paused: false, pauseRemaining: 0,
    interval: null, lastCue: -1, startedAt: 0,
  },
  activeWorkout: null, // { date, dayKey, sectionIdx, exerciseIdx, sets: [] }
  wakeLock: null,
};

// ─── Persistence ──────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('oly_state', JSON.stringify({
    maxes: STATE.maxes,
    program: STATE.program,
    log: STATE.log,
    hypertrophyWeights: STATE.hypertrophyWeights,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem('oly_state');
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.assign(STATE.maxes, data.maxes || {});
    Object.assign(STATE.program, data.program || {});
    STATE.log = data.log || {};
    STATE.hypertrophyWeights = data.hypertrophyWeights || {};
  } catch (e) { console.warn('Load error', e); }
}

// ─── Audio ────────────────────────────────────────────────────────────────────
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function beep(freq = 880, dur = 0.4, vol = 0.6) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + dur);
}

function timerDoneSound() {
  // Three ascending beeps
  setTimeout(() => beep(660, 0.2, 0.5), 0);
  setTimeout(() => beep(770, 0.2, 0.6), 220);
  setTimeout(() => beep(880, 0.5, 0.8), 440);
}

function countdownTick() {
  // Short blip for the 3-2-1 countdown before a phase change
  beep(720, 0.12, 0.5);
}

function workStartSound() {
  // Urgent ascending triple — go hard
  setTimeout(() => beep(880, 0.15, 0.7), 0);
  setTimeout(() => beep(880, 0.15, 0.7), 180);
  setTimeout(() => beep(1320, 0.45, 0.85), 360);
  if (navigator.vibrate) navigator.vibrate([220, 90, 220, 90, 350]);
}

function restStartSound() {
  // Calm descending double — ease off
  setTimeout(() => beep(560, 0.22, 0.6), 0);
  setTimeout(() => beep(420, 0.4, 0.6), 240);
  if (navigator.vibrate) navigator.vibrate([180]);
}

function intervalDoneSound() {
  setTimeout(() => beep(660, 0.18, 0.6), 0);
  setTimeout(() => beep(880, 0.18, 0.7), 200);
  setTimeout(() => beep(1100, 0.18, 0.8), 400);
  setTimeout(() => beep(1320, 0.6, 0.9), 600);
  if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
}

// ─── Wake lock ────────────────────────────────────────────────────────────────
async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      STATE.wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {}
}

function releaseWakeLock() {
  if (STATE.wakeLock) { STATE.wakeLock.release(); STATE.wakeLock = null; }
}

// ─── Rest timer ───────────────────────────────────────────────────────────────
function startRestTimer(seconds) {
  clearRestTimer();
  STATE.restTimer.prescribed = seconds;
  STATE.restTimer.end = Date.now() + seconds * 1000;
  STATE.restTimer.active = true;
  renderTimerOverlay();
  STATE.restTimer.interval = setInterval(tickRestTimer, 250);
}

function tickRestTimer() {
  const rem = Math.ceil((STATE.restTimer.end - Date.now()) / 1000);
  if (rem <= 0) {
    clearRestTimer();
    timerDoneSound();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    renderTimerOverlay(true);
    return;
  }
  renderTimerOverlay();
}

function clearRestTimer() {
  clearInterval(STATE.restTimer.interval);
  STATE.restTimer.active = false;
  STATE.restTimer.interval = null;
}

function skipRestTimer() {
  clearRestTimer();
  document.getElementById('timer-overlay').classList.add('hidden');
}

function addRestTime(sec) {
  STATE.restTimer.end += sec * 1000;
}

// ─── Interval timer ───────────────────────────────────────────────────────────
// Builds a flat phase list from a config and runs it with audio/haptic cues at
// every transition. Timestamp-driven so it stays accurate across backgrounding.
function buildPhases(cfg) {
  const phases = [];
  if (cfg.warmupSec) phases.push({ type: 'warmup', sec: cfg.warmupSec, round: 0 });
  for (let r = 1; r <= cfg.rounds; r++) {
    phases.push({ type: 'work', sec: cfg.workSec, round: r });
    if (cfg.lastRest || r < cfg.rounds) {
      phases.push({ type: 'rest', sec: cfg.restSec, round: r });
    }
  }
  if (cfg.cooldownSec) phases.push({ type: 'cooldown', sec: cfg.cooldownSec, round: 0 });
  return phases;
}

function startIntervalTimer(cfg) {
  initAudio();
  const it = STATE.intervalTimer;
  clearInterval(it.interval);
  it.config = cfg;
  it.phases = buildPhases(cfg);
  it.phaseIdx = 0;
  it.paused = false;
  it.active = true;
  it.lastCue = -1;
  it.startedAt = Date.now();
  it.phaseEnd = Date.now() + it.phases[0].sec * 1000;
  // Opening cue depends on the first phase
  if (it.phases[0].type === 'work') workStartSound(); else restStartSound();
  renderIntervalOverlay();
  it.interval = setInterval(tickIntervalTimer, 200);
}

function tickIntervalTimer() {
  const it = STATE.intervalTimer;
  if (it.paused) return;
  const rem = Math.ceil((it.phaseEnd - Date.now()) / 1000);
  if (rem <= 0) { advanceIntervalPhase(); return; }
  // 3-2-1 countdown blips before each transition (once per second)
  if (rem <= 3 && rem >= 1 && it.lastCue !== rem) {
    it.lastCue = rem;
    countdownTick();
  }
  renderIntervalOverlay();
}

function advanceIntervalPhase() {
  const it = STATE.intervalTimer;
  it.phaseIdx++;
  it.lastCue = -1;
  if (it.phaseIdx >= it.phases.length) { finishIntervalTimer(); return; }
  const phase = it.phases[it.phaseIdx];
  it.phaseEnd = Date.now() + phase.sec * 1000;
  if (phase.type === 'work') workStartSound();
  else restStartSound();
  renderIntervalOverlay();
}

function finishIntervalTimer() {
  const it = STATE.intervalTimer;
  clearInterval(it.interval);
  it.interval = null;
  it.active = false;
  intervalDoneSound();
  renderIntervalOverlay(true);
}

function pauseIntervalTimer() {
  const it = STATE.intervalTimer;
  if (!it.active || it.paused) return;
  it.paused = true;
  it.pauseRemaining = Math.max(0, it.phaseEnd - Date.now());
  renderIntervalOverlay();
}

function resumeIntervalTimer() {
  const it = STATE.intervalTimer;
  if (!it.active || !it.paused) return;
  it.paused = false;
  it.phaseEnd = Date.now() + it.pauseRemaining;
  renderIntervalOverlay();
}

function skipIntervalPhase() {
  if (!STATE.intervalTimer.active) return;
  advanceIntervalPhase();
}

function stopIntervalTimer() {
  const it = STATE.intervalTimer;
  clearInterval(it.interval);
  it.interval = null;
  it.active = false;
  it.paused = false;
  document.getElementById('interval-overlay').classList.add('hidden');
}

// Re-sync after the tab was backgrounded (timers are throttled when hidden).
// Silently fast-forward through any phases that fully elapsed while away.
function catchUpIntervalTimer() {
  const it = STATE.intervalTimer;
  if (!it.active || it.paused) return;
  let guard = 0;
  while (it.active && Date.now() >= it.phaseEnd && guard++ < 1000) {
    it.phaseIdx++;
    if (it.phaseIdx >= it.phases.length) { finishIntervalTimer(); return; }
    it.phaseEnd += it.phases[it.phaseIdx].sec * 1000;
  }
  it.lastCue = -1;
  renderIntervalOverlay();
}

// ─── Session timer ────────────────────────────────────────────────────────────
function startSessionTimer() {
  clearInterval(STATE.sessionTimer.interval); // never leak a prior session's interval
  STATE.sessionTimer.start = Date.now();
  STATE.sessionTimer.active = true;
  STATE.sessionTimer.interval = setInterval(updateSessionTimerDisplay, 1000);
}

function stopSessionTimer() {
  clearInterval(STATE.sessionTimer.interval);
  STATE.sessionTimer.active = false;
}

function updateSessionTimerDisplay() {
  const el = document.getElementById('session-timer');
  if (!el) return;
  const sec = Math.floor((Date.now() - STATE.sessionTimer.start) / 1000);
  el.textContent = fmtTime(sec);
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function nav(view) {
  STATE.view = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  render();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
// Local-date formatting (avoid toISOString's UTC rollover near midnight).
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function today() {
  return fmtDate(new Date());
}

function todayDayKey() {
  return PROGRAM.dayKeys[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
}

// Date string for weekday index i (0=Mon … 6=Sun) of the current week.
function dateForWeekday(i) {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const d = new Date(now);
  d.setDate(now.getDate() + toMonday + i);
  return fmtDate(d);
}

// Best-guess timer length (seconds) for a steady cardio / mobility slot.
function durationSec(ex) {
  if (ex.timerSec) return ex.timerSec;
  if (ex.duration) {
    const m = ex.duration.match(/(\d+)/);
    if (m) return parseInt(m[1], 10) * 60; // first number, read as minutes
  }
  return ex.rest && ex.rest > 0 ? ex.rest : 60;
}

// One-line human summary of an interval config, e.g. "5 × 3:00 on / 3:00 off".
function intervalSummary(cfg) {
  const parts = [];
  if (cfg.warmupSec) parts.push(`${fmtTime(cfg.warmupSec)} warm-up`);
  parts.push(`${cfg.rounds} × ${fmtTime(cfg.workSec)} on / ${fmtTime(cfg.restSec)} off`);
  if (cfg.cooldownSec) parts.push(`${fmtTime(cfg.cooldownSec)} cool-down`);
  const totalSec = (cfg.warmupSec || 0) + (cfg.cooldownSec || 0) +
    cfg.rounds * cfg.workSec + (cfg.lastRest ? cfg.rounds : cfg.rounds - 1) * cfg.restSec;
  return `${parts.join(' · ')} — total ${fmtTime(totalSec)}`;
}

function fmtWeight(w) {
  if (w === null || w === undefined) return '—';
  return w % 1 === 0 ? `${w} lb` : `${w.toFixed(1)} lb`;
}

function hasMaxes() {
  return Object.values(STATE.maxes).some(v => v !== null && v > 0);
}

// Get prescribed weight for an exercise slot
function prescribedWeight(ex) {
  if (!ex.baseLift || ex.pct == null) return null;
  return PROGRAM.calcWeight(STATE.maxes, ex.baseLift, ex.pct);
}

// Get last weight used for a hypertrophy exercise
function lastWeight(exId) {
  return STATE.hypertrophyWeights[exId] || null;
}

// Should this hypertrophy exercise progress weight this session?
// Reads progressNext, which is computed at the END of the previous session and
// deliberately survives the between-session reset (unlike the live `sets` array).
function shouldProgress(exId) {
  const last = STATE.hypertrophyWeights[exId];
  return !!(last && last.progressNext);
}

// ─── Double progression logic ─────────────────────────────────────────────────
// During a session we just accumulate the reps performed at the working weight.
// repTop/setCount are stashed so progression can be evaluated at session end.
function recordHypertrophySet(exId, weight, reps, repRange, setCount) {
  const existing = STATE.hypertrophyWeights[exId] || { weight, sets: [], prevSets: [] };
  existing.weight = weight;
  existing.sets = existing.sets || [];
  existing.sets.push(reps);
  existing.repTop = repRange ? repRange[1] : null;
  existing.setCount = setCount;
  STATE.hypertrophyWeights[exId] = existing;
  save();
}

// Called once at session end. For every tracked exercise that was worked this
// session, decide whether to flag a weight increase next time (all of the last
// `setCount` sets reached the top of the rep range), snapshot the session's reps
// for the "Last:" display, then clear the live set tracker.
function finalizeHypertrophyProgression() {
  Object.values(STATE.hypertrophyWeights).forEach(d => {
    if (!d.sets || d.sets.length === 0) return; // not trained this session — leave as-is
    if (d.repTop && d.setCount && d.sets.length >= d.setCount) {
      d.progressNext = d.sets.slice(-d.setCount).every(r => r >= d.repTop);
    } else {
      d.progressNext = false;
    }
    d.prevSets = d.sets.slice();
    d.sets = [];
  });
}

// ─── Rendering helpers ────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

function sectionColorClass(color) {
  return { gold: 'sec-gold', blue: 'sec-blue', green: 'sec-green', red: 'sec-red' }[color] || 'sec-gold';
}

// ─── Render: Timer Overlay ────────────────────────────────────────────────────
function renderTimerOverlay(done = false) {
  const overlay = $('timer-overlay');
  if (!STATE.restTimer.active && !done) { overlay.classList.add('hidden'); return; }
  overlay.classList.remove('hidden');

  const rem = Math.max(0, Math.ceil((STATE.restTimer.end - Date.now()) / 1000));
  const pct = done ? 100 : ((STATE.restTimer.prescribed - rem) / STATE.restTimer.prescribed) * 100;
  const circumference = 2 * Math.PI * 54;
  const dash = (pct / 100) * circumference;

  overlay.innerHTML = `
    <div class="timer-card">
      <div class="timer-label">${done ? 'REST COMPLETE' : 'REST'}</div>
      <div class="timer-circle-wrap">
        <svg viewBox="0 0 120 120" class="timer-svg">
          <circle cx="60" cy="60" r="54" class="timer-track"/>
          <circle cx="60" cy="60" r="54" class="timer-progress"
            stroke-dasharray="${dash} ${circumference}"
            stroke-dashoffset="0"
            style="transform:rotate(-90deg);transform-origin:50% 50%"/>
        </svg>
        <div class="timer-num">${done ? '✓' : fmtTime(rem)}</div>
      </div>
      <div class="timer-prescribed">Prescribed: ${fmtTime(STATE.restTimer.prescribed)}</div>
      <div class="timer-actions">
        <button class="btn-outline" onclick="addRestTime(30)">+30s</button>
        <button class="btn-outline" onclick="addRestTime(60)">+1m</button>
        <button class="btn-primary" onclick="skipRestTimer()">Skip</button>
      </div>
    </div>`;
}

// ─── Render: Interval Timer Overlay ───────────────────────────────────────────
function renderIntervalOverlay(done = false) {
  const overlay = $('interval-overlay');
  const it = STATE.intervalTimer;
  if (!it.active && !done) { overlay.classList.add('hidden'); return; }
  overlay.classList.remove('hidden');

  const phase = it.phases[Math.min(it.phaseIdx, it.phases.length - 1)];
  const rem = done ? 0 : Math.max(0, it.paused ? Math.ceil(it.pauseRemaining / 1000)
                                                : Math.ceil((it.phaseEnd - Date.now()) / 1000));
  const pct = done ? 100 : phase ? ((phase.sec - rem) / phase.sec) * 100 : 0;
  const circumference = 2 * Math.PI * 54;
  const dash = (pct / 100) * circumference;

  const totalWork = it.config ? it.config.rounds : 0;
  const phaseClass = done ? 'ip-done' : `ip-${phase.type}`;
  const phaseLabel = done ? 'COMPLETE'
    : phase.type === 'work' ? 'WORK'
    : phase.type === 'rest' ? 'RECOVER'
    : phase.type === 'warmup' ? 'WARM-UP'
    : 'COOL-DOWN';

  // Total remaining across all phases
  let totalRem = 0;
  if (!done) {
    totalRem = rem;
    for (let i = it.phaseIdx + 1; i < it.phases.length; i++) totalRem += it.phases[i].sec;
  }

  const roundText = (phase && phase.round > 0)
    ? `Round ${phase.round} / ${totalWork}` : phaseLabel;

  overlay.innerHTML = `
    <div class="interval-card ${phaseClass}">
      <div class="ip-round">${done ? 'Session finished' : roundText}</div>
      <div class="ip-phase">${phaseLabel}</div>
      <div class="timer-circle-wrap">
        <svg viewBox="0 0 120 120" class="timer-svg">
          <circle cx="60" cy="60" r="54" class="timer-track"/>
          <circle cx="60" cy="60" r="54" class="ip-progress"
            stroke-dasharray="${dash} ${circumference}"
            style="transform:rotate(-90deg);transform-origin:50% 50%"/>
        </svg>
        <div class="timer-num">${done ? '✓' : fmtTime(rem)}</div>
      </div>
      <div class="ip-total">${done ? '' : `Total left: ${fmtTime(totalRem)}`}</div>
      <div class="ip-dots">
        ${it.phases.map((p, i) => p.type === 'work'
          ? `<span class="ip-dot ${i < it.phaseIdx ? 'ip-dot-done' : i === it.phaseIdx ? 'ip-dot-now' : ''}"></span>`
          : '').join('')}
      </div>
      <div class="timer-actions">
        ${done ? `
          <button class="btn-primary" onclick="stopIntervalTimer()">Done</button>
        ` : `
          <button class="btn-outline" onclick="skipIntervalPhase()">Skip</button>
          ${it.paused
            ? `<button class="btn-primary" onclick="resumeIntervalTimer()">Resume</button>`
            : `<button class="btn-primary" onclick="pauseIntervalTimer()">Pause</button>`}
          <button class="btn-outline" onclick="stopIntervalTimer()">Stop</button>
        `}
      </div>
    </div>`;
}

// ─── Render: Home ─────────────────────────────────────────────────────────────
function renderHome() {
  const app = $('app');
  const dayKey = todayDayKey();
  const dayName = PROGRAM.dayNames[PROGRAM.dayKeys.indexOf(dayKey)];
  const { blockId, weekInBlock } = STATE.program;
  const block = PROGRAM.blocks.find(b => b.id === blockId);
  const blockName = block ? block.name : 'Testing Week';
  const weekNum = block ? block.startWeek + weekInBlock : 0;
  const noMaxes = !hasMaxes();
  const isTestingBlock = blockId === 0;
  // Maxes are only required once you're running percentage-based blocks.
  const blockStartDisabled = noMaxes && !isTestingBlock;

  app.innerHTML = `
    <div class="page home-page">
      <div class="home-header">
        <div class="home-logo">🏋️</div>
        <div>
          <div class="home-title">Oly Tracker</div>
          <div class="home-sub">${blockName}</div>
        </div>
      </div>

      ${isTestingBlock ? `
        <div class="alert alert-warn">
          <b>Testing Week</b> — build to a 1RM on each lift and record it in the session. These become the maxes every percentage references.
        </div>`
      : noMaxes ? `
        <div class="alert alert-warn">
          <b>Set your maxes first</b> — run Week 0: Testing (switch in Settings) or enter them directly in Settings.
        </div>` : ''}

      <div class="today-card">
        <div class="today-label">TODAY</div>
        <div class="today-day">${dayName}</div>
        <div class="today-meta">${isTestingBlock ? 'Week 0 · Testing' : `Week ${weekNum} · ${blockName.split(':')[0]}`}</div>
        <button class="btn-primary btn-lg" onclick="startWorkout('${dayKey}')" ${blockStartDisabled ? 'disabled' : ''}>
          Start ${isTestingBlock ? 'Testing Session' : 'Workout'}
        </button>
      </div>

      <div class="week-grid">
        ${PROGRAM.dayKeys.map((d, i) => {
          const name = PROGRAM.dayNames[i];
          const isToday = d === dayKey;
          const cellDate = dateForWeekday(i);
          const logged = !!STATE.log[cellDate];
          return `<div class="week-cell ${isToday ? 'week-cell-today' : ''} ${logged ? 'week-cell-done' : ''}">
            <div class="week-cell-day">${name.slice(0,3)}</div>
            <div class="week-cell-dot">${logged ? '✓' : isToday ? '●' : '○'}</div>
          </div>`;
        }).join('')}
      </div>

      ${STATE.log[today()] ? `
        <div class="recent-card">
          <div class="recent-label">Today's session logged</div>
          <button class="btn-ghost" onclick="nav('history')">View history →</button>
        </div>` : ''}

      <div class="rules-card">
        <div class="rules-title">Non-Negotiable Rules</div>
        <ol class="rules-list">
          <li>Never attempt a lift you expect to miss. Stop the moment technique degrades.</li>
          <li>If you miss, drop 5% and retry once. If you miss again, that movement is done.</li>
          <li>Hypertrophy always after Olympic block. If time is short, cut hypertrophy — never the Oly block.</li>
          <li>On subpar days, back off 5–7% without guilt.</li>
        </ol>
      </div>
    </div>`;
}

// ─── Render: Workout ──────────────────────────────────────────────────────────
function startWorkout(dayKey) {
  initAudio();
  const { blockId, weekInBlock } = STATE.program;
  const day = PROGRAM.getDayWorkout(blockId, weekInBlock, dayKey);
  if (!day) { alert('No workout found for this day.'); return; }

  STATE.activeWorkout = {
    date: today(),
    dayKey,
    day,
    setsLogged: {}, // exerciseId → array of set objects
    complete: false,
  };

  acquireWakeLock();
  startSessionTimer();
  nav('workout');
}

function renderWorkout() {
  const app = $('app');
  if (!STATE.activeWorkout) {
    app.innerHTML = `<div class="page"><div class="empty-state">
      <p>No active workout.</p>
      <button class="btn-primary" onclick="nav('home')">Go Home</button>
    </div></div>`;
    return;
  }

  const { day, setsLogged } = STATE.activeWorkout;

  let body;
  if (day.isRest) {
    body = `
      <div class="rest-day">
        <div class="rest-day-icon">🛌</div>
        <div class="rest-day-title">${day.title}</div>
        ${day.note ? `<div class="rest-day-note">${day.note}</div>` : ''}
        <button class="btn-primary" style="margin-top:20px" onclick="endWorkout()">Done</button>
      </div>`;
  } else if (day.isTesting) {
    body = renderTestingDay(day);
  } else {
    body = `
      ${day.sections.map((sec, si) => renderSection(sec, si, setsLogged)).join('')}
      <div class="workout-footer">
        <button class="btn-danger" onclick="endWorkout()">Finish Workout</button>
      </div>`;
  }

  app.innerHTML = `
    <div class="page workout-page">
      <div class="workout-header">
        <button class="btn-ghost-sm" onclick="endWorkout()">✕ End</button>
        <div class="workout-title">${PROGRAM.dayNames[PROGRAM.dayKeys.indexOf(STATE.activeWorkout.dayKey)]}</div>
        <div class="session-timer-wrap">
          <span class="session-timer-label">SESSION</span>
          <span id="session-timer" class="session-timer">00:00</span>
        </div>
      </div>
      ${body}
    </div>`;

  // Restart the session timer display update
  updateSessionTimerDisplay();
}

// ─── Render: Testing Day ──────────────────────────────────────────────────────
function renderTestingDay(day) {
  return `
    <div class="section sec-gold">
      <div class="section-header">
        <span class="section-title">${day.title}</span>
        ${day.note ? `<span class="section-note">${day.note}</span>` : ''}
      </div>
      ${day.lifts.map(l => `
        <div class="ex-card">
          <div class="ex-header" style="cursor:default">
            <div class="ex-name-wrap"><span class="ex-name">${l.label}</span></div>
          </div>
          <div class="ex-body" style="border-top:1px solid var(--border)">
            ${l.cues && l.cues.length ? `<div class="cues">${l.cues.map(c => `<div class="cue">• ${c}</div>`).join('')}</div>` : ''}
            ${l.lift ? `
              <label class="form-label">Record your max (lbs)</label>
              <div class="max-row">
                <input type="number" id="test-${l.lift}" class="form-input" inputmode="decimal" step="2.5"
                  value="${STATE.maxes[l.lift] || ''}" placeholder="lbs"
                  onchange="updateMax('${l.lift}', this.value)">
                <span class="max-unit">lb</span>
              </div>
              <div class="settings-note">Saved automatically to your training maxes.</div>
            ` : ''}
          </div>
        </div>`).join('')}
    </div>
    <div class="workout-footer">
      <button class="btn-danger" onclick="endWorkout()">Finish Session</button>
    </div>`;
}

function renderSection(sec, si, setsLogged) {
  const colorCls = sectionColorClass(sec.color);
  return `
    <div class="section ${colorCls}">
      <div class="section-header">
        <span class="section-title">${sec.title}</span>
        ${sec.note ? `<span class="section-note">${sec.note}</span>` : ''}
      </div>
      ${sec.exercises.map((ex, ei) => renderExerciseCard(ex, si, ei, setsLogged)).join('')}
    </div>`;
}

function renderExerciseCard(ex, si, ei, setsLogged) {
  const exDef = PROGRAM.exercises[ex.id];
  if (!exDef) return '';

  const key = `${si}_${ex.id}`;
  const logged = setsLogged[key] || [];
  const isDailyMax = ex.isDailyMax;
  const isMaxEffort = ex.isMaxEffort;
  const isCardio = exDef.type === 'cardio';
  const isMobility = exDef.type === 'mobility';
  const isCore = exDef.type === 'core';
  const isJump = exDef.type === 'jump';
  const isHypertrophy = exDef.type === 'hypertrophy' || (ex.repRange && !ex.pct && !isDailyMax);

  // Store exercise slot in cache for modal lookup
  EX_CACHE[`${si}_${ei}`] = { si, exId: ex.id, ei, ex };

  // Prescribed weight
  const pw = prescribedWeight(ex);
  const pwDisplay = pw ? fmtWeight(pw) : null;

  // For hypertrophy: last weight + progression
  const lastW = isHypertrophy ? lastWeight(ex.id) : null;
  const progress = isHypertrophy && ex.repRange ? shouldProgress(ex.id) : false;

  // Rep display
  let repDisplay = '';
  if (ex.repRange) repDisplay = `${ex.repRange[0]}–${ex.repRange[1]} reps`;
  else if (ex.reps) repDisplay = `${ex.reps} reps`;
  else if (ex.duration) repDisplay = ex.duration;

  // Sets display
  let setsDisplay = ex.sets ? `${ex.sets} sets` : '';
  if (isDailyMax) setsDisplay = 'Build to daily max';
  if (isMaxEffort) setsDisplay = 'Work up (RPE 9)';

  // Rest display
  const restDisplay = ex.rest ? fmtTime(ex.rest) : '';

  const collapsed = logged.length > 0 && !isDailyMax && !isMaxEffort &&
    ex.sets && logged.length >= ex.sets;

  return `
    <div class="ex-card ${collapsed ? 'ex-done' : ''}" id="ex-${si}-${ei}">
      <div class="ex-header" onclick="toggleExCard(${si},${ei})">
        <div class="ex-name-wrap">
          <span class="ex-name">${exDef.name}</span>
          ${isDailyMax ? '<span class="badge badge-gold">DAILY MAX</span>' : ''}
          ${isMaxEffort ? '<span class="badge badge-gold">MAX EFFORT</span>' : ''}
          ${collapsed ? '<span class="badge badge-green">✓ Done</span>' : ''}
        </div>
        <div class="ex-meta">
          ${setsDisplay ? `<span>${setsDisplay}</span>` : ''}
          ${repDisplay ? `<span>${repDisplay}</span>` : ''}
          ${pwDisplay ? `<span class="ex-pct">${pwDisplay} (${ex.pct}%)</span>` : ''}
          ${restDisplay ? `<span class="ex-rest">Rest: ${restDisplay}</span>` : ''}
        </div>
        ${progress ? `<div class="progress-banner">⬆ INCREASE WEIGHT this session</div>` : ''}
        ${lastW && lastW.prevSets && lastW.prevSets.length ? `<div class="last-weight">Last: ${fmtWeight(lastW.weight)} × ${lastW.prevSets.join(', ')} reps</div>` : ''}
      </div>

      <div class="ex-body ${collapsed ? 'hidden' : ''}">
        ${exDef.notes ? `<div class="ex-notes">${exDef.notes}</div>` : ''}
        ${ex.note ? `<div class="ex-notes ex-notes-warn">⚠ ${ex.note}</div>` : ''}
        ${exDef.cues && exDef.cues.length ? `
          <div class="cues">
            ${exDef.cues.map(c => `<div class="cue">• ${c}</div>`).join('')}
          </div>` : ''}

        ${ex.interval ? `
          <button class="btn-log" onclick='startIntervalTimer(${JSON.stringify(ex.interval)})'>
            ▶ Start Interval Timer
          </button>
          <div class="interval-preview">${intervalSummary(ex.interval)}</div>
        ` : (isCardio || isMobility) ? `
          <button class="btn-outline btn-full" onclick="startRestTimer(${durationSec(ex)})">
            ⏱ Start Timer (${Math.round(durationSec(ex) / 60)} min)
          </button>` : ''}

        ${!isCardio && !isMobility ? `
          <div class="set-log" id="setlog-${si}-${ei}">
            ${logged.map((s, i) => renderLoggedSet(s, i)).join('')}
          </div>
          <button class="btn-log" onclick="openLogSet('${si}_${ei}')">
            + Log Set ${logged.length + 1}${isDailyMax || isMaxEffort ? '' : ex.sets ? ` / ${ex.sets}` : ''}
          </button>
          ${ex.rest ? `<button class="btn-timer" onclick="startRestTimer(${ex.rest})">⏱ Start Rest (${fmtTime(ex.rest)})</button>` : ''}
        ` : ''}
      </div>
    </div>`;
}

function renderLoggedSet(s, i) {
  return `<div class="logged-set">
    <span class="set-num">Set ${i + 1}</span>
    <span class="set-weight">${fmtWeight(s.weight)}</span>
    <span class="set-reps">${s.reps} reps</span>
    ${s.rir !== '' && s.rir !== undefined ? `<span class="set-rir">RIR ${s.rir}</span>` : ''}
    ${s.note ? `<span class="set-note">"${s.note}"</span>` : ''}
  </div>`;
}

function toggleExCard(si, ei) {
  const body = document.querySelector(`#ex-${si}-${ei} .ex-body`);
  if (body) body.classList.toggle('hidden');
}

// ─── Log Set Modal ────────────────────────────────────────────────────────────
function openLogSet(cacheKey) {
  initAudio();
  const cached = EX_CACHE[cacheKey];
  if (!cached) return;
  const { si, exId, ei, ex } = cached;
  const exDef = PROGRAM.exercises[exId];
  const pw = prescribedWeight(ex);
  const logKey = `${si}_${exId}`;
  const logged = STATE.activeWorkout?.setsLogged[logKey] || [];
  const lastW = lastWeight(exId);
  const suggestedWeight = pw || (lastW ? lastW.weight : '');

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'log-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">${exDef.name}</div>
      <div class="modal-sub">Set ${logged.length + 1}
        ${ex.sets ? ` of ${ex.sets}` : ''}
        ${pw ? ` · Prescribed: ${fmtWeight(pw)}${ex.pct ? ` (${ex.pct}%)` : ''}` : ''}
        ${lastW ? ` · Last: ${fmtWeight(lastW.weight)}` : ''}
      </div>

      <label class="form-label">Weight (lbs)</label>
      <input type="number" id="inp-weight" class="form-input" value="${suggestedWeight || ''}"
        inputmode="decimal" step="2.5" placeholder="lbs">

      <label class="form-label">Reps completed</label>
      <div class="rep-picker">
        ${[...Array(20)].map((_,i) => `<button class="rep-btn" onclick="pickRep(${i+1})">${i+1}</button>`).join('')}
      </div>
      <input type="number" id="inp-reps" class="form-input" inputmode="numeric" placeholder="or type reps">

      <label class="form-label">RIR (Reps in Reserve)</label>
      <div class="rir-picker">
        ${[0,1,2,3,4,5].map(r => `<button class="rir-btn" onclick="pickRIR(${r})">${r}</button>`).join('')}
      </div>
      <input type="hidden" id="inp-rir" value="">

      <label class="form-label">Notes (optional)</label>
      <input type="text" id="inp-note" class="form-input" placeholder="e.g. felt heavy, good speed...">

      <div class="modal-actions">
        <button class="btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="submitSet('${cacheKey}')">Save Set</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => $('inp-weight')?.focus(), 100);
}

function pickRep(n) {
  $('inp-reps').value = n;
  document.querySelectorAll('.rep-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === n));
}

function pickRIR(n) {
  $('inp-rir').value = n;
  document.querySelectorAll('.rir-btn').forEach(b => b.classList.toggle('active', parseInt(b.textContent) === n));
}

function closeModal() {
  const m = $('log-modal');
  if (m) m.remove();
}

function submitSet(cacheKey) {
  const cached = EX_CACHE[cacheKey];
  if (!cached) return;
  const { si, exId, ex } = cached;

  const weight = parseFloat($('inp-weight').value) || null;
  const reps = parseInt($('inp-reps').value) || null;
  const rir = $('inp-rir').value;
  const note = $('inp-note').value.trim();

  if (!reps) { alert('Enter reps completed.'); return; }

  const key = `${si}_${exId}`;
  if (!STATE.activeWorkout.setsLogged[key]) STATE.activeWorkout.setsLogged[key] = [];

  const setObj = { weight, reps, rir, note, ts: Date.now() };
  STATE.activeWorkout.setsLogged[key].push(setObj);

  // Track hypertrophy progression
  const exDef = PROGRAM.exercises[exId];
  if (exDef.type === 'hypertrophy' || (ex.repRange && !ex.pct)) {
    const totalSets = ex.sets || 3;
    recordHypertrophySet(exId, weight, reps, ex.repRange, totalSets);
  }

  // Auto-start rest timer
  if (ex.rest > 0) startRestTimer(ex.rest);

  closeModal();
  renderWorkout();
}

function endWorkout() {
  if (!STATE.activeWorkout) { nav('home'); return; }
  if (!confirm('End this workout and save it?')) return;

  // Save session to log
  const { date, dayKey, day, setsLogged } = STATE.activeWorkout;
  const sessionSec = STATE.sessionTimer.active
    ? Math.floor((Date.now() - STATE.sessionTimer.start) / 1000) : 0;

  STATE.log[date] = {
    dayKey,
    title: day.title,
    setsLogged,
    sessionMin: Math.round(sessionSec / 60),
  };

  // Evaluate double-progression for next session, then clear the live set tracker.
  finalizeHypertrophyProgression();

  stopSessionTimer();
  releaseWakeLock();
  clearRestTimer();
  STATE.activeWorkout = null;
  save();

  alert(`Workout saved! Session: ${Math.round(sessionSec / 60)} min`);
  nav('home');
}

// ─── Render: History ──────────────────────────────────────────────────────────
function renderHistory() {
  const app = $('app');
  const dates = Object.keys(STATE.log).sort().reverse();

  app.innerHTML = `
    <div class="page history-page">
      <div class="page-title">History</div>
      ${dates.length === 0 ? '<div class="empty-state">No sessions logged yet.</div>' : ''}
      ${dates.map(d => {
        const s = STATE.log[d];
        const totalSets = Object.values(s.setsLogged || {}).reduce((a,b) => a + b.length, 0);
        return `
          <div class="history-card" onclick="toggleHistoryDetail('${d}')">
            <div class="history-date">${d}</div>
            <div class="history-day">${s.title || s.dayKey}</div>
            <div class="history-meta">${totalSets} sets · ${s.sessionMin || '?'} min</div>
            <div class="history-detail hidden" id="hd-${d}">
              ${renderHistoryDetail(s)}
            </div>
          </div>`;
      }).join('')}

      <div class="history-lifts">
        <div class="page-subtitle">Weight History by Exercise</div>
        ${renderExerciseHistory()}
      </div>
    </div>`;
}

function toggleHistoryDetail(d) {
  const el = $(`hd-${d}`);
  if (el) el.classList.toggle('hidden');
}

function renderHistoryDetail(session) {
  if (!session.setsLogged) return '';
  return Object.entries(session.setsLogged).map(([key, sets]) => {
    const exId = key.split('_').slice(1).join('_');
    const exDef = PROGRAM.exercises[exId];
    if (!exDef) return '';
    return `<div class="hd-ex">
      <div class="hd-ex-name">${exDef.name}</div>
      ${sets.map((s,i) => `<div class="hd-set">Set ${i+1}: ${fmtWeight(s.weight)} × ${s.reps} reps${s.rir !== '' ? ` · RIR ${s.rir}` : ''}${s.note ? ` — "${s.note}"` : ''}</div>`).join('')}
    </div>`;
  }).join('');
}

function renderExerciseHistory() {
  // Find exercises that have been logged
  const exWeights = {}; // exId → [{date, weight, reps}]
  Object.entries(STATE.log).forEach(([date, session]) => {
    if (!session.setsLogged) return;
    Object.entries(session.setsLogged).forEach(([key, sets]) => {
      const exId = key.split('_').slice(1).join('_');
      if (!exWeights[exId]) exWeights[exId] = [];
      const heaviest = sets.reduce((best, s) => (!best || (s.weight || 0) > (best.weight || 0)) ? s : best, null);
      if (heaviest) exWeights[exId].push({ date, weight: heaviest.weight, reps: heaviest.reps });
    });
  });

  const tracked = Object.entries(exWeights).filter(([,v]) => v.length > 0);
  if (tracked.length === 0) return '<div class="empty-state">Log some workouts to see progress.</div>';

  return tracked.map(([exId, history]) => {
    const exDef = PROGRAM.exercises[exId];
    if (!exDef) return '';
    const sorted = history.slice().sort((a,b) => a.date.localeCompare(b.date));
    const maxW = Math.max(...sorted.map(h => h.weight || 0));
    return `<div class="ex-history-card">
      <div class="ex-history-name">${exDef.name}</div>
      <div class="mini-chart">
        ${sorted.map(h => {
          const pct = maxW > 0 ? (h.weight || 0) / maxW * 100 : 0;
          return `<div class="mini-bar-wrap" title="${h.date}: ${fmtWeight(h.weight)} × ${h.reps}">
            <div class="mini-bar" style="height:${Math.max(pct,8)}%"></div>
            <div class="mini-label">${h.date.slice(5)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="ex-history-best">Best: ${fmtWeight(maxW)}</div>
    </div>`;
  }).join('');
}

// ─── Render: Settings ─────────────────────────────────────────────────────────
function renderSettings() {
  const app = $('app');
  const { blockId, weekInBlock } = STATE.program;
  const block = PROGRAM.blocks.find(b => b.id === blockId);
  const blockName = block?.name || 'Block 1';

  app.innerHTML = `
    <div class="page settings-page">
      <div class="page-title">Settings</div>

      <div class="settings-section">
        <div class="settings-label">Training Maxes (lbs)</div>
        <div class="maxes-grid">
          ${Object.entries(PROGRAM.liftNames).map(([k, name]) => `
            <div class="max-row">
              <label class="max-label">${name}</label>
              <input type="number" id="max-${k}" class="max-input"
                value="${STATE.maxes[k] || ''}" inputmode="decimal"
                placeholder="0" onchange="updateMax('${k}', this.value)">
              <span class="max-unit">lb</span>
            </div>`).join('')}
        </div>
        <div class="settings-note">These are your 1RM training maxes from Week 0. All percentages in the program reference these numbers.</div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Current Position in Program</div>
        <div class="program-pos">
          <label class="form-label">Block</label>
          <select id="sel-block" class="form-input" onchange="updateBlock(this.value)">
            ${PROGRAM.blocks.map(b => `<option value="${b.id}" ${b.id === blockId ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>

          <label class="form-label">Week within block (1–${block?.weeks || 4})</label>
          <input type="number" id="inp-week" class="form-input" min="1" max="${block?.weeks || 4}"
            value="${weekInBlock + 1}" inputmode="numeric"
            onchange="updateWeek(this.value)">
        </div>
        <div class="settings-note">Block: ${blockName} · Program Week ${block ? block.startWeek + weekInBlock : 0}</div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Data</div>
        <button class="btn-outline btn-full" onclick="exportData()">Export Backup (JSON)</button>
        <button class="btn-outline btn-full" style="margin-top:8px" onclick="$('import-input').click()">Import Backup</button>
        <input type="file" id="import-input" accept=".json" class="hidden" onchange="importData(this)">
        <button class="btn-danger-outline btn-full" style="margin-top:8px" onclick="clearAllData()">Clear All Data</button>
      </div>

      <div class="settings-section">
        <div class="settings-label">Add to Home Screen</div>
        <div class="settings-note">
          To install on iPhone: open this page in Safari → tap the Share button → "Add to Home Screen". The app will then work offline and full-screen.
        </div>
      </div>
    </div>`;
}

function updateMax(lift, val) {
  STATE.maxes[lift] = parseFloat(val) || null;
  save();
}

function updateBlock(val) {
  STATE.program.blockId = parseInt(val);
  STATE.program.weekInBlock = 0;
  save();
  renderSettings();
}

function updateWeek(val) {
  const block = PROGRAM.blocks.find(b => b.id === STATE.program.blockId);
  const max = block?.weeks || 4;
  STATE.program.weekInBlock = Math.min(Math.max(parseInt(val) - 1, 0), max - 1);
  save();
}

function exportData() {
  const data = JSON.stringify({
    maxes: STATE.maxes,
    program: STATE.program,
    log: STATE.log,
    hypertrophyWeights: STATE.hypertrophyWeights,
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oly-tracker-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.maxes) Object.assign(STATE.maxes, data.maxes);
      if (data.program) Object.assign(STATE.program, data.program);
      if (data.log) STATE.log = data.log;
      if (data.hypertrophyWeights) STATE.hypertrophyWeights = data.hypertrophyWeights;
      save();
      alert('Backup imported successfully!');
      render();
    } catch (err) {
      alert('Invalid backup file.');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('Delete ALL workout data? This cannot be undone.')) return;
  localStorage.removeItem('oly_state');
  Object.assign(STATE, { maxes: {snatch:null,cj:null,bs:null,fs:null,pp:null,bench:null}, program:{blockId:1,weekInBlock:0}, log:{}, hypertrophyWeights:{} });
  render();
}

// ─── Main render ──────────────────────────────────────────────────────────────
function render() {
  switch (STATE.view) {
    case 'home':    renderHome(); break;
    case 'workout': renderWorkout(); break;
    case 'history': renderHistory(); break;
    case 'settings': renderSettings(); break;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  load();
  render();

  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => nav(btn.dataset.view));
  });

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Re-acquire wake lock after visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && STATE.activeWorkout && !STATE.wakeLock) {
      acquireWakeLock();
    }
    // Check if rest timer elapsed while backgrounded
    if (document.visibilityState === 'visible' && STATE.restTimer.active) {
      const rem = STATE.restTimer.end - Date.now();
      if (rem <= 0) {
        clearRestTimer();
        timerDoneSound();
        renderTimerOverlay(true);
      }
    }
    // Re-sync the interval timer if phases elapsed while backgrounded
    if (document.visibilityState === 'visible' && STATE.intervalTimer.active) {
      catchUpIntervalTimer();
    }
  });
});
