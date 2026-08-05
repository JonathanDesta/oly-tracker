'use strict';

// ─── Exercise slot cache (populated during render, used by modal) ─────────────
const EX_CACHE = {};

// ─── State ────────────────────────────────────────────────────────────────────
const STATE = {
  schemaVersion: 3,
  view: 'home',
  maxes: { snatch: 155, cj: 205, jerk: 205, clean: 255, bs: 365, fs: 275, bench: 265 },
  program: { blockId: 1, weekInBlock: 0 }, // 13-week block; weekInBlock is 0-indexed
  cycleId: 1,
  receiving: { hh_clean: 165, recv_clean: 190 }, // absolute loads, progress on catch quality
  receivingMeta: { hh_clean: { stalls: 0 }, recv_clean: { stalls: 0 } },
  technicalProgress: { hhSnatchPct: 65, lastExposureKey: null },
  cutting: false, // training phase: false = lean bulk, true = cutting (deficit)
  readiness: 'green',
  readinessDate: null,
  pickupDays: [],
  pickupTiming: {},
  pickupWeekKey: null,
  tmWatch: {},
  testResults: {},
  copenhagen: { step: 1, load: 0, lastExposureKey: null },
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
    ts: Date.now(), // stamps every save so cloud sync can pick the newest copy
    maxes: STATE.maxes,
    schemaVersion: STATE.schemaVersion,
    cycleId: STATE.cycleId,
    receiving: STATE.receiving,
    receivingMeta: STATE.receivingMeta,
    technicalProgress: STATE.technicalProgress,
    program: STATE.program,
    cutting: STATE.cutting,
    readiness: STATE.readiness,
    readinessDate: STATE.readinessDate,
    pickupDays: STATE.pickupDays,
    pickupTiming: STATE.pickupTiming,
    pickupWeekKey: STATE.pickupWeekKey,
    tmWatch: STATE.tmWatch,
    testResults: STATE.testResults,
    copenhagen: STATE.copenhagen,
    log: STATE.log,
    hypertrophyWeights: STATE.hypertrophyWeights,
    // Persist the in-progress session + timers so an iOS PWA teardown between
    // sets (lock screen / app switch) restores instead of resetting. Timers are
    // stored as absolute timestamps, so elapsed background time is accounted for
    // on restore. Only the running (active) timers are worth saving.
    activeWorkout: STATE.activeWorkout,
    timers: {
      rest: STATE.restTimer.active
        ? { end: STATE.restTimer.end, prescribed: STATE.restTimer.prescribed } : null,
      session: STATE.sessionTimer.active
        ? { start: STATE.sessionTimer.start } : null,
      interval: STATE.intervalTimer.active ? {
        config: STATE.intervalTimer.config,
        phases: STATE.intervalTimer.phases,
        phaseIdx: STATE.intervalTimer.phaseIdx,
        phaseEnd: STATE.intervalTimer.phaseEnd,
        paused: STATE.intervalTimer.paused,
        pauseRemaining: STATE.intervalTimer.pauseRemaining,
        lastCue: STATE.intervalTimer.lastCue,
        startedAt: STATE.intervalTimer.startedAt,
      } : null,
    },
  }));
  publishDayDurations();
  if (typeof schedulePush === 'function') schedulePush(); // debounced Drive sync
}

// Publish this week's expected session lengths (minutes, keyed mon…sun; 0 = rest)
// into shared storage so the Day life-manager app — served from the same origin —
// sizes its timeline gym block from the program itself instead of keeping its own
// copy of these numbers. Recomputed on every save so block/week/cutting/no-sport
// changes propagate immediately. The snapshot records the program state it was
// computed from so a consumer can tell when it's stale.
function publishDayDurations() {
  try {
    const min = {};
    PROGRAM.dayKeys.forEach(k => {
      const plan = dayPlanFor(k);
      min[k.slice(0, 3)] = (plan && !plan.isRest)
        ? plan.sessions.filter(s => !s.skipped).reduce((t, s) => t + (s.totalMin || 0), 0)
        : 0;
    });
    localStorage.setItem('oly_day_durations', JSON.stringify({
      v: 1,
      blockId: STATE.program.blockId,
      weekInBlock: STATE.program.weekInBlock || 0,
      cutting: !!STATE.cutting,
      readiness: effectiveReadiness(),
      pickupDays: activePickupDays().slice(),
      min,
      ts: Date.now(),
    }));
  } catch (e) { /* storage unavailable — non-critical, Day falls back to its table */ }
}

function programWeekNumber(program = STATE.program) {
  const block = PROGRAM.blocks.find(b => b.id === Number(program?.blockId));
  return block ? block.startWeek + Math.max(0, Number(program?.weekInBlock) || 0) : 1;
}

function currentPickupWeekKey() {
  return `${STATE.cycleId}:${programWeekNumber()}`;
}

function effectiveReadiness() {
  return STATE.readinessDate === today() && ['green', 'yellow', 'red'].includes(STATE.readiness)
    ? STATE.readiness : 'green';
}

function activePickupDays() {
  return STATE.pickupWeekKey === currentPickupWeekKey() ? STATE.pickupDays : [];
}

function activePickupTiming() {
  return STATE.pickupWeekKey === currentPickupWeekKey() ? STATE.pickupTiming : {};
}

function applyDurableData(data) {
  STATE.schemaVersion = 3;
  STATE.maxes = {
    snatch: 155, cj: 205, jerk: 205, clean: 255, bs: 365, fs: 275, bench: 265,
    ...(data.maxes || {}),
  };
  STATE.program = { blockId: 1, weekInBlock: 0, ...(data.program || {}) };
  STATE.cycleId = Number(data.cycleId) || 1;
  STATE.receiving = { hh_clean: 165, recv_clean: 190, ...(data.receiving || {}) };
  STATE.receivingMeta = {
    hh_clean: { stalls: 0 }, recv_clean: { stalls: 0 }, ...(data.receivingMeta || {}),
  };
  STATE.technicalProgress = { hhSnatchPct: 65, lastExposureKey: null, ...(data.technicalProgress || {}) };
  STATE.cutting = !!data.cutting;
  const savedReadiness = ['green', 'yellow', 'red'].includes(data.readiness) ? data.readiness : 'green';
  const savedReadinessDate = data.readinessDate || today(); // legacy migration: current day
  STATE.readiness = savedReadinessDate === today() ? savedReadiness : 'green';
  STATE.readinessDate = today();
  STATE.pickupDays = Array.isArray(data.pickupDays)
    ? data.pickupDays.filter(d => PROGRAM.dayKeys.includes(d)) : [];
  STATE.pickupTiming = data.pickupTiming && typeof data.pickupTiming === 'object' ? data.pickupTiming : {};
  STATE.pickupWeekKey = data.pickupWeekKey || (STATE.pickupDays.length ? currentPickupWeekKey() : null);
  if (STATE.pickupWeekKey !== currentPickupWeekKey()) {
    STATE.pickupDays = [];
    STATE.pickupTiming = {};
    STATE.pickupWeekKey = currentPickupWeekKey();
  }
  STATE.tmWatch = data.tmWatch || {};
  STATE.testResults = data.testResults || {};
  STATE.copenhagen = { step: 1, load: 0, lastExposureKey: null, ...(data.copenhagen || {}) };
  STATE.log = data.log || {};
  STATE.hypertrophyWeights = data.hypertrophyWeights || {};
}

function clearRuntimeForLoad() {
  clearInterval(STATE.restTimer.interval);
  clearInterval(STATE.sessionTimer.interval);
  clearInterval(STATE.intervalTimer.interval);
  releaseWakeLock();
  STATE.activeWorkout = null;
  STATE._restoreTimers = null;
  STATE.restTimer = { active: false, end: 0, prescribed: 0, interval: null };
  STATE.sessionTimer = { active: false, start: 0, interval: null };
  STATE.intervalTimer = {
    active: false, config: null, phases: [], phaseIdx: 0,
    phaseEnd: 0, paused: false, pauseRemaining: 0,
    interval: null, lastCue: -1, startedAt: 0,
  };
}

function load() {
  try {
    const raw = localStorage.getItem('oly_state');
    if (!raw) return;
    const data = JSON.parse(raw);
    clearRuntimeForLoad();
    applyDurableData(data);
    // Restore an in-progress session so it survives the PWA being torn down
    // mid-workout. Discard anything older than 6h — that's well past any real
    // session (incl. long rests), so it cleanly drops a stale one from earlier
    // in the day or a previous day without a fragile calendar-date check.
    if (data.activeWorkout &&
        (Date.now() - (data.activeWorkout.startedAt || 0)) < 6 * 60 * 60 * 1000) {
      STATE.activeWorkout = data.activeWorkout;
      STATE.activeWorkout.receivingOverrides = STATE.activeWorkout.receivingOverrides || {};
      STATE.activeWorkout.loadOverrides = STATE.activeWorkout.loadOverrides || {};
      STATE.activeWorkout.stoppedExercises = STATE.activeWorkout.stoppedExercises || {};
      STATE.activeWorkout.tmSnapshot = STATE.activeWorkout.tmSnapshot || { ...STATE.maxes };
      STATE._restoreTimers = data.timers || null; // applied after render() in init
    } else if (data.activeWorkout) {
      // Remove an expired snapshot immediately so cloud sync cannot resurrect it.
      save();
    }
  } catch (e) { console.warn('Load error', e); }
}

function programContext(dayKey, applyReadiness = dayKey === todayDayKey()) {
  return {
    readiness: applyReadiness ? effectiveReadiness() : 'green',
    pickupDays: activePickupDays(),
    pickupTiming: activePickupTiming(),
    copenhagen: STATE.copenhagen,
    technicalProgress: STATE.technicalProgress,
  };
}

function dayPlanFor(dayKey) {
  const { blockId, weekInBlock } = STATE.program;
  return PROGRAM.getDayPlan(blockId, weekInBlock, dayKey, STATE.cutting, programContext(dayKey));
}

// Resolve one separately timed/logged session from a day.
function dayFor(dayKey, sessionId) {
  const { blockId, weekInBlock } = STATE.program;
  // A makeup session is still performed today, so today's readiness applies
  // when it is actually started even though future/past previews stay Green.
  return PROGRAM.getWorkout(blockId, weekInBlock, dayKey, STATE.cutting, sessionId, programContext(dayKey, true));
}

// ─── Audio ────────────────────────────────────────────────────────────────────
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // iOS suspends the context when the page is backgrounded/locked — resume or
  // every subsequent beep is silent.
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
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
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
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
  // Every rest start is a user gesture — unlock/resume audio here so the done
  // alarm works even when the session was restored by a reload (startWorkout's
  // initAudio never ran in that page load).
  initAudio();
  clearTimeout(restDoneHide);
  clearRestTimer();
  STATE.restTimer.prescribed = seconds;
  STATE.restTimer.end = Date.now() + seconds * 1000;
  STATE.restTimer.active = true;
  renderTimerOverlay();
  STATE.restTimer.interval = setInterval(tickRestTimer, 250);
  save(); // persist so a reload during rest keeps counting
}

// Re-arm a rest timer from a persisted end-time after a page reload.
function resumeRestTimer(end, prescribed) {
  clearRestTimer();
  STATE.restTimer.prescribed = prescribed;
  STATE.restTimer.end = end;
  STATE.restTimer.active = true;
  if (end - Date.now() <= 0) {
    // Rest elapsed while the app was gone — show the done state (no sound, since
    // audio is blocked until a user gesture on a fresh load).
    restTimerDone(true);
    return;
  }
  renderTimerOverlay();
  STATE.restTimer.interval = setInterval(tickRestTimer, 250);
}

function tickRestTimer() {
  const rem = Math.ceil((STATE.restTimer.end - Date.now()) / 1000);
  if (rem <= 0) { restTimerDone(); return; }
  renderTimerOverlay();
}

// Rest elapsed: alarm, show the done screen, then auto-dismiss it. +30s/+1m on
// the done screen restart the timer, which cancels the pending dismiss.
let restDoneHide = null;
function restTimerDone(silent = false) {
  clearRestTimer();
  if (!silent) {
    timerDoneSound();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  }
  renderTimerOverlay(true);
  clearTimeout(restDoneHide);
  restDoneHide = setTimeout(() => {
    if (!STATE.restTimer.active) skipRestTimer();
  }, 4000);
  save(); // rest no longer active — keep the persisted snapshot in sync
}

function clearRestTimer() {
  clearInterval(STATE.restTimer.interval);
  STATE.restTimer.active = false;
  STATE.restTimer.interval = null;
}

function skipRestTimer() {
  clearTimeout(restDoneHide);
  clearRestTimer();
  document.getElementById('timer-overlay').classList.add('hidden');
  save();
}

function addRestTime(sec) {
  // If the timer already completed (or was never running), the "+30s / +1m"
  // buttons on the done screen should start a fresh rest of that length rather
  // than silently mutating a dead end-time.
  if (!STATE.restTimer.active) { startRestTimer(sec); return; }
  STATE.restTimer.end += sec * 1000;
  renderTimerOverlay();
  save();
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
  save();
}

function resumePersistedIntervalTimer(snapshot) {
  if (!snapshot?.config) return;
  const it = STATE.intervalTimer;
  clearInterval(it.interval);
  it.config = snapshot.config;
  it.phases = Array.isArray(snapshot.phases) && snapshot.phases.length
    ? snapshot.phases : buildPhases(snapshot.config);
  it.phaseIdx = Math.max(0, Number(snapshot.phaseIdx) || 0);
  it.phaseEnd = Number(snapshot.phaseEnd) || Date.now();
  it.paused = !!snapshot.paused;
  it.pauseRemaining = Math.max(0, Number(snapshot.pauseRemaining) || 0);
  it.lastCue = Number.isFinite(snapshot.lastCue) ? snapshot.lastCue : -1;
  it.startedAt = Number(snapshot.startedAt) || Date.now();
  it.active = true;
  it.interval = null;
  if (!it.paused) catchUpIntervalTimer(false);
  if (!it.active) return;
  renderIntervalOverlay();
  it.interval = setInterval(tickIntervalTimer, 200);
  save();
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
  save();
}

function finishIntervalTimer() {
  const it = STATE.intervalTimer;
  clearInterval(it.interval);
  it.interval = null;
  it.active = false;
  intervalDoneSound();
  renderIntervalOverlay(true);
  save();
}

function pauseIntervalTimer() {
  const it = STATE.intervalTimer;
  if (!it.active || it.paused) return;
  it.paused = true;
  it.pauseRemaining = Math.max(0, it.phaseEnd - Date.now());
  renderIntervalOverlay();
  save();
}

function resumeIntervalTimer() {
  const it = STATE.intervalTimer;
  if (!it.active || !it.paused) return;
  it.paused = false;
  it.phaseEnd = Date.now() + it.pauseRemaining;
  renderIntervalOverlay();
  save();
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
  save();
}

// Re-sync after the tab was backgrounded (timers are throttled when hidden).
// Silently fast-forward through any phases that fully elapsed while away.
function catchUpIntervalTimer(persist = true) {
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
  if (persist) save();
}

// ─── Session timer ────────────────────────────────────────────────────────────
function startSessionTimer() {
  clearInterval(STATE.sessionTimer.interval); // never leak a prior session's interval
  STATE.sessionTimer.start = Date.now();
  STATE.sessionTimer.active = true;
  STATE.sessionTimer.interval = setInterval(updateSessionTimerDisplay, 1000);
  save();
}

// Re-arm the session timer from a persisted start-time after a page reload.
// It's count-down-from-start math, so the display self-corrects for the gap.
function resumeSessionTimer(start) {
  clearInterval(STATE.sessionTimer.interval);
  STATE.sessionTimer.start = start;
  STATE.sessionTimer.active = true;
  STATE.sessionTimer.interval = setInterval(updateSessionTimerDisplay, 1000);
}

function restoreRuntimeTimers() {
  if (!STATE.activeWorkout) return;
  const timers = STATE._restoreTimers;
  delete STATE._restoreTimers;
  acquireWakeLock();
  if (timers?.session) resumeSessionTimer(timers.session.start);
  if (timers?.rest) resumeRestTimer(timers.rest.end, timers.rest.prescribed);
  if (timers?.interval) resumePersistedIntervalTimer(timers.interval);
}

function stopSessionTimer() {
  clearInterval(STATE.sessionTimer.interval);
  STATE.sessionTimer.active = false;
  save();
}

function updateSessionTimerDisplay() {
  const el = document.getElementById('session-timer');
  if (!el || !STATE.activeWorkout) return;
  const elapsed = Math.floor((Date.now() - STATE.sessionTimer.start) / 1000);
  const total = STATE.activeWorkout.totalSec || 0;
  if (!total) { el.textContent = fmtTime(elapsed); return; } // fallback: count up
  const rem = total - elapsed;
  if (rem >= 0) {
    el.textContent = fmtTime(rem);
    el.classList.remove('session-over');
  } else {
    el.textContent = '+' + fmtTime(-rem); // overtime
    el.classList.add('session-over');
  }
  highlightCurrentExercise(elapsed);
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

function sessionCompleted(dayKey, sessionId, programWeek) {
  return Object.values(STATE.log).some(log => {
    if (log.cycleId != null && log.programWeek != null) {
      return log.cycleId === STATE.cycleId && log.programWeek === programWeek
        && log.dayKey === dayKey && log.sessionId === sessionId;
    }
    // Legacy records did not store cycle/week/session metadata.
    return log.date === dateForWeekday(PROGRAM.dayKeys.indexOf(dayKey))
      && log.dayKey === dayKey && (sessionId === 'main' || !log.sessionId);
  });
}

// Best-guess timer length (seconds) for a steady cardio / mobility slot.
function durationSec(ex) {
  if (ex.timerSec) return ex.timerSec;
  if (ex.duration) {
    const m = String(ex.duration).match(/(\d+)/);
    if (m) {
      const value = parseInt(m[1], 10);
      return /\bmin\b/i.test(ex.duration) ? value * 60 : value;
    }
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
  return Object.keys(PROGRAM.liftNames).every(k => Number(STATE.maxes[k]) > 0);
}

// Get prescribed weight for an exercise slot
function prescribedWeight(ex, ignoreOverrides = false) {
  const maxes = STATE.activeWorkout?.tmSnapshot || STATE.maxes;
  let weight = null;
  if (ex.recvKey) {
    weight = PROGRAM.recvWeight(STATE.receiving, ex.recvKey);
  } else if (ex.baseLift && ex.pct != null) {
    weight = PROGRAM.calcWeight(maxes, ex.baseLift, ex.pct);
  }
  if (weight == null) return null;
  if (ex.loadMultiplier) weight *= ex.loadMultiplier;
  if (ex.loadCapPct && ex.loadCapBaseLift) {
    const cap = PROGRAM.calcWeight(maxes, ex.loadCapBaseLift, ex.loadCapPct);
    if (cap != null) weight = Math.min(weight, cap);
  }
  // A miss override stores the final reduced attempt (usually the actual load
  // minus 10 lb). Apply it after readiness/pickup scaling so that scaling is not
  // accidentally applied twice, while retaining whichever value is lower.
  if (!ignoreOverrides) {
    const slotKey = ex.slotKey || ex.id;
    const slotOverride = STATE.activeWorkout?.loadOverrides?.[slotKey];
    const receivingOverride = ex.recvKey
      ? STATE.activeWorkout?.receivingOverrides?.[ex.recvKey] : null;
    const override = slotOverride ?? receivingOverride;
    if (override != null) weight = Math.min(weight, override);
  }
  return Math.round(weight / 2.5) * 2.5;
}

function progressionKey(ex) {
  return ex.slotKey || `${STATE.activeWorkout?.dayKey || 'day'}_${ex.id}`;
}

// Get last weight used for a hypertrophy slot. The same exercise on different
// days may have different rep ranges and must not contaminate progression.
function lastWeight(ex) {
  return STATE.hypertrophyWeights[progressionKey(ex)] || null;
}

// Should this hypertrophy exercise progress weight this session?
// Reads progressNext, which is computed at the END of the previous session and
// deliberately survives the between-session reset (unlike the live `sets` array).
function shouldProgress(ex) {
  const last = STATE.hypertrophyWeights[progressionKey(ex)];
  return !!(last && last.progressNext);
}

// ─── Double progression logic ─────────────────────────────────────────────────
// During a session we just accumulate the reps performed at the working weight.
// repTop/setCount are stashed so progression can be evaluated at session end.
function recordHypertrophySet(ex, weight, reps, repRange, setCount, rir) {
  const key = progressionKey(ex);
  const existing = STATE.hypertrophyWeights[key] || { weight, sets: [], prevSets: [], exId: ex.id };
  existing.weight = weight;
  existing.sets = existing.sets || [];
  existing.sets.push({ reps, rir: rir === '' ? null : Number(rir) });
  existing.repTop = repRange ? repRange[1] : null;
  existing.setCount = setCount;
  const m = String(ex.rirNote || '').match(/(\d+)/);
  existing.targetRir = m ? Number(m[1]) : null;
  STATE.hypertrophyWeights[key] = existing;
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
      d.progressNext = d.sets.slice(-d.setCount).every(s => {
        const row = typeof s === 'number' ? { reps: s, rir: null } : s;
        const rirMet = d.targetRir == null || (row.rir != null && row.rir >= d.targetRir);
        return row.reps >= d.repTop && rirMet;
      });
    } else {
      d.progressNext = false;
    }
    d.prevSets = d.sets.map(s => typeof s === 'number' ? s : s.reps);
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[ch]);
}

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

  // Build the card once, then mutate it in place. Rebuilding innerHTML on every
  // 250ms tick destroyed the buttons mid-tap — iOS drops the click if the
  // element under the finger is replaced between touchstart and touchend.
  if (!overlay.querySelector('.timer-card')) {
    overlay.innerHTML = `
      <div class="timer-card">
        <div class="timer-label"></div>
        <div class="timer-circle-wrap">
          <svg viewBox="0 0 120 120" class="timer-svg">
            <circle cx="60" cy="60" r="54" class="timer-track"/>
            <circle cx="60" cy="60" r="54" class="timer-progress"
              stroke-dashoffset="0"
              style="transform:rotate(-90deg);transform-origin:50% 50%"/>
          </svg>
          <div class="timer-num"></div>
        </div>
        <div class="timer-prescribed"></div>
        <div class="timer-actions">
          <button class="btn-outline" onclick="addRestTime(30)">+30s</button>
          <button class="btn-outline" onclick="addRestTime(60)">+1m</button>
          <button class="btn-primary timer-skip" onclick="skipRestTimer()">Skip</button>
        </div>
      </div>`;
  }
  overlay.querySelector('.timer-label').textContent = done ? 'REST COMPLETE' : 'REST';
  overlay.querySelector('.timer-progress').setAttribute('stroke-dasharray', `${dash} ${circumference}`);
  overlay.querySelector('.timer-num').textContent = done ? '✓' : fmtTime(rem);
  overlay.querySelector('.timer-prescribed').textContent = `Prescribed: ${fmtTime(STATE.restTimer.prescribed)}`;
  overlay.querySelector('.timer-skip').textContent = done ? 'Done' : 'Skip';
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

// Short focus label from a day title, e.g. "Snatch + Back Squat + Push Hypertrophy".
function dayFocus(day) {
  if (!day || !day.title) return '';
  const idx = day.title.indexOf('—');
  return idx >= 0 ? day.title.slice(idx + 1).trim() : day.title;
}

// Documented session length already includes warm-up, rest, transitions and
// plate changes. Each AM/PM session is timed independently.
function dayDocMin(day) {
  if (!day) return null;
  return day.totalMin || null;
}

// Real-world overhead the doc's totals don't include: moving between stations /
// loading plates (per exercise) plus misc stoppage — restroom, waiting for a
// rack or machine, chalk (per session, spread evenly across every set).
const TRANSITION_SEC = 0;
const MISC_BUFFER_SEC = 0;

// Sets an exercise slot will actually take, for spreading the misc buffer.
function itemSetCount(ex, def) {
  if (!def || def.type === 'cardio' || def.type === 'mobility' || ex.interval) return 1;
  if (ex.buildup && ex.buildup.length) return ex.buildup.length;
  if (typeof ex.sets === 'number') return ex.sets;
  if (ex.isDailyMax || ex.isMaxEffort) return 6; // matches exerciseRawSec's fallback
  return 3;
}

function dayOverheadSec(day) {
  if (!day || !day.sections) return 0;
  let count = 0;
  day.sections.forEach(sec => sec.exercises.forEach(ex => {
    const def = PROGRAM.exercises[ex.id];
    if (!def) return;
    count++;
  }));
  return count ? count * TRANSITION_SEC + MISC_BUFFER_SEC : 0;
}

// Expected real session length = doc total + transition/misc overhead. This is
// what the home page, weekly export, and session countdown all use.
function dayEstMin(day) {
  const base = dayDocMin(day);
  if (base == null) return null;
  return base;
}

// ─── Session scheduling ───────────────────────────────────────────────────────
// Rough real time cost of one exercise, in seconds. Fixed-duration items
// (cardio/mobility/intervals) use their actual length; set-based items use
// sets × (execution + rest). Absolute values matter less than the ratios —
// the variable items are scaled to fit the day's documented total below.
function exerciseRawSec(ex, def) {
  if (ex.interval) {
    const c = ex.interval;
    return (c.warmupSec || 0) + (c.cooldownSec || 0) +
      c.rounds * c.workSec + (c.lastRest ? c.rounds : c.rounds - 1) * c.restSec;
  }
  if (def.type === 'cardio' || def.type === 'mobility' || (ex.duration && !ex.sets)) return durationSec(ex);
  const rampSec = ex.buildup && ex.buildup.length
    ? ex.buildup.reduce((t, s) => t + 30 + (s.rest || 0), 0)
    : 0;
  if (ex.isDailyMax || ex.isMaxEffort) {
    // Fallback for any build-to-max without an explicit ladder.
    const rest = ex.rest || 240;
    return rampSec + 6 * (25 + rest * 0.6);
  }
  const sets = typeof ex.sets === 'number' ? ex.sets : 3;
  const rest = ex.rest || 60;
  let exec = 30; // seconds to perform one set
  if (def.type === 'hypertrophy' || def.type === 'strength') exec = 40;
  else if (def.type === 'core') exec = 35;
  else if (def.type === 'jump') exec = 20;
  else if (def.type === 'warmup') exec = 25;
  return rampSec + sets * (exec + rest);
}

// Annotate each exercise in a day with a scheduled start offset (`_startSec`),
// anchored so the whole session sums to the document's totalMin. Returns a flat
// schedule list and the total seconds.
function computeSchedule(day) {
  if (!day || !day.sections) {
    return { totalSec: (day && day.totalMin) ? day.totalMin * 60 : 0, list: [] };
  }
  let fixedSec = 0, variableRaw = 0;
  const items = [];
  day.sections.forEach((sec, si) => sec.exercises.forEach((ex, ei) => {
    const def = PROGRAM.exercises[ex.id];
    if (!def) return;
    const fixed = def.type === 'cardio' || def.type === 'mobility' || !!ex.interval || !!(ex.duration && !ex.sets);
    const raw = exerciseRawSec(ex, def);
    items.push({ si, ei, ex, fixed, raw });
    if (fixed) fixedSec += raw; else variableRaw += raw;
  }));
  // Anchor the lifting work to the doc's total, then add real-world overhead on
  // top: a transition allowance per exercise plus the misc buffer spread evenly
  // across every set. The countdown and home estimate both include the overhead.
  const totalSec = (dayDocMin(day) || day.totalMin || 0) * 60;
  // Distribute the time left after fixed-duration items across the lifting work.
  const remaining = Math.max(totalSec - fixedSec, variableRaw > 0 ? 60 : 0);
  const scale = variableRaw > 0 ? remaining / variableRaw : 1;
  const totalSets = items.reduce((t, it) => t + itemSetCount(it.ex, PROGRAM.exercises[it.ex.id]), 0);
  const miscPerSet = totalSets ? MISC_BUFFER_SEC / totalSets : 0;
  let offset = 0;
  const list = [];
  items.forEach(it => {
    const base = it.fixed ? it.raw : Math.round(it.raw * scale);
    const sets = itemSetCount(it.ex, PROGRAM.exercises[it.ex.id]);
    const dur = base + TRANSITION_SEC + Math.round(sets * miscPerSet);
    it.ex._startSec = offset;
    it.ex._durSec = dur;
    list.push({ si: it.si, ei: it.ei, startSec: offset, durSec: dur });
    offset += dur;
  });
  return { totalSec: offset || totalSec, list };
}

// Live: mark the exercise the schedule expects you to be on right now.
function highlightCurrentExercise(elapsed) {
  const sch = STATE.activeWorkout && STATE.activeWorkout.schedule;
  if (!sch || !sch.length) return;
  let cur = -1;
  for (let i = 0; i < sch.length; i++) {
    if (sch[i].startSec <= elapsed) cur = i; else break;
  }
  sch.forEach((s, i) => {
    const card = document.getElementById(`ex-${s.si}-${s.ei}`);
    if (card) card.classList.toggle('ex-now', i === cur);
  });
}

// ─── Render: Home ─────────────────────────────────────────────────────────────
function renderHome() {
  const app = $('app');
  const dayKey = todayDayKey();
  const dayName = PROGRAM.dayNames[PROGRAM.dayKeys.indexOf(dayKey)];
  const { blockId, weekInBlock } = STATE.program;
  const block = PROGRAM.blocks.find(b => b.id === blockId);
  const blockName = block ? block.name : 'Program';
  const weekNum = block ? block.startWeek + weekInBlock : 0;
  const noMaxes = !hasMaxes();
  const isTestingBlock = blockId === 7;
  const blockStartDisabled = noMaxes && !isTestingBlock;
  const todayPlan = dayPlanFor(dayKey);
  const readiness = effectiveReadiness();
  const pickupDays = activePickupDays();

  const sessionButtons = (plan, d, large) => {
    if (!plan || plan.isRest || !plan.sessions.length) {
      return `<button class="btn-outline ${large ? 'btn-lg' : ''}" onclick="startWorkout('${d}', 'rest')">View Rest Day</button>`;
    }
    return `<div class="session-actions">${plan.sessions.map(s => {
      const done = sessionCompleted(d, s.id, plan.programWeek);
      const label = s.kind === 'field' ? 'AM Field' : s.kind === 'cardio' ? 'Zone 2' : s.kind === 'test' ? 'Test' : 'Lift';
      return `<button class="${large ? 'btn-primary' : 'btn-outline'} session-start" onclick="startWorkout('${d}', '${s.id}')"
        ${blockStartDisabled || s.skipped ? 'disabled' : ''}>
        <span>${done ? '✓ ' : ''}${label}${s.skipped ? ' · omitted' : ` · ~${s.totalMin || '?'} min`}</span>
        ${s.skipped ? `<small>${s.skipReason}</small>` : ''}
      </button>`;
    }).join('')}</div>`;
  };

  app.innerHTML = `
    <div class="page home-page">
      <div class="home-header">
        <div class="home-logo">🏋️</div>
        <div>
          <div class="home-title">Oly Tracker</div>
          <div class="home-sub">${blockName}
            <span class="phase-chip ${STATE.cutting ? 'phase-cut' : 'phase-bulk'}">${STATE.cutting ? 'CUT' : 'GAIN'}</span>
            <span class="phase-chip readiness-${readiness}">${readiness.toUpperCase()}</span>
            ${pickupDays.length ? `<span class="phase-chip phase-cut">PICKUP ${pickupDays.length}×</span>` : ''}
          </div>
        </div>
      </div>

      ${isTestingBlock ? `<div class="alert alert-warn"><b>Testing Week</b> — five 1RMs plus two heavy squat doubles at known RPE. The app converts the doubles before updating their TMs.</div>`
      : noMaxes ? `<div class="alert alert-warn"><b>Set every training max first</b> — enter them in Settings or complete week 13.</div>` : ''}

      <div class="today-card">
        <div class="today-label">TODAY · ${dayName}</div>
        <div class="today-day">${todayPlan?.title || dayName}</div>
        <div class="today-meta">Week ${weekNum} · ${todayPlan?.isRest ? 'Rest day' : `${todayPlan?.sessions.filter(s => !s.skipped).length || 0} available session(s)`}</div>
        ${sessionButtons(todayPlan, dayKey, true)}
      </div>

      <div class="daylist-title">This Week — AM and PM sessions log separately</div>
      <div class="day-list">
        ${PROGRAM.dayKeys.map((d, i) => {
          const name = PROGRAM.dayNames[i];
          const isToday = d === dayKey;
          const wd = dayPlanFor(d);
          const available = wd?.sessions.filter(s => !s.skipped) || [];
          const logged = available.length > 0
            && available.every(s => sessionCompleted(d, s.id, wd.programWeek));
          const total = wd?.sessions.filter(s => !s.skipped).reduce((t, s) => t + (s.totalMin || 0), 0) || 0;
          const availableSessions = wd?.sessions.filter(s => !s.skipped).length || 0;
          const meta = wd?.isRest ? 'Rest' : `${availableSessions} available session(s) · ~${total} min`;
          return `<div class="day-row day-row-sessions ${isToday ? 'day-row-today' : ''} ${logged ? 'day-row-done' : ''} ${blockStartDisabled ? 'day-row-disabled' : ''}">
            <div class="day-row-left"><div class="day-row-abbr">${name.slice(0, 3)}</div>${logged ? '<div class="day-row-check">✓</div>' : isToday ? '<div class="day-row-now">●</div>' : ''}</div>
            <div class="day-row-mid"><div class="day-row-focus">${wd?.title || name}</div><div class="day-row-meta">${meta}</div>${sessionButtons(wd, d, false)}</div>
          </div>`;
        }).join('')}
      </div>

      ${todayPlan?.sessions?.some(s => sessionCompleted(dayKey, s.id, todayPlan.programWeek)) ? `<div class="recent-card"><div class="recent-label">Today's programmed session logged</div><button class="btn-ghost" onclick="nav('history')">View history →</button></div>` : ''}

      <div class="rules-card">
        <div class="rules-title">Non-Negotiable Rules</div>
        <ol class="rules-list">
          <li>Stop on material technical deterioration.</li>
          <li>Two misses or two consecutive technically poor successes end the exercise.</li>
          <li>Hypertrophy follows Olympic work; never cut the Olympic block to save time.</li>
          <li>The written percentage is a ceiling, not an obligation.</li>
        </ol>
      </div>
    </div>`;
}

// ─── Render: Workout ──────────────────────────────────────────────────────────
function startWorkout(dayKey, sessionId) {
  initAudio();
  if (STATE.activeWorkout) {
    alert('Finish or end the active session before starting another one.');
    nav('workout');
    return;
  }
  const plan = dayPlanFor(dayKey);
  if (plan?.isRest || sessionId === 'rest') {
    alert(plan?.note || 'Complete rest. Nothing structured.');
    return;
  }
  const day = dayFor(dayKey, sessionId);
  if (!day) { alert('No workout found for this day.'); return; }
  if (day.skipped) { alert(day.skipReason || 'This session is omitted by the current weekly rules.'); return; }

  // Clear any live hypertrophy set tracker left over from an abandoned session
  // (activeWorkout isn't persisted, but recordHypertrophySet saves `sets` as it
  // goes — without this, a partial prior session would contaminate progression).
  Object.values(STATE.hypertrophyWeights).forEach(d => { if (d) d.sets = []; });

  const sched = computeSchedule(day);

  STATE.activeWorkout = {
    date: today(),
    id: `${today()}-${Date.now()}`,
    startedAt: Date.now(), // drives the 6h staleness window on restore
    dayKey,
    sessionId: day.id || sessionId || 'main',
    cycleId: STATE.cycleId,
    blockId: day.blockId,
    weekInBlock: day.weekInBlock,
    programWeek: day.programWeek,
    tmSnapshot: { ...STATE.maxes },
    readiness: effectiveReadiness(),
    pickupDays: activePickupDays().slice(),
    day,
    setsLogged: {}, // exerciseId → array of set objects
    receivingOverrides: {},
    loadOverrides: {},
    stoppedExercises: {},
    schedule: sched.list,
    totalSec: sched.totalSec,
    complete: false,
  };

  acquireWakeLock();
  startSessionTimer(); // calls save() — persists the new activeWorkout too
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
      ${(day.contextNotes || []).map(n => `<div class="alert alert-warn">${n}</div>`).join('')}
      ${day.sections.map((sec, si) => renderSection(sec, si, setsLogged)).join('')}
      <div class="workout-footer">
        <button class="btn-danger" onclick="endWorkout()">Finish Workout</button>
      </div>`;
  }

  app.innerHTML = `
    <div class="page workout-page">
      <div class="workout-header">
        <button class="btn-ghost-sm" onclick="endWorkout()">✕ End</button>
        <div class="workout-title">${PROGRAM.dayNames[PROGRAM.dayKeys.indexOf(STATE.activeWorkout.dayKey)]} · ${escapeHtml(day.title || STATE.activeWorkout.sessionId)}</div>
        <div class="session-timer-wrap">
          <span class="session-timer-label">${STATE.activeWorkout.totalSec ? 'TIME LEFT' : 'SESSION'}</span>
          <span id="session-timer" class="session-timer">${STATE.activeWorkout.totalSec ? fmtTime(STATE.activeWorkout.totalSec) : '00:00'}</span>
        </div>
      </div>
      ${body}
    </div>`;

  // Restart the session timer display update
  updateSessionTimerDisplay();
}

// ─── Render: Testing Day ──────────────────────────────────────────────────────
function renderTestingDay(day) {
  const testExerciseIds = {
    snatch: 'snatch_floor', cj: 'cj_floor', jerk: 'jerk_rack_heavy', clean: 'recv_clean',
    bs: 'back_squat', fs: 'front_squat', bench: 'bench',
  };
  const testedLifts = (day.lifts || []).map(l => l.lift);
  const testPrepId = testedLifts.includes('bs') || testedLifts.includes('bench') ? 'prep_bar_squats'
    : testedLifts.includes('snatch') ? 'prep_bar_snatch'
      : 'prep_bar_cj'; // C&J day, and jerk+below-parallel-clean day
  const prep = ['daily_mobility', testPrepId].map(id => {
    const def = PROGRAM.exercises[id];
    const sec = id === 'daily_mobility' ? 180 : 600;
    return `
      <div class="ex-card">
        <div class="ex-header" style="cursor:default">
          <div class="ex-name-wrap"><span class="ex-name">${def.name}</span></div>
        </div>
        <div class="ex-body" style="border-top:1px solid var(--border)">
          <div class="ex-notes">${def.notes}</div>
          <button class="btn-outline btn-full" onclick="startRestTimer(${sec})">⏱ Start Timer (${fmtTime(sec)})</button>
        </div>
      </div>`;
  }).join('');
  return `
    <div class="section sec-green">
      <div class="section-header">
        <span class="section-title">Mobility & Prep</span>
        <span class="section-note">Needs-based mobility, then raise and two empty-bar rounds.</span>
      </div>
      ${prep}
    </div>
    <div class="section sec-gold">
      <div class="section-header">
        <span class="section-title">${day.title}</span>
        ${day.note ? `<span class="section-note">${day.note}</span>` : ''}
      </div>
      ${STATE.activeWorkout.testsApplied ? '<div class="alert alert-warn">All seven results were applied to the new cycle. Finish this session; test inputs are now locked.</div>' : ''}
      ${day.lifts.map((l, i) => {
        const saved = STATE.testResults[l.lift] || {};
        const testEx = {
          id: testExerciseIds[l.lift], slotKey: `test_${l.lift}`, reps: l.testReps || 1,
          baseLift: l.lift, rest: 300, isMaxEffort: true, testAttempt: true,
          testPrescription: l.testReps || 1,
          ...(l.lift === 'clean' ? { receivingDepth: true } : {}),
        };
        return `${STATE.activeWorkout.testsApplied ? '' : renderExerciseCard(testEx, 90, i, STATE.activeWorkout.setsLogged)}
        <div class="ex-card">
          <div class="ex-header" style="cursor:default">
            <div class="ex-name-wrap"><span class="ex-name">${l.label}</span></div>
          </div>
          <div class="ex-body" style="border-top:1px solid var(--border)">
            ${l.cues && l.cues.length ? `<div class="cues">${l.cues.map(c => `<div class="cue">• ${c}</div>`).join('')}</div>` : ''}
            ${l.lift ? `
              <label class="form-label">${l.testReps === 2 ? 'Heavy double' : 'Made 1RM'} (lbs)</label>
              <div class="max-row">
                <input type="number" id="test-weight-${l.lift}" class="form-input" inputmode="decimal" step="2.5"
                  value="${saved.rawWeight || ''}" placeholder="lbs" ${STATE.activeWorkout.testsApplied ? 'disabled' : ''}>
                <span class="max-unit">lb</span>
              </div>
              ${l.requiresRpe ? `<label class="form-label">RPE of the double</label>
                <select id="test-rpe-${l.lift}" class="form-input" ${STATE.activeWorkout.testsApplied ? 'disabled' : ''}>
                  <option value="">Choose RPE 7–9</option>
                  ${[7,8,9].map(r => `<option value="${r}" ${saved.rpe === r ? 'selected' : ''}>RPE ${r} · ${r === 7 ? '86' : r === 8 ? '89' : '92'}% of 1RM</option>`).join('')}
                </select>` : ''}
              <button class="btn-outline btn-full" style="margin-top:10px" onclick="saveTestResult('${l.lift}', ${l.testReps || 1}, ${!!l.requiresRpe})" ${STATE.activeWorkout.testsApplied ? 'disabled' : ''}>Save Test Result</button>
              ${saved.estimated1rm ? `<div class="settings-note"><b>Staged TM: ${fmtWeight(saved.estimated1rm)}</b>${l.testReps === 2 ? ` from ${fmtWeight(saved.rawWeight)} @ RPE ${saved.rpe}` : ''}</div>` : '<div class="settings-note">Staged only; current-cycle TMs remain locked until all seven results are applied.</div>'}
            ` : ''}
          </div>
        </div>`; }).join('')}
    </div>
    <div class="workout-footer">
      <button class="btn-primary btn-full" onclick="applyTestResults()" ${testResultsReady() && !STATE.activeWorkout.testsApplied ? '' : 'disabled'}>Apply All 7 TMs &amp; Start New Cycle</button>
      <button class="btn-danger" onclick="endWorkout()">Finish Session</button>
    </div>`;
}

function saveTestResult(lift, reps, requiresRpe) {
  if (STATE.activeWorkout?.testsApplied) { alert('These results have already been applied to the new cycle.'); return; }
  const weight = Number($(`test-weight-${lift}`)?.value);
  const rpe = requiresRpe ? Number($(`test-rpe-${lift}`)?.value) : null;
  if (!weight || weight <= 0) { alert('Enter the heaviest successful result.'); return; }
  if (requiresRpe && ![7, 8, 9].includes(rpe)) { alert('Choose the RPE of the heavy double.'); return; }
  const attempts = STATE.activeWorkout?.setsLogged?.[`90_test_${lift}`] || [];
  const matchingMake = hasMatchingTestAttempt(attempts, weight, reps, requiresRpe ? rpe : null);
  if (!matchingMake) {
    alert('Log the successful attempt at this weight before staging it as the test result.');
    return;
  }
  const estimated1rm = requiresRpe
    ? PROGRAM.estimate1RM(weight, reps, rpe)
    : Math.round(weight / 2.5) * 2.5;
  STATE.testResults[lift] = {
    rawWeight: weight,
    reps,
    rpe,
    estimated1rm,
    attemptVerified: true,
    testedAt: Date.now(),
    sourceCycleId: STATE.cycleId,
  };
  save();
  renderWorkout();
}

function hasMatchingTestAttempt(attempts, weight, reps, rpe = null) {
  return attempts.some(attempt => attempt.outcome === 'make'
    && !attempt.technicalMiss && Number(attempt.reps) === Number(reps)
    && (rpe == null || Number(attempt.rpe) === Number(rpe))
    && Math.abs(Number(attempt.weight) - Number(weight)) < 1.25);
}

function testResultsReady() {
  return Object.keys(PROGRAM.liftNames).every(k => {
    const result = STATE.testResults[k];
    return Number(result?.estimated1rm) > 0 && result.attemptVerified === true
      && Number(result.sourceCycleId) === STATE.cycleId;
  });
}

function applyTestResults() {
  const lifts = Object.keys(PROGRAM.liftNames);
  if (!testResultsReady()) {
    alert('Save a successful result for all seven tests in the current cycle first.');
    return;
  }
  if (!confirm('Apply all seven staged training maxes and begin a new cycle at week 1?')) return;
  const appliedResults = JSON.parse(JSON.stringify(STATE.testResults));
  lifts.forEach(k => { STATE.maxes[k] = STATE.testResults[k].estimated1rm; });
  STATE.cycleId += 1;
  STATE.program = { blockId: 1, weekInBlock: 0 };
  STATE.tmWatch = {};
  STATE.receivingMeta = { hh_clean: { stalls: 0 }, recv_clean: { stalls: 0 } };
  STATE.technicalProgress = { hhSnatchPct: 65, lastExposureKey: null };
  STATE.testResults = {};
  STATE.readiness = 'green';
  STATE.readinessDate = today();
  STATE.pickupDays = [];
  STATE.pickupTiming = {};
  STATE.pickupWeekKey = currentPickupWeekKey();
  if (STATE.activeWorkout) {
    STATE.activeWorkout.testsApplied = true;
    STATE.activeWorkout.testResultsSnapshot = appliedResults;
  }
  save();
  alert(`Cycle ${STATE.cycleId} is staged at week 1. Finish this test session normally; its original TM snapshot remains in history.`);
  renderWorkout();
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

function exerciseStopReason(logged) {
  const misses = logged.filter(s => s.outcome === 'miss' || s.technicalMiss).length;
  if (misses >= 2) return 'Two misses: exercise ended for today.';
  const lastTwo = logged.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every(s => s.outcome === 'make' && s.grade === 'C')) {
    return 'Two consecutive technically poor successes: exercise ended for today.';
  }
  return '';
}

function qualityAttemptsPerSet(ex) {
  if (ex?.testAttempt) return 1; // a max-test double is one set-level attempt
  const reps = Number(ex?.reps);
  return Number.isInteger(reps) && reps > 0 ? reps : 1;
}

function qualityAttemptEndsSet(ex, attempt) {
  return attempt?.outcome === 'miss' || attempt?.technicalMiss
    || Number(attempt?.repNumber) >= qualityAttemptsPerSet(ex);
}

function completedQualitySets(ex, logged) {
  return logged.reduce((count, attempt) => count + (
    attempt.setNumber == null || qualityAttemptEndsSet(ex, attempt) ? 1 : 0
  ), 0);
}

function nextQualityAttempt(ex, logged) {
  if (!logged.length) return { setNumber: 1, repNumber: 1 };
  const last = logged[logged.length - 1];
  // A restored pre-v3 session recorded one row per whole set. Continue at the
  // next set instead of trying to infer rep-level structure retroactively.
  if (last.setNumber == null || qualityAttemptEndsSet(ex, last)) {
    return { setNumber: (Number(last.setNumber) || logged.length) + 1, repNumber: 1 };
  }
  return { setNumber: Number(last.setNumber), repNumber: Number(last.repNumber) + 1 };
}

function renderExerciseCard(ex, si, ei, setsLogged) {
  const exDef = PROGRAM.exercises[ex.id];
  if (!exDef) return '';

  const key = `${si}_${ex.slotKey || ex.id}`;
  const logged = setsLogged[key] || [];
  const isDailyMax = ex.isDailyMax;
  const isMaxEffort = ex.isMaxEffort;
  const isCardio = exDef.type === 'cardio';
  const isMobility = exDef.type === 'mobility';
  const isCore = exDef.type === 'core';
  const isJump = exDef.type === 'jump';
  const isWarmup = exDef.type === 'warmup';
  const isTimedSet = !!ex.timedSets;
  const tracksQuality = !!ex.testAttempt || exDef.type === 'oly' || ['jerk_rack', 'split_jerk_rack'].includes(ex.id);
  const isTimed = (isCardio || isMobility || isJump || isWarmup) && ex.duration && !ex.sets;
  const isHypertrophy = !isTimedSet && (exDef.type === 'hypertrophy' || (ex.repRange && !ex.pct && !isDailyMax));
  const stopped = STATE.activeWorkout?.stoppedExercises?.[key] || exerciseStopReason(logged);

  // Store exercise slot in cache for modal lookup
  EX_CACHE[`${si}_${ei}`] = { si, exId: ex.id, ei, ex };

  // Prescribed weight
  const pw = prescribedWeight(ex);
  const pwDisplay = pw ? fmtWeight(pw) : null;

  // For hypertrophy: last weight + progression
  const lastW = isHypertrophy ? lastWeight(ex) : null;
  const progress = isHypertrophy && ex.repRange ? shouldProgress(ex) : false;

  // Rep display
  let repDisplay = '';
  if (ex.testPrescription === 2) repDisplay = 'attempt · target is a heavy double';
  else if (ex.repRange) repDisplay = `${ex.repRange[0]}–${ex.repRange[1]} reps`;
  else if (ex.reps) repDisplay = `${ex.reps} ${Number(ex.reps) === 1 ? 'rep' : 'reps'}`;
  else if (ex.duration) repDisplay = ex.duration;

  // Sets display
  let setsDisplay = ex.sets ? `${ex.sets} sets` : '';
  if (ex.testAttempt) setsDisplay = 'Log every attempt';
  if (isDailyMax) setsDisplay = 'Build to daily max';
  if (isMaxEffort) setsDisplay = 'Work up (RPE 9)';
  if (ex.testAttempt) setsDisplay = 'Log every attempt';

  // Rest display
  const restDisplay = ex.rest ? fmtTime(ex.rest) : '';

  const lastWasRetryableMiss = logged.length > 0 &&
    (logged[logged.length - 1].outcome === 'miss' || logged[logged.length - 1].technicalMiss) && !stopped;
  const prescribedWorkComplete = tracksQuality
    ? completedQualitySets(ex, logged) >= (ex.sets || Infinity)
    : logged.length >= (ex.sets || Infinity);
  const qualityPosition = tracksQuality ? nextQualityAttempt(ex, logged) : null;
  const collapsed = !!stopped || (logged.length > 0 && !isDailyMax && !isMaxEffort
    && prescribedWorkComplete && !lastWasRetryableMiss);

  return `
    <div class="ex-card ${collapsed ? 'ex-done' : ''} ${ex.optional ? 'ex-optional' : ''}" id="ex-${si}-${ei}">
      <div class="ex-header" onclick="toggleExCard(${si},${ei})">
        <div class="ex-name-wrap">
          <span class="ex-name">${exDef.name}</span>
          ${ex.optional ? '<span class="badge badge-gold">OPTIONAL</span>' : ''}
          ${isDailyMax ? '<span class="badge badge-gold">DAILY MAX</span>' : ''}
          ${isMaxEffort ? '<span class="badge badge-gold">MAX EFFORT</span>' : ''}
          ${ex.cutNote ? `<span class="badge badge-cut">${ex.cutNote}</span>` : ''}
          ${ex.rirNote ? `<span class="badge badge-rir">${ex.rirNote}</span>` : ''}
          ${stopped ? '<span class="badge badge-stop">STOPPED</span>' : ''}
          ${collapsed ? '<span class="badge badge-green">✓ Done</span>' : ''}
        </div>
        <div class="ex-meta">
          ${ex._startSec != null && STATE.activeWorkout ? `<span class="ex-start">⏱ Start @ ${fmtTime(Math.max(0, STATE.activeWorkout.totalSec - ex._startSec))}</span>` : ''}
          ${setsDisplay ? `<span>${setsDisplay}</span>` : ''}
          ${repDisplay ? `<span>${repDisplay}</span>` : ''}
          ${pwDisplay ? `<span class="ex-pct">${pwDisplay}${ex.pct != null ? ` (${ex.pct}%)` : (ex.recvKey ? ' · catch-quality load' : '')}</span>` : ''}
          ${restDisplay ? `<span class="ex-rest">Rest: ${restDisplay}</span>` : ''}
        </div>
        ${progress ? `<div class="progress-banner">⬆ INCREASE WEIGHT this session</div>` : ''}
        ${lastW && lastW.prevSets && lastW.prevSets.length ? `<div class="last-weight">Last: ${fmtWeight(lastW.weight)} × ${lastW.prevSets.join(', ')} reps</div>` : ''}
      </div>

      <div class="ex-body ${collapsed ? 'hidden' : ''}">
        ${ex.optNote ? `<div class="ex-notes ex-notes-warn">○ ${ex.optNote}</div>` : ''}
        ${exDef.notes ? `<div class="ex-notes">${exDef.notes}</div>` : ''}
        ${ex.note ? `<div class="ex-notes ex-notes-warn">⚠ ${ex.note}</div>` : ''}
        ${ex.contextNote ? `<div class="ex-notes ex-notes-warn">${ex.contextNote}</div>` : ''}
        ${ex.readinessNote ? `<div class="ex-notes ex-notes-warn">${ex.readinessNote}</div>` : ''}
        ${ex.warmupNote ? `<div class="ex-notes">Warm-up: ${ex.warmupNote}</div>` : ''}
        ${stopped ? `<div class="ex-notes ex-notes-stop">${escapeHtml(stopped)}</div>` : ''}
        ${exDef.cues && exDef.cues.length ? `
          <div class="cues">
            ${exDef.cues.map(c => `<div class="cue">• ${c}</div>`).join('')}
          </div>` : ''}

        ${ex.buildup && ex.buildup.length ? `
          <div class="buildup">
            <div class="buildup-title">Build-up ladder — tap a step to start its rest</div>
            ${ex.buildup.map(s => {
              const w = s.relativeToWork
                ? (lastW?.weight ? Math.round((lastW.weight * s.relativeToWork / 100) / 2.5) * 2.5 : null)
                : PROGRAM.calcWeight(STATE.activeWorkout?.tmSnapshot || STATE.maxes, ex.baseLift, s.pct);
              return `<button class="buildup-step ${s.top ? 'buildup-top' : ''}" onclick="startRestTimer(${s.rest})">
                <span class="bs-pct">${s.relativeToWork || s.pct}%</span>
                <span class="bs-w">${w ? fmtWeight(w) : '—'}</span>
                <span class="bs-reps">× ${s.reps}</span>
                <span class="bs-rest">rest ${fmtTime(s.rest)}</span>
                ${s.top ? '<span class="bs-tag">TOP</span>' : ''}
              </button>`;
            }).join('')}
            ${ex.buildupNote ? `<div class="buildup-note">${ex.buildupNote}</div>` : ''}
          </div>` : ''}

        ${ex.interval ? `
          <button class="btn-log" onclick='startIntervalTimer(${JSON.stringify(ex.interval)})'>
            ▶ Start Interval Timer
          </button>
          <div class="interval-preview">${intervalSummary(ex.interval)}</div>
        ` : isTimed ? `
          <button class="btn-outline btn-full" onclick="startRestTimer(${durationSec(ex)})">
            ⏱ Start Timer (${Math.round(durationSec(ex) / 60)} min)
          </button>` : ''}

        ${!isTimed ? `
          <div class="set-log" id="setlog-${si}-${ei}">
            ${logged.map((s, i) => renderLoggedSet(s, i)).join('')}
          </div>
          <button class="btn-log" onclick="openLogSet('${si}_${ei}')" ${stopped ? 'disabled' : ''}>
            ${stopped ? 'Exercise ended by miss rule' : tracksQuality
              ? `+ Log Attempt · Set ${qualityPosition.setNumber}${ex.sets ? ` / ${ex.sets}` : ''}${qualityAttemptsPerSet(ex) > 1 ? ` · Rep ${qualityPosition.repNumber} / ${qualityAttemptsPerSet(ex)}` : ''}`
              : `+ Log Set ${logged.length + 1}${isDailyMax || isMaxEffort ? '' : ex.sets ? ` / ${ex.sets}` : ''}`}
          </button>
          ${ex.rest ? `<button class="btn-timer" onclick="startRestTimer(${ex.rest})">⏱ Start Rest (${fmtTime(ex.rest)})</button>` : ''}
        ` : ''}
      </div>
    </div>`;
}

function renderLoggedSet(s, i) {
  return `<div class="logged-set">
    <span class="set-num">${s.setNumber != null ? `Set ${s.setNumber}${s.repNumber != null ? ` · Rep ${s.repNumber}` : ''}` : `Set ${i + 1}`}</span>
    <span class="set-weight">${s.bodyweight && !s.weight ? 'BW' : fmtWeight(s.weight)}</span>
    <span class="set-reps">${s.seconds != null ? `${s.seconds}s/side` : s.testAttempt ? (s.testPrescription === 2 ? 'double attempt' : 'single attempt') : `${s.reps} reps`}</span>
    ${s.rir !== '' && s.rir != null ? `<span class="set-rir">RIR ${s.rir}</span>` : ''}
    ${s.rpe !== '' && s.rpe != null ? `<span class="set-rir">RPE ${s.rpe}</span>` : ''}
    ${s.outcome ? `<span class="attempt-${s.outcome}">${s.outcome === 'make' ? 'MAKE' : 'MISS'}</span>` : ''}
    ${s.grade ? `<span class="grade grade-${s.grade.toLowerCase()}">${s.grade}</span>` : ''}
    ${s.actualPct != null ? `<span class="set-rir">${s.actualPct}% TM</span>` : ''}
    ${s.lowReps != null ? `<span class="set-depth">${s.lowReps} low · ${s.highReps} high · ${s.stood ? 'stood' : 'not stood'}</span>` : ''}
    ${s.missDirection ? `<span class="set-note">${escapeHtml(s.missDirection)}${s.missStage ? ` · ${escapeHtml(s.missStage)}` : ''}</span>` : ''}
    ${s.note ? `<span class="set-note">"${escapeHtml(s.note)}"</span>` : ''}
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
  const logKey = `${si}_${ex.slotKey || exId}`;
  const logged = STATE.activeWorkout?.setsLogged[logKey] || [];
  const lastW = lastWeight(ex);
  const timedSets = !!ex.timedSets;
  const bodyweight = !!exDef.bodyweight || timedSets;
  const suggestedWeight = pw ?? ex.externalLoad ?? (lastW ? lastW.weight : (bodyweight ? 0 : ''));
  const tracksQuality = !!ex.testAttempt || exDef.type === 'oly' || ['jerk_rack', 'split_jerk_rack'].includes(exId);
  const tracksDepth = !!(ex.recvKey || ex.receivingDepth);
  const qualityPosition = tracksQuality ? nextQualityAttempt(ex, logged) : null;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'log-modal';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-title">${exDef.name}</div>
      <div class="modal-sub">${tracksQuality ? `Set ${qualityPosition.setNumber}${ex.sets ? ` of ${ex.sets}` : ''}${qualityAttemptsPerSet(ex) > 1 ? ` · Rep ${qualityPosition.repNumber} of ${qualityAttemptsPerSet(ex)}` : ''}` : `Set ${logged.length + 1}${ex.sets ? ` of ${ex.sets}` : ''}`}
        ${pw ? ` · Prescribed: ${fmtWeight(pw)}${ex.pct ? ` (${ex.pct}%)` : ''}` : ''}
        ${lastW ? ` · Last: ${fmtWeight(lastW.weight)}` : ''}
      </div>

      <label class="form-label">${bodyweight ? 'External load / assistance (lbs, optional)' : 'Weight (lbs)'}</label>
      <input type="number" id="inp-weight" class="form-input" value="${suggestedWeight || ''}"
        inputmode="decimal" step="2.5" placeholder="lbs">

      ${timedSets ? `
      <label class="form-label">Seconds completed per side</label>
      <div class="rep-picker">
        ${[20,25,30,35,40,45,60].map(n => `<button class="rep-btn" onclick="pickTimedSeconds(${n})">${n}</button>`).join('')}
      </div>
      <input type="number" id="inp-seconds" class="form-input" inputmode="numeric" min="0" placeholder="seconds per side">
      <input type="hidden" id="inp-reps" value="1">` : tracksQuality ? `
      <input type="hidden" id="inp-reps" value="">
      <input type="hidden" id="inp-made-reps" value="${ex.testAttempt ? ex.testPrescription || 1 : 1}">` : `
      <label class="form-label">Reps completed</label>
      <div class="rep-picker">
        ${[...Array(21)].map((_,i) => `<button class="rep-btn" onclick="pickRep(${i})">${i}</button>`).join('')}
      </div>
      <input type="number" id="inp-reps" class="form-input" inputmode="numeric" placeholder="or type reps">`}

      ${tracksQuality ? `<label class="form-label">Attempt RPE</label>
        <div class="rir-picker">${[6,7,8,9,10].map(r => `<button class="rir-btn effort-btn" onclick="pickEffort('rpe', ${r})">${r}</button>`).join('')}</div>
        <input type="hidden" id="inp-rpe" value="">` : timedSets ? `
        <input type="hidden" id="inp-rir" value="">` : `
        <label class="form-label">RIR (Reps in Reserve)</label>
        <div class="rir-picker">${[0,1,2,3,4,5].map(r => `<button class="rir-btn effort-btn" onclick="pickEffort('rir', ${r})">${r}</button>`).join('')}</div>
        <input type="hidden" id="inp-rir" value="">`}

      ${tracksQuality ? `
      <label class="form-label">Outcome</label>
      <div class="rir-picker">
        <button class="rir-btn outcome-btn" data-v="make" onclick="pickChoice('outcome','make')">Made</button>
        <button class="rir-btn outcome-btn" data-v="miss" onclick="pickChoice('outcome','miss')">Missed</button>
      </div>
      <input type="hidden" id="inp-outcome" value="">
      <label class="form-label">Grade this attempt</label>
      <div class="rir-picker">
        <button class="rir-btn grade-btn" data-g="A" onclick="pickGrade('A')">A</button>
        <button class="rir-btn grade-btn" data-g="B" onclick="pickGrade('B')">B</button>
        <button class="rir-btn grade-btn" data-g="C" onclick="pickGrade('C')">C</button>
      </div>
      <div class="modal-hint">A = felt solid, nothing you'd change · B = made it but chased it or the bar drifted · C = miss, or a make you'd be embarrassed by</div>
      <input type="hidden" id="inp-grade" value="">
      <label class="form-label">Miss direction (only if missed)</label>
      <div class="rir-picker">
        ${['forward','backward','other'].map(v => `<button class="rir-btn direction-btn" data-v="${v}" onclick="pickChoice('direction','${v}')">${v}</button>`).join('')}
      </div>
      <input type="hidden" id="inp-direction" value="">
      ${exId === 'cj_floor' ? `<label class="form-label">If missed: where?</label><div class="rir-picker">
        <button class="rir-btn stage-btn" data-v="clean" onclick="pickChoice('stage','clean')">Clean</button>
        <button class="rir-btn stage-btn" data-v="jerk" onclick="pickChoice('stage','jerk')">Jerk</button>
      </div><input type="hidden" id="inp-stage" value="">` : ''}` : ''}

      ${tracksDepth ? `
      <label class="form-label">Receiving depth — count every rep</label>
      <div class="depth-counts">
        <label>Below parallel <input type="number" id="inp-low-reps" class="form-input" min="0" max="10" inputmode="numeric" value="${Number(ex.reps) || 1}"></label>
        <label>Caught high <input type="number" id="inp-high-reps" class="form-input" min="0" max="10" inputmode="numeric" value="0"></label>
      </div>
      <label class="form-label">Stood every received rep completely?</label>
      <div class="rir-picker"><button class="rir-btn stood-btn" data-v="yes" onclick="pickChoice('stood','yes')">Yes</button><button class="rir-btn stood-btn" data-v="no" onclick="pickChoice('stood','no')">No</button></div>
      <input type="hidden" id="inp-stood" value="">
      <div class="modal-hint">Any high catch or failed stand blocks progression. Drop 10 lb immediately and repeat; next week's baseline holds.</div>` : ''}

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

function pickTimedSeconds(n) {
  $('inp-seconds').value = n;
  document.querySelectorAll('.rep-btn').forEach(b => b.classList.toggle('active', Number(b.textContent) === n));
}

function pickEffort(kind, n) {
  const input = $(`inp-${kind}`);
  if (input) input.value = n;
  document.querySelectorAll('.effort-btn').forEach(b => b.classList.toggle('active', Number(b.textContent) === n));
}

function pickGrade(g) {
  $('inp-grade').value = g;
  document.querySelectorAll('.grade-btn').forEach(b => b.classList.toggle('active', b.dataset.g === g));
}

function pickChoice(kind, value) {
  const input = $(`inp-${kind}`);
  if (input) input.value = value;
  if (kind === 'outcome' && $('inp-reps')) {
    $('inp-reps').value = value === 'make' ? ($('inp-made-reps')?.value || '1') : '0';
  }
  const cls = kind === 'outcome' ? 'outcome-btn'
    : kind === 'direction' ? 'direction-btn'
      : kind === 'stage' ? 'stage-btn' : 'stood-btn';
  document.querySelectorAll(`.${cls}`).forEach(b => b.classList.toggle('active', b.dataset.v === value));
}

function closeModal() {
  const m = $('log-modal');
  if (m) m.remove();
}

function submitSet(cacheKey) {
  const cached = EX_CACHE[cacheKey];
  if (!cached) return;
  const { si, exId, ex } = cached;
  const activeSlotKey = ex.slotKey || ex.id;
  const retryOverrideActive = STATE.activeWorkout?.loadOverrides?.[activeSlotKey] != null
    || (ex.recvKey && STATE.activeWorkout?.receivingOverrides?.[ex.recvKey] != null);

  const exDef = PROGRAM.exercises[exId];
  const timedSets = !!ex.timedSets;
  const bodyweight = !!exDef.bodyweight || timedSets;
  const weightRaw = $('inp-weight').value.trim();
  const weight = weightRaw === '' ? (bodyweight ? 0 : null) : Number(weightRaw);
  const repRaw = $('inp-reps').value;
  const reps = repRaw === '' ? null : Math.max(0, parseInt(repRaw, 10));
  const seconds = timedSets ? Math.max(0, parseInt($('inp-seconds').value, 10) || 0) : null;
  const rir = $('inp-rir') ? $('inp-rir').value : '';
  const rpe = $('inp-rpe') ? $('inp-rpe').value : '';
  const note = $('inp-note').value.trim();
  const tracksQuality = !!ex.testAttempt || exDef.type === 'oly' || ['jerk_rack', 'split_jerk_rack'].includes(exId);
  const tracksDepth = !!(ex.recvKey || ex.receivingDepth);
  const outcome = $('inp-outcome') ? $('inp-outcome').value : '';
  const grade = $('inp-grade') ? $('inp-grade').value : '';
  const missDirection = $('inp-direction') ? $('inp-direction').value : '';
  const missStage = $('inp-stage') ? $('inp-stage').value : '';

  if (tracksQuality && (!outcome || !grade || !rpe)) { alert('Record outcome, grade, and RPE for every competition-lift attempt.'); return; }
  if (reps == null) { alert('Record whether the attempt was made or missed.'); return; }
  if (weight == null || Number.isNaN(weight) || weight < 0) { alert('Enter the attempted weight.'); return; }
  if (timedSets && seconds <= 0) { alert('Enter the seconds completed on each side.'); return; }
  if (ex.rirNote && rir === '') { alert(`Record RIR so double progression can apply the ${ex.rirNote} target.`); return; }
  if (outcome === 'miss' && grade !== 'C') { alert('A missed lift must be graded C.'); return; }
  const expectedMadeReps = ex.testAttempt ? Number(ex.testPrescription) || 1 : 1;
  if (outcome === 'make' && reps !== expectedMadeReps) { alert(`A made attempt must record ${expectedMadeReps} completed rep${expectedMadeReps === 1 ? '' : 's'}.`); return; }
  if (outcome === 'miss' && reps !== 0) { alert('A missed attempt records zero completed reps.'); return; }
  if (outcome === 'miss' && !missDirection) { alert('Record the miss direction.'); return; }
  if (outcome === 'miss' && exId === 'cj_floor' && !missStage) { alert('Record whether the clean or jerk was missed.'); return; }

  let lowReps = null, highReps = null, stood = null;
  if (tracksDepth) {
    lowReps = Math.max(0, parseInt($('inp-low-reps').value, 10) || 0);
    highReps = Math.max(0, parseInt($('inp-high-reps').value, 10) || 0);
    stood = $('inp-stood').value;
    const depthAttempts = ex.testAttempt ? 1 : reps;
    if (lowReps + highReps !== depthAttempts) { alert('Below-parallel plus high catches must equal reps attempted.'); return; }
    if (!stood) { alert('Record whether every rep was stood completely.'); return; }
    if (tracksQuality && (highReps > 0 || stood === 'no') && (outcome !== 'miss' || grade !== 'C')) {
      alert('A high or unstood receiving-test attempt must be logged as a C-grade miss.');
      return;
    }
  }

  const key = `${si}_${ex.slotKey || exId}`;
  if (!STATE.activeWorkout.setsLogged[key]) STATE.activeWorkout.setsLogged[key] = [];
  const qualityPosition = tracksQuality
    ? nextQualityAttempt(ex, STATE.activeWorkout.setsLogged[key]) : null;

  const liftKey = ex.baseLift || exDef.baseLift || (ex.recvKey ? 'clean' : null);
  const tm = liftKey ? STATE.activeWorkout.tmSnapshot[liftKey] : null;
  const setObj = {
    exId, slotKey: ex.slotKey || exId, liftKey,
    weight, reps, seconds, bodyweight, rir, rpe, note, ts: Date.now(),
    cycleId: STATE.activeWorkout.cycleId,
    blockId: STATE.activeWorkout.blockId,
    weekInBlock: STATE.activeWorkout.weekInBlock,
    programWeek: STATE.activeWorkout.programWeek,
    sessionId: STATE.activeWorkout.sessionId,
    prescribedPct: ex.pct ?? null,
    tmSnapshot: tm,
    actualPct: tm && weight > 0 ? Math.round(weight / tm * 1000) / 10 : null,
    retryOverride: !!retryOverrideActive,
    testAttempt: !!ex.testAttempt,
    testPrescription: ex.testPrescription || null,
    qualityAnalytics: !ex.testAttempt || ['snatch', 'cj', 'jerk', 'clean'].includes(liftKey),
  };
  if (tracksQuality) Object.assign(setObj, { outcome, grade, missDirection: outcome === 'miss' ? missDirection : '', missStage: outcome === 'miss' ? missStage : '' });
  if (qualityPosition) Object.assign(setObj, qualityPosition);
  if (tracksDepth) Object.assign(setObj, {
    lowReps, highReps, stood: stood === 'yes',
    technicalMiss: highReps > 0 || stood !== 'yes',
  });
  STATE.activeWorkout.setsLogged[key].push(setObj);

  // A high catch changes only the next attempt in this session. It never lowers
  // the following week's baseline; settlement at session end will simply hold.
  if (tracksDepth && (highReps > 0 || stood === 'no')) {
    const repeatWeight = Math.max(0, weight - 10);
    STATE.activeWorkout.loadOverrides[activeSlotKey] = repeatWeight;
    if (ex.recvKey) STATE.activeWorkout.receivingOverrides[ex.recvKey] = repeatWeight;
    toast(`${PROGRAM.exercises[ex.id].name}: repeat at ${fmtWeight(repeatWeight)}.`);
  } else if (retryOverrideActive) {
    delete STATE.activeWorkout.loadOverrides[activeSlotKey];
    if (ex.recvKey) delete STATE.activeWorkout.receivingOverrides[ex.recvKey];
  }

  // Track hypertrophy progression
  if (!timedSets && ex.repRange && (exDef.type === 'hypertrophy' || !ex.pct)) {
    const totalSets = ex.sets || 3;
    recordHypertrophySet(ex, weight, reps, ex.repRange, totalSets, rir);
  }

  const stopReason = exerciseStopReason(STATE.activeWorkout.setsLogged[key]);
  if (stopReason) {
    STATE.activeWorkout.stoppedExercises[key] = stopReason;
    delete STATE.activeWorkout.loadOverrides[activeSlotKey];
    if (ex.recvKey) delete STATE.activeWorkout.receivingOverrides[ex.recvKey];
    toast(stopReason);
  } else if (outcome === 'miss' && !setObj.technicalMiss) {
    toast('First miss: rest fully; repeat once, or reduce 2.5–5% if fatigue clearly caused it.');
  }

  // Auto-start rest timer unless the exercise has just been ended.
  const atSetBoundary = !tracksQuality || qualityAttemptEndsSet(ex, setObj);
  const completedWork = tracksQuality
    ? completedQualitySets(ex, STATE.activeWorkout.setsLogged[key])
    : STATE.activeWorkout.setsLogged[key].length;
  const retryableMiss = outcome === 'miss' || setObj.technicalMiss;
  const moreWorkRemains = ex.isDailyMax || ex.isMaxEffort || !ex.sets
    || completedWork < ex.sets || retryableMiss;
  if (ex.rest > 0 && !stopReason && atSetBoundary && moreWorkRemains) startRestTimer(ex.rest);

  save(); // persist the logged set (startRestTimer also saves, but not every set rests)
  closeModal();
  renderWorkout();
}

// ─── Training-max policy ──────────────────────────────────────────────────────
// TMs are LOCKED for the whole 13-week block. A well-programmed single at 85%
// *should* feel below RPE 8 — that is the design, not evidence the max is wrong.
// Raising the denominator on that basis inflates every percentage until the
// ladder stops meaning anything.
//
// The one bounded exception: three CONSECUTIVE scheduled non-deload top-single
// exposures at >=85%, every prescribed attempt made, graded A and RPE <=7,
// earns +5 lb once per lift and cycle. Anything
// short of that streak resets the counter.
const TM_EXC = { minPct: 85, maxRpe: 7, streak: 3, bump: 5 };

function settleTmException(day) {
  if (!day?.sections || [2, 4, 6, 7].includes(STATE.activeWorkout?.blockId)) return [];
  const msgs = [];
  day.sections.forEach((sec, si) => sec.exercises.forEach(ex => {
    const def = PROGRAM.exercises[ex.id];
    if (!def || def.type !== 'oly' || ex.optionalTopSingle || ex.pct < TM_EXC.minPct) return;
    if (![1, '1+1'].includes(ex.reps)) return;
    const lift = ex.baseLift;
    if (!lift || !STATE.maxes[lift]) return;
    const key = `${si}_${ex.slotKey || ex.id}`;
    const sets = STATE.activeWorkout.setsLogged[key] || [];
    const exposureKey = `${STATE.activeWorkout.cycleId}:${STATE.activeWorkout.programWeek}:${lift}`;
    const watch = STATE.tmWatch[lift] || { streak: 0, bumped: false, lastExposureKey: null };
    if (watch.lastExposureKey === exposureKey) return;
    watch.lastExposureKey = exposureKey;
    const prescribed = sets.slice(0, ex.sets || sets.length);
    const qualifies = prescribed.length >= (ex.sets || 1)
      && prescribed.every(s => s.outcome === 'make' && s.grade === 'A'
        && Number(s.rpe) <= TM_EXC.maxRpe && Number(s.actualPct) >= TM_EXC.minPct);
    watch.streak = qualifies ? watch.streak + 1 : 0;
    if (watch.streak >= TM_EXC.streak && !watch.bumped) {
      STATE.maxes[lift] += TM_EXC.bump;
      watch.bumped = true;
      watch.streak = 0;
      msgs.push(`${PROGRAM.liftNames[lift]} TM +${TM_EXC.bump} lb → ${fmtWeight(STATE.maxes[lift])}. This lift's one bounded exception is now used for cycle ${STATE.activeWorkout.cycleId}.`);
    }
    STATE.tmWatch[lift] = watch;
  }));
  return msgs;
}

// ─── Receiving-load gate ──────────────────────────────────────────────────────
// The high-hang clean and the received clean progress on CATCH QUALITY, not a
// percentage. +5 lb only when the complete prescribed rep count passes. A high
// catch causes an immediate in-session repeat 10 lb lower but next week's
// baseline holds; it is never automatically reduced here.
function settleReceiving(day) {
  if (!day || !day.sections) return [];
  const msgs = [];
  day.sections.forEach((sec, si) => sec.exercises.forEach(ex => {
    if (!ex.recvKey) return;
    const sets = (STATE.activeWorkout.setsLogged[`${si}_${ex.slotKey || ex.id}`]) || [];
    if (!sets.length) return;
    // Deloads and the taper hold the load — no progression either way.
    if ([2, 4, 6].includes(STATE.activeWorkout?.blockId)) {
      msgs.push(`${PROGRAM.exercises[ex.id].name}: load held (deload/taper).`);
      return;
    }
    const def = PROGRAM.receiving[ex.recvKey];
    const before = PROGRAM.recvWeight(STATE.receiving, ex.recvKey);
    if (!STATE.receiving) STATE.receiving = {};
    if (!STATE.receivingMeta) STATE.receivingMeta = {};
    const meta = STATE.receivingMeta[ex.recvKey] || { stalls: 0, lastExposureKey: null };
    const exposureKey = `${STATE.activeWorkout.cycleId}:${STATE.activeWorkout.programWeek}:${ex.recvKey}`;
    if (meta.lastExposureKey === exposureKey) return;
    meta.lastExposureKey = exposureKey;
    const expected = def.requiredReps;
    const completed = sets.reduce((n, s) => n + (Number(s.reps) || 0), 0);
    const low = sets.reduce((n, s) => n + (Number(s.lowReps) || 0), 0);
    const high = sets.reduce((n, s) => n + (Number(s.highReps) || 0), 0);
    const allStood = sets.every(s => s.stood === true);
    const relaxed = meta.stalls >= 3;
    const progressionLoadEligible = completed >= expected
      && sets.every(s => Number(s.weight) >= before);
    const stallLoadEligible = completed >= expected
      && sets.every(s => Number(s.weight) >= before || s.retryOverride === true);
    const passed = progressionLoadEligible && low >= expected - (relaxed ? 1 : 0)
      && high <= (relaxed ? 1 : 0) && allStood;
    if (passed) {
      STATE.receiving[ex.recvKey] = Math.min(before + def.step, def.cap);
      meta.stalls = 0;
      const after = STATE.receiving[ex.recvKey];
      msgs.push(after > before
        ? `${def.name}: gate passed${relaxed ? ' under the all-but-one rule' : ''} → ${fmtWeight(after)} next week.`
        : `${def.name}: at the ${fmtWeight(def.cap)} cap — hold.`);
    } else {
      if (stallLoadEligible) meta.stalls += 1;
      const why = completed < expected ? `${completed}/${expected} prescribed reps logged`
        : !stallLoadEligible ? `one or more voluntarily loaded reps were below the ${fmtWeight(before)} stored baseline`
          : `${high} high catch(es) or an incomplete stand`;
      msgs.push(`${def.name}: ${why} → baseline holds at ${fmtWeight(before)}.${meta.stalls >= 3 ? ' Next exposure may use the documented all-but-one gate.' : ''}`);
    }
    STATE.receivingMeta[ex.recvKey] = meta;
  }));
  return msgs;
}

function settleHighHangSnatch(day) {
  if (STATE.activeWorkout?.blockId !== 5 || STATE.activeWorkout?.readiness !== 'green' || !day?.sections) return [];
  let message = '';
  day.sections.forEach((sec, si) => sec.exercises.forEach(ex => {
    if (ex.id !== 'hh_snatch' || !ex.qualityCeiling) return;
    const exposureKey = `${STATE.activeWorkout.cycleId}:${STATE.activeWorkout.programWeek}:hh_snatch`;
    if (STATE.technicalProgress.lastExposureKey === exposureKey) return;
    const sets = STATE.activeWorkout.setsLogged[`${si}_${ex.slotKey || ex.id}`] || [];
    if (!sets.length) return;
    STATE.technicalProgress.lastExposureKey = exposureKey;
    const completed = sets.reduce((n, s) => n + (Number(s.reps) || 0), 0);
    const scheduled = prescribedWeight(ex, true);
    const loadEligible = scheduled != null && sets.every(s => Number(s.weight) >= scheduled);
    const passed = completed >= 8
      && sets.reduce((n, s) => n + (Number(s.lowReps) || 0), 0) >= 8
      && sets.every(s => !s.highReps && s.stood === true) && loadEligible;
    const before = Number(STATE.technicalProgress.hhSnatchPct) || 65;
    if (passed) STATE.technicalProgress.hhSnatchPct = Math.min(70, before + 2.5);
    message = passed
      ? `High-hang snatch gate passed → ${STATE.technicalProgress.hhSnatchPct}% next exposure (70% cap).`
      : `High-hang snatch quality/load gate not passed → hold ${before}%.`;
  }));
  return message ? [message] : [];
}

function settleCopenhagen(day) {
  if ([2, 4, 6, 7].includes(STATE.activeWorkout?.blockId) || !day?.sections) return [];
  let message = '';
  day.sections.forEach((sec, si) => sec.exercises.forEach(ex => {
    if (ex.id !== 'copenhagen') return;
    const exposureKey = `${STATE.activeWorkout.cycleId}:${STATE.activeWorkout.programWeek}:copenhagen`;
    if (STATE.copenhagen.lastExposureKey === exposureKey) return;
    const sets = STATE.activeWorkout.setsLogged[`${si}_${ex.slotKey || ex.id}`] || [];
    if (!sets.length) return;
    STATE.copenhagen.lastExposureKey = exposureKey;
    const step = Math.min(5, Math.max(1, Number(STATE.copenhagen.step) || 1));
    const target = PROGRAM.copenhagenSteps[step].targetSec;
    if (step < 5 && sets.length >= 2 && sets.slice(0, 2).every(s => Number(s.seconds) >= target)) {
      STATE.copenhagen.step = step + 1;
      message = `Copenhagen cleared on both sides → advance to step ${STATE.copenhagen.step}.`;
    } else if (step < 5) {
      message = `Copenhagen holds at step ${step}; clear both work sets at ${target}s/side to advance.`;
    }
  }));
  return message ? [message] : [];
}

// A-rate at a given percentage band, read across a whole block rather than
// week to week — it moves with fatigue and your own standard tightens over time.
function allLoggedSets() {
  return Object.values(STATE.log).flatMap(d => Object.values(d.setsLogged || {}).flat());
}

function aRate(sinceDays) {
  const cutoff = Date.now() - (sinceDays || 28) * 864e5;
  const attempts = allLoggedSets().filter(s => s.grade && s.qualityAnalytics !== false && Number(s.ts) >= cutoff);
  const a = attempts.filter(s => s.grade === 'A').length;
  const misses = attempts.filter(s => s.outcome === 'miss').length;
  return {
    attempts: attempts.length,
    aRate: attempts.length ? Math.round(a / attempts.length * 100) : null,
    missRate: attempts.length ? Math.round(misses / attempts.length * 100) : null,
  };
}

function qualityAnalytics() {
  const groups = new Map();
  allLoggedSets().forEach(s => {
    if (!s.grade || !s.liftKey || s.actualPct == null || s.qualityAnalytics === false) return;
    const pctBand = Math.round(Number(s.actualPct) / 2.5) * 2.5;
    const cycleId = Number(s.cycleId) || 1;
    const blockId = Number(s.blockId) || 0;
    const key = `${cycleId}|${blockId}|${s.liftKey}|${pctBand}`;
    if (!groups.has(key)) groups.set(key, {
      cycleId, blockId, liftKey: s.liftKey, pctBand,
      attempts: 0, a: 0, b: 0, c: 0, misses: 0,
      directions: { forward: 0, backward: 0, other: 0 },
    });
    const g = groups.get(key);
    g.attempts += 1;
    g[s.grade.toLowerCase()] += 1;
    if (s.outcome === 'miss') {
      g.misses += 1;
      g.directions[s.missDirection] = (g.directions[s.missDirection] || 0) + 1;
    }
  });
  return [...groups.values()].map(g => ({
    ...g,
    aRate: Math.round(g.a / g.attempts * 100),
    missRate: Math.round(g.misses / g.attempts * 100),
  })).sort((x, y) => y.cycleId - x.cycleId || y.blockId - x.blockId
    || x.liftKey.localeCompare(y.liftKey) || x.pctBand - y.pctBand);
}

function renderQualityAnalytics() {
  const groups = qualityAnalytics();
  if (!groups.length) return '<div class="empty-state">Grade competition attempts to populate block-level quality data.</div>';
  return `<div class="quality-grid">${groups.slice(0, 30).map(g => {
    const directions = Object.entries(g.directions).filter(([, n]) => n).map(([d, n]) => `${d} ${n}`).join(' · ');
    return `<div class="quality-card">
      <div class="quality-title">C${g.cycleId} · B${g.blockId} · ${escapeHtml(PROGRAM.liftNames[g.liftKey] || g.liftKey)} · ${g.pctBand}%</div>
      <div class="quality-stats"><b>${g.aRate}% A</b><b>${g.missRate}% missed</b><span>${g.attempts} attempts</span></div>
      <div class="quality-grades">A ${g.a} · B ${g.b} · C ${g.c}${directions ? ` · misses: ${directions}` : ''}</div>
    </div>`;
  }).join('')}</div>`;
}

// Lightweight transient toast (self-contained styles so it needs no CSS).
function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);'
    + 'z-index:9999;background:var(--gold);color:#0f0f0f;font-weight:700;'
    + 'padding:12px 18px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.45);'
    + 'max-width:88%;text-align:center;font-size:15px;line-height:1.35;';
  document.body.appendChild(t);
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 3200);
  setTimeout(() => t.remove(), 3700);
}

function endWorkout() {
  if (!STATE.activeWorkout) { nav('home'); return; }
  if (!confirm('End this workout and save it?')) return;

  // Save session to log
  const workout = STATE.activeWorkout;
  const { date, dayKey, day, setsLogged } = workout;
  const sessionSec = STATE.sessionTimer.active
    ? Math.floor((Date.now() - STATE.sessionTimer.start) / 1000) : 0;

  const policyMsgs = [
    ...settleTmException(day),
    ...settleReceiving(day),
    ...settleHighHangSnatch(day),
    ...settleCopenhagen(day),
  ];

  // Every separately timed AM/PM/cardio session gets its own immutable key.
  const logKey = workout.id;
  const testSource = workout.testResultsSnapshot || STATE.testResults;
  const sessionTestResults = day.isTesting ? Object.fromEntries((day.lifts || [])
    .map(lift => [lift.lift, testSource[lift.lift]])
    .filter(([, result]) => result)) : null;
  STATE.log[logKey] = {
    date,
    completedAt: Date.now(),
    dayKey,
    sessionId: workout.sessionId,
    kind: day.kind || 'lifting',
    title: day.title,
    cycleId: workout.cycleId,
    blockId: workout.blockId,
    weekInBlock: workout.weekInBlock,
    programWeek: workout.programWeek,
    readiness: workout.readiness,
    pickupDays: workout.pickupDays,
    tmSnapshot: workout.tmSnapshot,
    testResults: sessionTestResults,
    setsLogged,
    sessionMin: Math.round(sessionSec / 60),
  };

  // Evaluate double-progression for next session, then clear the live set tracker.
  finalizeHypertrophyProgression();

  stopSessionTimer();
  releaseWakeLock();
  clearRestTimer();
  stopIntervalTimer(); // never leave the VO₂max interval engine running past a session
  STATE.activeWorkout = null;
  save();

  alert(`Workout saved! Session: ${Math.round(sessionSec / 60)} min`
    + (policyMsgs.length ? '\n\n' + policyMsgs.join('\n') : ''));
  nav('home');
}

// ─── Render: History ──────────────────────────────────────────────────────────
function renderHistory() {
  const app = $('app');
  const entries = Object.entries(STATE.log).sort(([, a], [, b]) =>
    (Number(b.completedAt) || Date.parse(b.date || 0)) - (Number(a.completedAt) || Date.parse(a.date || 0)));

  app.innerHTML = `
    <div class="page history-page">
      <div class="page-title">History</div>
      ${entries.length === 0 ? '<div class="empty-state">No sessions logged yet.</div>' : ''}
      ${entries.map(([d, s]) => {
        const totalSets = Object.values(s.setsLogged || {}).reduce((a,b) => a + b.length, 0);
        const testCount = Object.keys(s.testResults || {}).length;
        return `
          <div class="history-card" onclick="toggleHistoryDetail('${d}')">
            <div class="history-date">${escapeHtml(s.date || d.split('#')[0])}</div>
            <div class="history-day">${escapeHtml(s.title || s.dayKey)}${s.sessionId ? ` · ${escapeHtml(s.sessionId)}` : ''}</div>
            <div class="history-meta">${testCount ? `${testCount} test result${testCount === 1 ? '' : 's'}` : `${totalSets} logged set${totalSets === 1 ? '' : 's'}`} · ${s.sessionMin || '?'} min${s.programWeek ? ` · C${s.cycleId || 1} W${s.programWeek}` : ''}</div>
            <div class="history-detail hidden" id="hd-${d}">
              ${renderHistoryDetail(s)}
            </div>
          </div>`;
      }).join('')}

      <div class="history-lifts">
        <div class="page-subtitle">Competition Quality by Block &amp; %TM</div>
        ${renderQualityAnalytics()}
      </div>

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
  const tests = Object.entries(session.testResults || {}).map(([lift, result]) => `
    <div class="hd-ex"><div class="hd-ex-name">${escapeHtml(PROGRAM.liftNames[lift] || lift)}</div>
      <div class="logged-set"><span class="set-weight">${fmtWeight(result.rawWeight)}</span>
        ${result.rpe ? `<span class="set-rir">Double @ RPE ${result.rpe}</span>` : '<span class="set-rir">Made 1RM</span>'}
        <span class="set-depth">TM ${fmtWeight(result.estimated1rm)}</span>
      </div>
    </div>`).join('');
  const setsHtml = Object.entries(session.setsLogged || {}).map(([key, sets]) => {
    const exId = sets[0]?.exId || key.split('_').slice(1).join('_');
    const exDef = PROGRAM.exercises[exId];
    if (!exDef) return '';
    return `<div class="hd-ex">
      <div class="hd-ex-name">${exDef.name}</div>
      ${sets.map((s,i) => renderLoggedSet(s, i)).join('')}
    </div>`;
  }).join('');
  return tests + setsHtml;
}

function renderExerciseHistory() {
  // Find exercises that have been logged
  const exWeights = {}; // exId → [{date, weight, reps}]
  Object.entries(STATE.log).forEach(([date, session]) => {
    if (!session.setsLogged) return;
    Object.entries(session.setsLogged).forEach(([key, sets]) => {
      const exId = sets[0]?.exId || key.split('_').slice(1).join('_');
      const successful = sets.filter(s => s.outcome !== 'miss' && !s.technicalMiss);
      const heaviest = successful.reduce((best, s) => (!best || (s.weight || 0) > (best.weight || 0)) ? s : best, null);
      if (!heaviest) return;
      if (!exWeights[exId]) exWeights[exId] = [];
      if (heaviest) exWeights[exId].push({ date: session.date || date, weight: heaviest.weight, reps: heaviest.reps });
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
      <div class="ex-history-best">Best successful load: ${fmtWeight(maxW)}</div>
    </div>`;
  }).join('');
}

// ─── Render: Guide ────────────────────────────────────────────────────────────
function renderGuide() {
  const app = $('app');
  const sec = (title, body) => `<details class="guide-sec"><summary class="guide-sum">${title}</summary><div class="guide-body">${body}</div></details>`;
  app.innerHTML = `
    <div class="page guide-page">
      <div class="page-title">Program Guide</div>
      <div class="guide-intro"><b>Priority order:</b> Olympic weightlifting → hypertrophy → athleticism → longevity. The schedule tab is the executable prescription; this guide contains the rules that change how it is performed.</div>

      ${sec('Cycle architecture', `
        <ul class="guide-ul">
          <li><b>Weeks 1–3:</b> accumulation; accessory sets ramp ~70% → 85% → 100% and RIR waves 3 → 2 → 1.</li>
          <li><b>Week 4:</b> deload; roughly half sets, 60–70% barbell work, half field volume at full intent, easy cycling.</li>
          <li><b>Weeks 5–7:</b> intensification; accessories restart at ~85%, then full.</li>
          <li><b>Week 8:</b> deload.</li>
          <li><b>Weeks 9–11:</b> realization; week 11 reaches 90%, with one optional 92.5% single only after pristine required singles.</li>
          <li><b>Week 12:</b> taper; no accessories, field work, or intervals.</li>
          <li><b>Week 13:</b> seven tests across four days. Apply all seven together to start the next cycle.</li>
        </ul>`) }

      ${sec('Execution & miss policy', `
        <ul class="guide-ul">
          <li>The written percentage is a ceiling. Drop 5–10% whenever technique misses the required standard.</li>
          <li>Competition snatch/C&amp;J may be caught high and still count. Receiving drills must be caught below parallel, paused when prescribed, and stood completely.</li>
          <li>Grade every competition attempt immediately: <b>A</b> solid; <b>B</b> made with a chase/drift; <b>C</b> miss or technically poor make.</li>
          <li>After one miss, rest fully and repeat once, or reduce 2.5–5% if fatigue clearly caused it. Two misses or two consecutive C-grade makes end that exercise. Never make up missed reps.</li>
          <li>Heavy singles normally remain RPE 7–8.5. No squat, RDL, row, pull-up, bench, or Nordic grinding.</li>
        </ul>`) }

      ${sec('Training maxes & receiving gates', `
        <p>TMs stay locked through week 12. The only exception is +5 lb once per lift per cycle after three consecutive eligible ≥85% top-single exposures where every prescribed attempt is made, A-grade, and RPE ≤7.</p>
        <p>Wednesday high-hang clean advances 5 lb only after all eight catches are low and stood; Friday received clean requires all three. High catches lower only the next attempt by 10 lb and never lower the stored baseline. After three complete failed exposures, the documented all-but-one gate becomes available.</p>
        <p>Read A-rate and miss rate at the same %TM across a whole block, not week to week. The History tab groups those measures correctly and keeps C-grade makes separate from misses.</p>`) }

      ${sec('Hypertrophy progression', `
        <p>Use controlled full ROM, about a two-second eccentric, and maximal safe concentric intent. Double progression requires every work set to reach the top of its range while meeting the assigned RIR; then add the smallest increment.</p>
        <p>Only the last set of a stable isolation may reach 0 RIR. Never take competition lifts, squats, RDLs, Nordics, bench, rows, or pull-ups to failure. If a priority muscle stalls for three weeks with good adherence and recovery, add two weekly sets. If Olympic quality or joint comfort declines, remove 2–4 accessory sets first.</p>`) }

      ${sec('Warm-ups & rest', `
        <p><b>Lifting:</b> raise 3–5 min, do only needed positional work, then two day-specific empty-bar rounds. Barbell ramp: 40%×3 · 50%×3 · 60%×2 · 70%×1 as needed · one feeder single between 75% and the working load on heavy days. Ramp sets never count as work sets.</p>
        <p><b>Other work:</b> first press 50%×5 and 75%×3; later incline exposures one 60%×5; rows/pull-ups one 60%×6; first isolation for a muscle one 12–15-rep half-load set; Nordic, Copenhagen, and RDL one light set.</p>
        <p><b>Field:</b> complete the listed ten-minute movement and acceleration warm-up before maximal work. Rest 2–5 min according to performance quality.</p>
        <p>Rest 3–5 min for heavy singles and major strength work, 2–4 min for doubles/complexes, 2–3 min for compound accessories, and 75–120 s for isolation.</p>`) }

      ${sec('Readiness & pickup', `
        <p><b>Green:</b> ≥7 h sleep, morning HR within about 5 bpm of baseline, no illness or unusual pain, and a normal warm-up — full prescription.</p>
        <p><b>Yellow:</b> any one of 5–7 h sleep, HR 6–10 bpm above baseline, unusual soreness, intense sport in the last 24 h, or clear warm-up underperformance — main loads ×0.95, work sets/rounds −20–30%, optional tops omitted.</p>
        <p><b>Red:</b> &lt;5 h sleep, HR &gt;10 bpm above baseline with poor symptoms, illness, dizziness, altered coordination, or pain that changes movement — rest, or optional technique ≤60% only with normal coordination.</p>
        <p>Record pickup day and same-day timing in Settings. The app applies the full matrix: Monday/Tuesday replaces Tuesday field; Wednesday/Thursday replaces Thursday field; Wednesday/Friday/Saturday replaces intervals; same-day pickup after lifting removes lower isolation, while pickup before lifting removes heavy lower work and caps Olympic technique at 70%.</p>
        <p>Never make up omitted field work and never place sprints or jumps within 24 hours of a game.</p>`) }

      ${sec('Field, conditioning & placement', `
        <p>Tuesday field work progresses foundation → reactive → mixed across the three loading blocks. Thursday progresses accelerations/sled → flying 20s → 30 m maximum-velocity work. Keep field and lifting separated by at least six hours; if impossible, lift first and halve field volume.</p>
        <p>Wednesday Zone 2 is 30–40 min easy cycling, separated at least six hours. Saturday intervals include a 12-minute progressive warm-up and 8-minute spin-down; work is 4×3 min in weeks 1–3 and 4×4 min in weeks 5–11, but remains 4×3 on a cut.</p>`) }

      ${sec('When to rebuild the program', `
        <p>Keep the principal exercise pool for the full 13-week cycle. Review correctives every four weeks, changing one only if it has produced no change. Rebuild after week 13 from the seven test results, or earlier only for a real constraint change, injury, persistent readiness/quality decline, or a clearly documented programming failure.</p>`) }
    </div>`;
}

function renderSettings() {
  const app = $('app');
  const { blockId, weekInBlock } = STATE.program;
  const block = PROGRAM.blocks.find(b => b.id === blockId);
  const cStep = PROGRAM.copenhagenSteps[STATE.copenhagen.step] || PROGRAM.copenhagenSteps[1];
  const readiness = effectiveReadiness();
  const pickupDays = activePickupDays();
  const pickupTiming = activePickupTiming();
  app.innerHTML = `
    <div class="page settings-page">
      <div class="page-title">Settings</div>

      <div class="settings-section">
        <div class="settings-label">Training Phase</div>
        <div class="phase-toggle">
          <button class="phase-btn ${!STATE.cutting ? 'phase-btn-active' : ''}" onclick="setCutting(false)"><div class="phase-btn-title">Gain</div><div class="phase-btn-sub">Full prescribed volume</div></button>
          <button class="phase-btn ${STATE.cutting ? 'phase-btn-active phase-btn-cut' : ''}" onclick="setCutting(true)"><div class="phase-btn-title">Cut</div><div class="phase-btn-sub">C-column volume</div></button>
        </div>
        <div class="settings-note">${STATE.cutting ? 'C-column accessory/squat sets, 87.5% top-intensity cap, and 4×3-minute intervals. Competition-lift frequency, field work, and hamstring volume stay intact.' : 'Gain phase: full G-column sets and the complete intensity ladder.'}</div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Readiness Today</div>
        <div class="readiness-toggle">
          ${['green','yellow','red'].map(r => `<button class="readiness-btn readiness-${r} ${readiness === r ? 'active' : ''}" onclick="setReadiness('${r}')">${r.toUpperCase()}</button>`).join('')}
        </div>
        <div class="settings-note">${readiness === 'green'
          ? 'Green: ≥7 h sleep, morning HR within ~5 bpm of baseline, no illness or unusual pain, and a normal warm-up — full prescription.'
          : readiness === 'yellow'
            ? 'Yellow if ANY ONE applies: 5–7 h sleep, HR 6–10 bpm high, unusual soreness, intense sport within 24 h, or clear warm-up underperformance. Loads −5%, work sets/rounds −20–30%, optional tops omitted.'
            : 'Red if <5 h sleep, HR >10 bpm high with poor symptoms, illness, dizziness, altered coordination, or pain changes movement. No heavy lifting, squats, field work, conditioning, or tests; optional technique ≤60% only with normal coordination.'} This selection resets to Green on the next calendar day.</div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Pickup This Program Week</div>
        <div class="pickup-days">${PROGRAM.dayKeys.map((d, i) => `<button class="pickup-day ${pickupDays.includes(d) ? 'active' : ''}" onclick="togglePickup('${d}')">${PROGRAM.dayNames[i].slice(0,3)}</button>`).join('')}</div>
        ${pickupDays.map(d => `<div class="pickup-timing"><label>${PROGRAM.dayNames[PROGRAM.dayKeys.indexOf(d)]}</label><select class="form-input" onchange="setPickupTiming('${d}', this.value)">
          <option value="" ${!pickupTiming[d] ? 'selected' : ''}>No same-day lifting / unknown</option>
          <option value="after" ${pickupTiming[d] === 'after' ? 'selected' : ''}>Pickup after lifting</option>
          <option value="before" ${pickupTiming[d] === 'before' ? 'selected' : ''}>Pickup before lifting</option>
        </select></div>`).join('')}
        <div class="settings-note">The schedule updates immediately from the seven-day contingency matrix. Two pickup sessions remove intervals and at least one field exposure. Entries reset when the program week changes.</div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Copenhagen Progression</div>
        <div class="copenhagen-status"><b>Step ${STATE.copenhagen.step}</b> · ${cStep.label} · ${cStep.duration}</div>
        <div class="step-actions"><button class="btn-outline" onclick="setCopenhagenStep(${STATE.copenhagen.step - 1})" ${STATE.copenhagen.step <= 1 ? 'disabled' : ''}>← Previous</button><button class="btn-outline" onclick="setCopenhagenStep(${STATE.copenhagen.step + 1})" ${STATE.copenhagen.step >= 5 ? 'disabled' : ''}>Next →</button></div>
        ${STATE.copenhagen.step === 5 ? `<label class="form-label">Dumbbell on top hip (lb)</label><input class="form-input" type="number" step="2.5" min="0" value="${STATE.copenhagen.load || 0}" onchange="updateCopenhagenLoad(this.value)">` : ''}
        <div class="settings-note">The app auto-advances steps 1–4 after both work sets clear the target on both sides. Manual controls let you correct the state.</div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Training Maxes (lb)</div>
        <div class="maxes-grid">${Object.entries(PROGRAM.liftNames).map(([k, name]) => `<div class="max-row"><label class="max-label">${name}</label><input type="number" id="max-${k}" class="max-input" value="${STATE.maxes[k] || ''}" inputmode="decimal" step="2.5" onchange="updateMax('${k}', this.value)"><span class="max-unit">lb</span></div>`).join('')}</div>
        <div class="settings-note">All seven are required. They remain locked through week 12 apart from the bounded A-grade exception; week 13 stages and applies the next set together.</div>
      </div>

      <div class="settings-section">
        <div class="settings-label">Program Position</div>
        <div class="program-pos"><label class="form-label">Block</label><select id="sel-block" class="form-input" onchange="updateBlock(this.value)">${PROGRAM.blocks.map(b => `<option value="${b.id}" ${b.id === blockId ? 'selected' : ''}>${b.name}</option>`).join('')}</select><label class="form-label">Week within block (1–${block?.weeks || 1})</label><input type="number" id="inp-week" class="form-input" min="1" max="${block?.weeks || 1}" value="${weekInBlock + 1}" onchange="updateWeek(this.value)"></div>
        <div class="settings-note">Cycle ${STATE.cycleId} · Program week ${block ? block.startWeek + weekInBlock : '?'}. Manual navigation does not create a new cycle; applying all seven week-13 tests does.</div>
      </div>

      ${typeof syncSettingsHTML === 'function' ? syncSettingsHTML() : ''}
      <div class="settings-section"><div class="settings-label">Data</div><button class="btn-outline btn-full" onclick="exportData()">Export Backup (JSON)</button><button class="btn-outline btn-full" style="margin-top:8px" onclick="$('import-input').click()">Import Backup</button><input type="file" id="import-input" accept=".json" class="hidden" onchange="importData(this)"><button class="btn-danger-outline btn-full" style="margin-top:8px" onclick="clearAllData()">Clear All Data</button></div>
    </div>`;
}

function updateMax(lift, val) {
  // Guard the free-text input: the whole program prescribes off these numbers,
  // so a blank, a typo ('16o' parses as 16), or a negative must never land.
  const n = Number(String(val).trim());
  if (!Number.isFinite(n) || n <= 0 || n > 1000) {
    if (typeof document !== 'undefined') {
      toast(`${PROGRAM.liftNames[lift] || lift} unchanged — enter a positive weight.`);
      renderSettings(); // snap the field back to the stored value
    }
    return;
  }
  STATE.maxes[lift] = Math.round(n / 2.5) * 2.5;
  save();
  if (typeof document !== 'undefined') renderSettings();
}

function updateBlock(val) {
  const id = parseInt(val, 10);
  if (!PROGRAM.blocks.some(b => b.id === id)) return;
  STATE.program.blockId = id;
  STATE.program.weekInBlock = 0;
  resetPickupContext();
  save();
  renderSettings();
}

function setCutting(on) {
  STATE.cutting = !!on;
  save();
  renderSettings();
}

function setReadiness(level) {
  if (!['green', 'yellow', 'red'].includes(level)) return;
  STATE.readiness = level;
  STATE.readinessDate = today();
  save();
  renderSettings();
}

function togglePickup(dayKey) {
  if (!PROGRAM.dayKeys.includes(dayKey)) return;
  if (STATE.pickupWeekKey !== currentPickupWeekKey()) resetPickupContext();
  if (STATE.pickupDays.includes(dayKey)) {
    STATE.pickupDays = STATE.pickupDays.filter(d => d !== dayKey);
    delete STATE.pickupTiming[dayKey];
  } else {
    STATE.pickupDays.push(dayKey);
    STATE.pickupDays.sort((a, b) => PROGRAM.dayKeys.indexOf(a) - PROGRAM.dayKeys.indexOf(b));
  }
  save();
  renderSettings();
}

function setPickupTiming(dayKey, timing) {
  if (STATE.pickupWeekKey !== currentPickupWeekKey()) resetPickupContext();
  if (!STATE.pickupDays.includes(dayKey)) return;
  if (['before', 'after'].includes(timing)) STATE.pickupTiming[dayKey] = timing;
  else delete STATE.pickupTiming[dayKey];
  save();
  renderSettings();
}

function setCopenhagenStep(step) {
  STATE.copenhagen.step = Math.min(5, Math.max(1, Number(step) || 1));
  STATE.copenhagen.lastExposureKey = null;
  save();
  renderSettings();
}

function updateCopenhagenLoad(value) {
  STATE.copenhagen.load = Math.max(0, Number(value) || 0);
  save();
  renderSettings();
}

function updateWeek(val) {
  const block = PROGRAM.blocks.find(b => b.id === STATE.program.blockId);
  const max = block?.weeks || 4;
  const wk = parseInt(val, 10);
  if (!Number.isFinite(wk)) return;
  STATE.program.weekInBlock = Math.min(Math.max(wk - 1, 0), max - 1);
  resetPickupContext();
  save();
  renderSettings();
}

function resetPickupContext() {
  STATE.pickupDays = [];
  STATE.pickupTiming = {};
  STATE.pickupWeekKey = currentPickupWeekKey();
}

function exportData() {
  const data = JSON.stringify({
    schemaVersion: STATE.schemaVersion,
    cycleId: STATE.cycleId,
    maxes: STATE.maxes,
    receiving: STATE.receiving,
    receivingMeta: STATE.receivingMeta,
    technicalProgress: STATE.technicalProgress,
    program: STATE.program,
    cutting: STATE.cutting,
    readiness: STATE.readiness,
    readinessDate: STATE.readinessDate,
    pickupDays: STATE.pickupDays,
    pickupTiming: STATE.pickupTiming,
    pickupWeekKey: STATE.pickupWeekKey,
    tmWatch: STATE.tmWatch,
    testResults: STATE.testResults,
    copenhagen: STATE.copenhagen,
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
  if (STATE.activeWorkout) {
    alert('Finish or end the active session before importing a backup.');
    input.value = '';
    return;
  }
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object' || !data.maxes) throw new Error('Invalid backup');
      applyDurableData(data);
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
  clearInterval(STATE.restTimer.interval);
  clearInterval(STATE.sessionTimer.interval);
  clearInterval(STATE.intervalTimer.interval);
  localStorage.removeItem('oly_state');
  Object.assign(STATE, {
    schemaVersion: 3,
    maxes: {snatch:155,cj:205,jerk:205,clean:255,bs:365,fs:275,bench:265},
    program: {blockId:1,weekInBlock:0}, cycleId: 1,
    receiving:{hh_clean:165,recv_clean:190},
    receivingMeta:{hh_clean:{stalls:0},recv_clean:{stalls:0}},
    technicalProgress:{hhSnatchPct:65,lastExposureKey:null},
    cutting: false, readiness: 'green', readinessDate: today(),
    pickupDays: [], pickupTiming: {}, pickupWeekKey: '1:1',
    tmWatch: {}, testResults: {}, copenhagen:{step:1,load:0,lastExposureKey:null},
    log: {}, hypertrophyWeights: {}, activeWorkout: null,
    restTimer:{active:false,end:0,prescribed:0,interval:null},
    sessionTimer:{active:false,start:0,interval:null},
    intervalTimer:{active:false,config:null,phases:[],phaseIdx:0,phaseEnd:0,paused:false,pauseRemaining:0,interval:null,lastCue:-1,startedAt:0},
    wakeLock:null,
  });
  save();
  nav('home');
}

// ─── Main render ──────────────────────────────────────────────────────────────
function render() {
  switch (STATE.view) {
    case 'home':    renderHome(); break;
    case 'workout': renderWorkout(); break;
    case 'history': renderHistory(); break;
    case 'guide':   renderGuide(); break;
    case 'settings': renderSettings(); break;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
  load();
  publishDayDurations(); // keep the shared duration snapshot fresh on every open
  // A session was restored from storage — land back in it, not on home.
  if (STATE.activeWorkout) STATE.view = 'workout';
  render();

  // Re-arm the timers for a restored session (after render so the overlay/DOM
  // nodes they update exist).
  if (STATE.activeWorkout) restoreRuntimeTimers();

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
      if (rem <= 0) restTimerDone();
    }
    // Re-sync the interval timer if phases elapsed while backgrounded
    if (document.visibilityState === 'visible' && STATE.intervalTimer.active) {
      catchUpIntervalTimer();
    }
    // iOS suspends the AudioContext on background/lock — resume so alarms sound
    if (document.visibilityState === 'visible' && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STATE,
    save,
    load,
    applyDurableData,
    programContext,
    effectiveReadiness,
    activePickupDays,
    prescribedWeight,
    recordHypertrophySet,
    finalizeHypertrophyProgression,
    exerciseStopReason,
    qualityAttemptsPerSet,
    qualityAttemptEndsSet,
    completedQualitySets,
    nextQualityAttempt,
    settleTmException,
    settleReceiving,
    settleHighHangSnatch,
    settleCopenhagen,
    updateMax,
    testResultsReady,
    hasMatchingTestAttempt,
    aRate,
    qualityAnalytics,
  };
}
