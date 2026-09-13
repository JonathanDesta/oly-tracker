'use strict';
let STATE = {
  ...MODEL.migrate(),
  view: 'home',
  selectedDay: PROGRAM.days[(new Date().getDay() + 6) % 7],
};
let modal = null,
  restTick = null,
  audioContext = null,
  wakeLock = null,
  toastTimeout = null;
const $ = (id) => document.getElementById(id);
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const dateISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmt = (n) => (Number(n) % 1 ? Number(n).toFixed(1) : String(n));
const time = (sec) =>
  `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, '0')}`;
const prettyDay = (day) => day[0].toUpperCase() + day.slice(1);
const info = () => PROGRAM.weekInfo(STATE.training.week);
const notice = (text) => `<div class="notice">${esc(text)}</div>`;
const button = (label, action, cls = 'button', disabled = false) =>
  `<button class="${cls}" onclick="${esc(action)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
function durable() {
  const { view, selectedDay, ...data } = STATE;
  return data;
}
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem('oly_state') || '{}');
    const backup = JSON.parse(localStorage.getItem('oly_rev6_backup') || 'null');
    const useBackup =
      backup?.revision === 6 &&
      (raw.revision !== 6 || (Number(backup.ts) || 0) > (Number(raw.ts) || 0));
    const data = useBackup ? backup : raw;
    if (Object.keys(raw).length && raw.revision !== 6 && !localStorage.getItem('oly_before_rev6'))
      localStorage.setItem('oly_before_rev6', JSON.stringify(raw));
    STATE = {
      ...MODEL.migrate(data),
      view: STATE.view || 'home',
      selectedDay: STATE.selectedDay || PROGRAM.days[(new Date().getDay() + 6) % 7],
    };
    if (STATE.activeWorkout) STATE.view = 'workout';
    return raw.revision !== 6 || useBackup;
  } catch (e) {
    toast('Could not load saved data. Existing storage has been left intact.');
    STATE.storageError = true;
  }
}
function save(markEdited = true) {
  if (STATE.storageError) return false;
  if (markEdited) STATE.pristine = false;
  STATE.ts = Date.now();
  try {
    const raw = JSON.stringify(durable());
    localStorage.setItem('oly_state', raw);
    // The older Day app can seed an old oly_state; retain the latest Rev 6 copy.
    localStorage.setItem('oly_rev6_backup', raw);
    publishDayDurations();
    if (typeof schedulePush === 'function') schedulePush();
    return true;
  } catch (e) {
    toast('Storage is full or unavailable. Export your data now; this change is not safely saved.');
    return false;
  }
}
function publishDayDurations() {
  try {
    const min = {},
      sessions = {};
    PROGRAM.days.forEach((day) => {
      const p = plan(day);
      sessions[day.slice(0, 3)] = p.sessions
        .filter((s) => !s.skipped)
        .map((s) => ({ id: s.id, kind: s.kind, minutes: s.totalMin }));
      min[day.slice(0, 3)] = sessions[day.slice(0, 3)].reduce((n, s) => n + s.minutes, 0);
    });
    localStorage.setItem(
      'oly_day_durations',
      JSON.stringify({
        v: 2,
        revision: 6,
        cycle: STATE.training.cycle,
        week: STATE.training.week,
        min,
        sessions,
        ts: STATE.ts,
      }),
    );
  } catch (e) {
    /* Non-critical companion-app snapshot. */
  }
}
function readiness() {
  return STATE.readiness?.date === dateISO()
    ? STATE.readiness
    : { date: dateISO(), level: 'green', event: 'normal', localIssue: '' };
}
function plan(day, actual = false) {
  const r = readiness(),
    use = actual || day === PROGRAM.days[(new Date().getDay() + 6) % 7];
  return PROGRAM.dayPlan(
    STATE.training,
    day,
    use
      ? {
          readiness: r.level,
          event: r.event,
          localIssue: r.localIssue,
          pivotResidual: r.pivotResidual,
        }
      : {},
  );
}
function recordsFor(day, id) {
  return STATE.records.filter(
    (r) =>
      r.cycle === STATE.training.cycle &&
      r.week === STATE.training.week &&
      r.exposure === STATE.training.exposure &&
      r.day === day &&
      r.session.id === id,
  );
}
function done(day, id) {
  return recordsFor(day, id).some((r) => r.status === 'complete');
}
function nav(view) {
  STATE.view = view;
  closeModal();
  render();
  $('app').scrollTop = 0;
}
function toast(text) {
  const box = $('toast');
  if (!box) return;
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => (box.hidden = true), 6500);
}
function render() {
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === STATE.view);
    b.setAttribute('aria-current', b.dataset.view === STATE.view ? 'page' : 'false');
  });
  $('app').innerHTML = (
    {
      home: renderHome,
      workout: renderWorkout,
      history: renderHistory,
      guide: renderGuide,
      settings: renderSettings,
    }[STATE.view] || renderHome
  )();
  tickTimers();
}
function header(kicker, title, sub = '') {
  return `<header class="page-head"><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</header>`;
}
function renderHome() {
  const t = STATE.training,
    p = plan(STATE.selectedDay),
    i = info();
  const total = PROGRAM.days.reduce(
    (n, d) =>
      n +
      plan(d)
        .sessions.filter((s) => !s.skipped)
        .flatMap((s) => s.rows)
        .filter((e) => e.kind === 'failure')
        .reduce((a, e) => a + e.sets, 0),
    0,
  );
  return (
    header(
      'OLY TRACKER / REVISION 6',
      'Your training week',
      `Cycle ${t.cycle} · Week ${t.week}/13 · ${i.name}${t.onboarding && t.cycle === 1 ? ' · Entry stage ' + t.entryStage : ''}`,
    ) +
    (STATE.legacy && !STATE.migrationDismissed
      ? `<div class="notice">Revision 6 starts with a fresh program position. Your previous plan, logs, loads and any unfinished workout are preserved under History and in exports. ${button('Got it', 'STATE.migrationDismissed=true;save();render()', 'text-button')}</div>`
      : '') +
    (STATE.activeWorkout
      ? `<div class="resume">${button('Resume active workout →', "nav('workout')", 'primary wide')}</div>`
      : '') +
    `<div class="stats"><div><strong>${PROGRAM.days.filter((d) => plan(d).sessions.some((s) => !s.skipped && s.rows.some((e) => e.kind === 'quality'))).length}</strong><span>Olympic days</span></div><div><strong>${PROGRAM.days.filter((d) => plan(d).sessions.some((s) => !s.skipped && s.rows.some((e) => e.id === 'bench'))).length}</strong><span>Bench days</span></div><div><strong>${total}</strong><span>Planned failure sets</span></div></div>
    <div class="week-strip" aria-label="Choose training day">${PROGRAM.days.map((d) => `<button class="day-tab ${d === STATE.selectedDay ? 'selected' : ''}" onclick="selectDay('${d}')" aria-pressed="${d === STATE.selectedDay}"><span>${prettyDay(d).slice(0, 3)}</span><b>${['monday', 'tuesday', 'thursday', 'friday'].includes(d) ? { monday: 'A', tuesday: 'B', thursday: 'C', friday: 'D' }[d] : '–'}</b>${plan(d).sessions.some((s) => done(d, s.id)) ? '<i>✓</i>' : ''}</button>`).join('')}</div>
    <section class="day-panel"><div class="eyebrow">${prettyDay(p.day)} · normal calendar</div><h2>${esc(p.title)}</h2>
    ${p.notes.map(notice).join('')}
    ${p.sessions.length ? p.sessions.map((s) => sessionPreview(s, p)).join('') : '<p class="muted">No required workout. Optional easy walking or targeted mobility.</p>'}
    ${(p.mobility || []).map(notice).join('')}</section>
    <div class="footer-actions">${button('Review & advance week', 'openReview()')}${button('Rescue a missed bench', 'openBenchRescue()', 'text-button')}</div>
    <p class="muted small">Week position advances after your review. Start a deferred session from its original day card on the day you actually perform it. Keep A–B–rest–C–D; add recovery days as needed. Omitted work from a finished session creates no debt except a separately rescued bench.</p>`
  );
}
function sessionPreview(s, p) {
  const completed = done(p.day, s.id),
    failed = recordsFor(p.day, s.id).some((r) => r.status === 'partial');
  return `<article class="session-preview"><div class="session-top"><h3>${esc(s.title)}</h3><span class="tag">${completed ? '✓ Logged' : s.skipped ? 'Omitted' : `~${s.totalMin} min`}</span></div>
    ${s.note ? `<p class="muted">${esc(s.note)}</p>` : ''}${s.skipped ? notice(s.skipReason) : ''}
    <div class="actions">${button(completed ? 'Completed' : failed ? 'Partial session saved' : 'Start this session', `startWorkout('${p.day}','${s.id}')`, 'primary wide', completed || failed || s.skipped || !!STATE.activeWorkout)}</div>
    <div class="prescription-list">${s.rows.map((e) => `<div><span>${esc(e.name)}</span><b>${esc(prescription(e))}</b></div>`).join('')}</div>
    <div class="actions"><details><summary>Warm-up & details</summary><p>${esc(s.warmup)}</p>${s.rows.map((e) => `<p><b>${esc(e.name)}</b><br>${esc(e.note)}<br><span class="muted">${esc(e.warmup || '')} Rest ${time(e.rest || 0)}${e.tempo ? ' · ' + esc(e.tempo) : ''}.</span></p>`).join('')}</details></div></article>`;
}
function prescription(ex) {
  if (ex.minutes) return `${ex.minutes} min · RPE 3–4`;
  if (ex.test && !ex.technicalBenchmark)
    return '3 scored attempts · 88–92% opener, then 97–100%, then minimal PR if secure';
  let label = `${ex.sets} × ${ex.reps}`;
  if (ex.kind === 'failure') label += ' · 0 RIR';
  else if (ex.kind === 'quality') {
    if (ex.sequence)
      label += ` · ${ex.sequence.map((r) => (r[0] === r[1] ? r[0] : r.join('–'))).join(', ')}%`;
    else if (ex.range)
      label += ` · ${ex.range[0] === ex.range[1] ? ex.range[0] : ex.range.join('–')}% ${ex.anchor === 'jerk' ? 'RJ' : ex.anchor === 'cj' ? 'CJ' : 'SN'}`;
    if (ex.workingLoad) label = `${ex.sets} × ${ex.reps} · ${fmt(ex.workingLoad)} lb`;
    label += ` · effort ≤${ex.effort}${ex.finalEffort ? ' (final ≤' + ex.finalEffort + ')' : ''}`;
  } else if (ex.effort) label += ' · ' + ex.effort;
  return label;
}
function selectDay(day) {
  STATE.selectedDay = day;
  render();
}
function setReadiness() {
  STATE.readiness = {
    date: dateISO(),
    level: $('readiness').value,
    event: $('event').value,
    localIssue: $('local-issue').value,
    pivotResidual: $('pivot-residual').checked,
  };
  save();
  render();
}
function startWorkout(day, id, rescueRange = null) {
  if (STATE.activeWorkout) {
    nav('workout');
    return;
  }
  const p = plan(day, true);
  let s = p.sessions.find((s) => s.id === id);
  if (rescueRange) {
    const key = 'bench_' + (rescueRange === 'low' ? 'low' : 'moderate');
    if (
      STATE.records.some(
        (r) =>
          r.week === STATE.training.week &&
          r.cycle === STATE.training.cycle &&
          r.exposure === STATE.training.exposure &&
          r.sets.some((s) => s.exerciseKey === key),
      )
    ) {
      toast('This bench exposure has already been logged. Do not repeat it as a rescue.');
      return;
    }
    const ex = PROGRAM.failure('bench', 1, ...(rescueRange === 'low' ? [3, 5] : [6, 8]), 240, {
      key: 'bench_' + (rescueRange === 'low' ? 'low' : 'moderate'),
    });
    s = PROGRAM.session('rescue_' + rescueRange, 'Deferred ' + rescueRange + '-rep bench', [ex]);
    if (readiness().level !== 'green' || ['unsafe', 'game'].includes(readiness().event)) {
      toast('Defer bench until ready.');
      return;
    }
  }
  if (!s || s.skipped) {
    toast(s?.skipReason || 'No eligible session.');
    return;
  }
  if (!rescueRange && (done(day, id) || recordsFor(day, id).length)) {
    toast(
      'This session was already saved. Use a weekly review to repeat a week; rescue only missed bench.',
    );
    return;
  }
  const lastBench = PROGRAM.benchWindow(MODEL.benchRecords(STATE));
  if (s.rows.some((e) => e.id === 'bench') && !lastBench.ready) {
    showModal(
      'Bench needs more spacing',
      `<p>The next bench exposure is eligible after ${esc(new Date(lastBench.eligibleAt).toLocaleString())}, provided you are ready.</p><p>Start the other scheduled work and defer bench. Preserve the low-/moderate-rep sequence.</p>${button('Start without bench', `startWithoutBench('${day}','${id}')`, 'primary')}`,
    );
    return;
  }
  if (id === 'accessories') {
    const first = recordsFor(day, 'main').at(-1);
    if (!first) {
      toast('Complete visit 1 first.');
      return;
    }
    if (Date.now() - first.endedAt < 3 * 3600000) {
      toast('Visit 2 begins at least 3 hours after visit 1.');
      return;
    }
  }
  if (
    STATE.training.week === 12 &&
    s.rows.some((e) => e.key === 'bench_moderate') &&
    !STATE.records.some(
      (r) =>
        r.week === 12 &&
        r.cycle === STATE.training.cycle &&
        r.day === 'friday' &&
        r.status === 'complete' &&
        ['snatch', 'cj'].every((id) => r.sets.some((s) => s.exerciseId === id && s.grade)),
    )
  ) {
    toast(
      'Finish the Olympic test or technical benchmark before the second taper-week bench exposure.',
    );
    return;
  }
  begin(s, day, p);
}
function startWithoutBench(day, id) {
  const p = plan(day, true),
    s = p.sessions.find((s) => s.id === id);
  if (!s || s.skipped) return;
  s.rows = s.rows.filter((e) => e.id !== 'bench');
  s.note += ' Bench deferred for 48-hour spacing.';
  begin(s, day, p);
}
function begin(session, day, p) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
  } catch (e) {}
  const now = Date.now();
  STATE.activeWorkout = {
    id: 'r6-' + now,
    revision: 6,
    day,
    date: dateISO(),
    cycle: STATE.training.cycle,
    week: STATE.training.week,
    exposure: STATE.training.exposure,
    startedAt: now,
    session: JSON.parse(JSON.stringify(session)),
    anchors: { ...STATE.training.anchors },
    increment: STATE.training.increment,
    context: { ...readiness(), recovery: STATE.training.recovery },
    trialSnapshot: { ...STATE.training.trial },
    sets: [],
    omitted: [],
    notes: '',
    warmupDone: false,
  };
  STATE.restEnd = 0;
  save();
  closeModal();
  requestWakeLock();
  nav('workout');
}
async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch (e) {
    /* Optional. */
  }
}
function logged(ex, w = STATE.activeWorkout) {
  return w.sets.filter((s) => s.exerciseKey === ex.key);
}
function status(ex, w = STATE.activeWorkout) {
  const rows = logged(ex, w);
  if (w.omitted.includes(ex.key))
    return { done: true, stopped: true, count: rows.length, planned: ex.sets };
  if (ex.kind === 'quality') {
    const q = MODEL.qualityState(ex, rows);
    return { ...q, count: rows.length };
  }
  return {
    done: rows.length >= (ex.minutes ? 1 : ex.sets),
    count: rows.length,
    planned: ex.minutes ? 1 : ex.sets,
  };
}
function renderWorkout() {
  const w = STATE.activeWorkout;
  if (!w)
    return (
      header('SESSION', 'Ready when you are') + button('Choose a workout', "nav('home')", 'primary')
    );
  const finished = w.session.rows.filter((ex) => status(ex).done).length;
  return `<div class="workout-heading"><div><div class="eyebrow">${prettyDay(w.day)} · C${w.cycle} / W${w.week}</div><h1>${esc(w.session.title)}</h1></div><span id="session-clock" class="clock">00:00</span></div>
    <div class="progress-track"><span style="width:${(100 * finished) / w.session.rows.length}%"></span></div>
    <p class="muted small">${finished}/${w.session.rows.length} exercises resolved · actual session date ${esc(w.date)}</p>
    ${w.session.note ? notice(w.session.note) : ''}
    <details class="warmup" ${w.warmupDone ? '' : 'open'}><summary>General warm-up ${w.warmupDone ? '✓' : ''}</summary><p>${esc(w.session.warmup || 'Easy start; settle into the talk-test effort.')}</p>${button(w.warmupDone ? 'Prepared' : 'Warm-up done', 'STATE.activeWorkout.warmupDone=true;save();render()', 'button', w.warmupDone)}</details>
    ${w.session.rows.map((e, i) => exerciseCard(e, i)).join('')}
    <label class="field">Session notes<textarea id="session-notes" onchange="STATE.activeWorkout.notes=this.value;save()" placeholder="Technique, recovery, equipment setup…">${esc(w.notes)}</textarea></label>
    ${button('Finish session', 'openFinish()', 'primary wide')}`;
}
function exposures(ex) {
  return STATE.records
    .filter((r) => r.revision === 6)
    .map((r) => {
      const old = r.session.rows.find((e) => MODEL.fingerprint(e) === MODEL.fingerprint(ex));
      return {
        normal:
          r.context.level === 'green' &&
          r.context.event === 'normal' &&
          r.recoveryNormal !== false &&
          r.recoveryConfirmed === true &&
          (!r.context.recovery || r.context.recovery === 'normal') &&
          !r.context.localIssue,
        rows: old ? r.sets.filter((s) => s.exerciseKey === old.key) : [],
      };
    });
}
function exerciseCard(ex, i) {
  const w = STATE.activeWorkout,
    s = status(ex),
    rows = logged(ex),
    q = ex.kind === 'quality' ? MODEL.qualityState(ex, rows) : null;
  const nextIndex = MODEL.slotAt(ex, rows.length),
    range = PROGRAM.loadRange(ex, w.anchors, nextIndex, w.increment);
  const next = ex.kind === 'failure' ? PROGRAM.nextLoad(ex, exposures(ex)) : null;
  return `<article class="exercise ${s.done ? 'resolved' : ''}" id="exercise-${i}"><div class="exercise-title"><span class="number">${i + 1}</span><div><h2>${esc(ex.name)}</h2><p>${esc(prescription(ex))}</p></div><span class="tag">${s.count}/${s.planned}</span></div>
    ${
      range && !s.done
        ? `<div class="load-line">Next: <b>${range
            .map(fmt)
            .filter((v, i, a) => i === 0 || v !== a[0])
            .join('–')} lb</b> <span>rounded down · respect effort/positions</span></div>`
        : ''
    }
    ${q?.message ? notice(q.message) : ''}
    ${ex.test && !ex.technicalBenchmark && !s.done ? button('Use ≤85% technical benchmark', `useBenchmark(${i})`, 'text-button') : ''}
    ${next && !s.done ? `<p class="progression">${next.weight ? `Last / starting guide: ${fmt(next.weight)} lb. ` : ''}${esc(next.text)}</p>` : ''}
    <details><summary>Execution · warm-up · rest</summary><p>${esc(ex.note)}</p><p>${esc(ex.warmup || '')}</p><p>Rest ${time(ex.rest || 0)}${ex.kind === 'failure' ? ' (compounds 3–5 min; isolations 2–3 min). About 2 s lowering.' : '. Quality and speed work never go to failure.'}</p></details>
    ${rows.length ? `<ol class="set-log">${rows.map((r) => `<li><span>${r.weight ? fmt(r.weight) + ' lb · ' : ''}${esc(r.reps)}${ex.minutes ? ' min' : ' rep' + (r.reps === 1 ? '' : 's')}${ex.reps === '1+1' ? ' (clean + jerk pair)' : ''}</span><span>${esc(r.endpoint || r.outcome || 'done')}${r.grade ? ' · ' + r.grade + ' / ' + r.effort : ''}${r.fault ? ' · ' + esc(r.fault) : ''}</span></li>`).join('')}</ol>` : ''}
    <div class="exercise-actions">${button(s.done ? (s.stopped ? 'Omitted' : 'Logged') : ex.kind === 'quality' ? 'Log next attempt' : 'Log next set', `openSet(${i})`, 'primary', s.done || !w.warmupDone || w.session.rows.slice(0, i).some((prior) => !status(prior).done))}${!s.done ? button('Omit', `omitExercise(${i})`, 'text-button') : ''}${rows.length ? button('Undo last', `undoSet(${i})`, 'text-button') : ''}</div></article>`;
}
function showModal(title, body) {
  modal = document.activeElement;
  $('modal').innerHTML =
    `<div class="modal-head"><h2 id="modal-title">${esc(title)}</h2>${button('✕', 'closeModal()', 'icon-button')}</div>${body}`;
  $('modal').showModal();
}
function closeModal() {
  if ($('modal')?.open) $('modal').close();
  if (modal?.isConnected) modal.focus();
  modal = null;
}
function options(values, selected) {
  return values
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`,
    )
    .join('');
}
function field(label, id, value, type = 'number', extra = '') {
  return `<label class="field">${esc(label)}<input id="${id}" type="${type}" value="${esc(value ?? '')}" ${extra}></label>`;
}
function select(label, id, values, value) {
  return `<label class="field">${esc(label)}<select id="${id}">${options(values, value)}</select></label>`;
}
function checkbox(label, id, checked = false) {
  return `<label class="check"><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><span>${esc(label)}</span></label>`;
}
function openSet(index) {
  const w = STATE.activeWorkout,
    ex = w.session.rows[index],
    rows = logged(ex);
  if (status(ex).done || w.session.rows.slice(0, index).some((prior) => !status(prior).done))
    return;
  if (ex.id === 'bench') {
    // The current exposure itself does not create a second-day spacing lock.
    const prior = PROGRAM.benchWindow(MODEL.benchRecords({ ...STATE, activeWorkout: null }));
    if (!prior.ready) {
      toast('Bench remains inside the 48-hour spacing window. Defer it.');
      return;
    }
  }
  const range = PROGRAM.loadRange(ex, w.anchors, MODEL.slotAt(ex, rows.length), w.increment);
  const suggestion = ex.kind === 'failure' ? PROGRAM.nextLoad(ex, exposures(ex)) : null;
  const last = rows.at(-1),
    quality = ex.kind === 'quality';
  let weight = last?.weight || suggestion?.weight || range?.[0] || '';
  if (quality && range) weight = range[0];
  if (quality) {
    const q = MODEL.qualityState(ex, rows);
    if (q.loadCap) weight = Math.min(weight || q.loadCap, q.loadCap);
  }
  if (ex.kind === 'failure' && last?.reps < ex.repRange[0])
    weight = Math.floor((last.weight * 0.925) / w.increment) * w.increment;
  let body = `<p class="muted">${esc(prescription(ex))}. Rest ${time(ex.rest || 0)}.</p>`;
  if (quality || ex.kind === 'failure')
    body += field(
      'Actual load (lb)',
      'set-weight',
      weight,
      'number',
      'min="0.1" step="any" inputmode="decimal" required',
    );
  if (ex.kind === 'failure')
    body +=
      field(
        'Valid reps completed',
        'set-reps',
        '',
        'number',
        'min="0" max="100" inputmode="numeric" required',
      ) +
      select(
        'Endpoint',
        'set-endpoint',
        [
          ['failure', 'Strict-form failure · 0 RIR'],
          ['tech', 'TECH · technique ended set'],
          ['pain', 'Pain · stop affected work'],
        ],
        'failure',
      ) +
      checkbox('An unsuccessful final attempt occurred', 'set-failed');
  else if (quality)
    body +=
      select(
        'Outcome',
        'set-outcome',
        [
          ['make', 'Made the complete rep / pair'],
          ['miss', 'Miss'],
          ...(ex.id === 'cj'
            ? [
                ['clean_miss', 'Clean missed · no jerk'],
                ['jerk_miss', 'Clean made · jerk missed'],
              ]
            : []),
        ],
        'make',
      ) +
      select(
        'Technique',
        'set-grade',
        [
          ['A', 'A · secure'],
          ['B', 'B · acceptable'],
          ['C', 'C · poor / invalid'],
        ],
        'A',
      ) +
      field(
        'Actual effort (1–10; not RIR)',
        'set-effort',
        '',
        'number',
        'min="1" max="10" step="0.5" required',
      ) +
      select(
        'Fault / miss direction',
        'set-fault',
        [
          ['', 'None'],
          ['forward', 'Forward'],
          ['backward', 'Backward'],
          ['receive', 'Receiving position'],
          ['fixation', 'Fixation / press-out'],
          ['other', 'Other'],
        ],
        '',
      );
  else if (ex.minutes)
    body += field(
      'Actual moving minutes',
      'set-minutes',
      ex.minutes,
      'number',
      'min="1" max="300" required',
    );
  else
    body += field(
      ex.id === 'sprint' || ex.id === 'fly'
        ? 'Time (seconds, optional)'
        : 'Result / jump height (optional)',
      'set-result',
      '',
      'text',
    );
  body += `<p id="set-error" class="error" role="alert"></p><button class="primary wide" type="submit">Save ${quality ? 'attempt' : 'set'} & start rest</button>`;
  showModal(ex.name, `<form onsubmit="event.preventDefault();submitSet(${index})">${body}</form>`);
  setTimeout(
    () => ($('set-reps') || $('set-effort') || $('set-weight') || $('set-minutes'))?.focus(),
    50,
  );
}
function submitSet(index) {
  const w = STATE.activeWorkout,
    ex = w.session.rows[index],
    q = ex.kind === 'quality';
  if (status(ex).done) return;
  const row = { exerciseId: ex.id, exerciseKey: ex.key, at: Date.now() };
  if (q || ex.kind === 'failure') {
    row.weight = Number($('set-weight').value);
    if (!(row.weight > 0 && row.weight < 3000))
      return ($('set-error').textContent = 'Enter a valid positive load.');
  }
  if (ex.kind === 'failure') {
    row.reps = Number($('set-reps').value);
    row.endpoint = $('set-endpoint').value;
    row.failedAttempt = $('set-failed').checked;
    if (!Number.isInteger(row.reps) || row.reps < 0 || row.reps > 100)
      return ($('set-error').textContent = 'Enter valid completed reps.');
  } else if (q) {
    row.reps = 1;
    row.outcome = $('set-outcome').value;
    row.grade = $('set-grade').value;
    row.effort = Number($('set-effort').value);
    row.fault = $('set-fault').value;
    if (!(row.effort >= 1 && row.effort <= 10))
      return ($('set-error').textContent = 'Enter actual effort from 1 to 10.');
    row.pair = ex.reps === '1+1';
    row.pct = ex.anchor && w.anchors[ex.anchor] ? (100 * row.weight) / w.anchors[ex.anchor] : null;
    if ((row.outcome !== 'make' || row.grade === 'C') && !row.fault)
      return ($('set-error').textContent = 'Choose the fault or miss direction.');
  } else {
    row.reps = ex.minutes ? Number($('set-minutes').value) : ex.reps;
    row.result = $('set-result')?.value || '';
    row.endpoint = 'done';
  }
  w.sets.push(row);
  if (row.endpoint === 'pain') w.omitted.push(ex.key);
  if (q && MODEL.qualityState(ex, logged(ex)).stop) {
    const family = (id) =>
      ['snatch', 'hang', 'pull'].includes(id)
        ? 'snatch'
        : ['jerk', 'pause_jerk'].includes(id)
          ? 'jerk'
          : id;
    w.session.rows
      .slice(index + 1)
      .filter((e) => e.kind === 'quality' && family(e.id) === family(ex.id))
      .forEach((e) => {
        if (!w.omitted.includes(e.key)) w.omitted.push(e.key);
      });
  }
  // First rep of a double uses the short reset; each C&J pair rests normally.
  const after = logged(ex).length,
    slot = MODEL.slotAt(ex, after - 1),
    nextSlot = MODEL.slotAt(ex, after);
  const rest = q && slot === nextSlot && !status(ex).done ? 20 : ex.rest || 0;
  STATE.restEnd = rest ? Date.now() + rest * 1000 : 0;
  save();
  closeModal();
  render();
  if (row.endpoint === 'pain') toast('Pain logged. Stop affected work and reassess today’s plan.');
  else if (q && row.effort > (ex.finalEffort && slot === ex.sets - 1 ? ex.finalEffort : ex.effort))
    toast('Effort exceeded the cap. Reduce or stop; do not add attempts.');
}
function useBenchmark(i) {
  const ex = STATE.activeWorkout.session.rows[i];
  ex.technicalBenchmark = true;
  ex.range = [75, 85];
  ex.effort = 8;
  ex.note =
    'Technical benchmark ≤85% after warm-up or phase-gate review. Keep the remaining attempt budget; no maximal test today.';
  save();
  render();
}
function omitExercise(i) {
  const ex = STATE.activeWorkout.session.rows[i];
  STATE.activeWorkout.omitted.push(ex.key);
  save();
  render();
}
function undoSet(i) {
  const w = STATE.activeWorkout,
    ex = w.session.rows[i];
  const idx = w.sets.map((s) => s.exerciseKey).lastIndexOf(ex.key);
  if (idx >= 0) w.sets.splice(idx, 1);
  w.omitted = w.omitted.filter((k) => k !== ex.key);
  save();
  render();
}
function tickTimers() {
  if ($('session-clock') && STATE.activeWorkout)
    $('session-clock').textContent = time((Date.now() - STATE.activeWorkout.startedAt) / 1000);
  const remaining = Math.ceil((STATE.restEnd - Date.now()) / 1000),
    bar = $('rest-bar');
  if (STATE.restEnd && remaining <= 0) {
    STATE.restEnd = 0;
    save();
    beep();
    toast('Rest complete. Take longer if needed.');
  }
  bar.hidden = !STATE.restEnd;
  if (STATE.restEnd) $('rest-count').textContent = time(remaining);
}
function beep() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioContext.createOscillator(),
      g = audioContext.createGain();
    g.gain.value = 0.12;
    o.connect(g);
    g.connect(audioContext.destination);
    o.start();
    o.stop(audioContext.currentTime + 0.2);
  } catch (e) {}
}
function adjustRest(seconds) {
  STATE.restEnd = Math.max(Date.now(), STATE.restEnd || Date.now()) + seconds * 1000;
  save();
  tickTimers();
}
function skipRest() {
  STATE.restEnd = 0;
  save();
  tickTimers();
}
function restoreRuntimeTimers() {
  tickTimers();
  if (STATE.activeWorkout) requestWakeLock();
}
function openFinish() {
  const w = STATE.activeWorkout,
    missing = w.session.rows.filter((ex) => !status(ex).done);
  const test = w.session.rows.some((e) => e.test);
  showModal(
    'Save this session',
    `${missing.length ? notice(`${missing.length} exercises have unfinished work. Save as partial; omitted accessories are not owed.`) : '<p>Save the completed session and your actual results.</p>'}
    ${checkbox('Normal execution and no obvious recovery issue today', 'finish-normal', w.context.level === 'green')}
    ${test ? checkbox('Update SN/CJ anchors only from higher, technically valid scored singles', 'update-anchors') : ''}
    ${button(missing.length ? 'Save partial session' : 'Save session', 'finishWorkout()', 'primary wide')}`,
  );
}
function finishWorkout() {
  const w = STATE.activeWorkout;
  if (!w) return;
  w.endedAt = Date.now();
  w.status = w.session.rows.every((ex) => status(ex).done) ? 'complete' : 'partial';
  w.recoveryNormal = $('finish-normal').checked;
  w.recoveryConfirmed = false;
  if ($('update-anchors')?.checked)
    w.session.rows
      .filter((e) => e.test)
      .forEach((ex) => {
        const best = Math.max(
          0,
          ...logged(ex)
            .filter((r) => r.outcome === 'make' && r.grade !== 'C')
            .map((r) => r.weight),
        );
        if (best > STATE.training.anchors[ex.id]) STATE.training.anchors[ex.id] = best;
      });
  // Assessments stage demonstrated references directly, never rep-equation estimates.
  w.session.rows
    .filter((e) => e.assessment)
    .forEach((ex) => {
      const best = Math.max(
        0,
        ...logged(ex)
          .filter((r) => r.outcome === 'make' && r.grade !== 'C' && r.effort <= 8)
          .map((r) => r.weight),
      );
      if (best) STATE.training.anchors[ex.id] = best;
    });
  STATE.records.push(w);
  STATE.activeWorkout = null;
  STATE.restEnd = 0;
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
  save();
  closeModal();
  nav('home');
  toast('Session saved. Confirm next-session recovery in History before load progression.');
}
function openBenchRescue() {
  showModal(
    'Rescue a missed bench',
    `<p>Use only for an omitted bench slot. Low-rep: 1×3–5; moderate: 1×6–8. At least 48 actual hours between exposures. Keep bench after priority lifting and after any week-12 test.</p><p>Tuesday → Wednesday only if Friday remains ≥48 h later. Otherwise Friday low, Sunday moderate; shift the next Tuesday if needed. Friday → Saturday only when ready.</p>${select(
      'Missed exposure',
      'rescue-type',
      [
        ['low', 'Low-rep · 3–5'],
        ['moderate', 'Moderate · 6–8'],
      ],
      'low',
    )}${button('Start deferred bench', "const kind=$('rescue-type').value;closeModal();startWorkout(STATE.selectedDay,'rescue_'+kind,kind)", 'primary wide')}`,
  );
}
function renderHistory() {
  const rows = STATE.records.slice().reverse();
  const attempts = rows.flatMap((r) => r.sets).filter((s) => s.grade);
  const acceptable = attempts.filter((s) => s.outcome === 'make' && s.grade !== 'C').length;
  const bench = PROGRAM.benchWindow(MODEL.benchRecords(STATE));
  return (
    header(
      'TRAINING LOG',
      'Your actual work',
      `${rows.length} Revision 6 sessions · ${attempts.length ? Math.round((100 * acceptable) / attempts.length) + '% acceptable Olympic attempts' : 'No Olympic attempts logged yet'}`,
    ) +
    (bench.last
      ? notice(
          `Most recent bench: ${new Date(bench.last).toLocaleString()}. Next eligible: ${new Date(bench.eligibleAt).toLocaleString()}, if ready.`,
        )
      : '') +
    rows
      .map(
        (
          r,
        ) => `<details class="history-card"><summary><span><b>${esc(r.session.title)}</b><small>${esc(new Date(r.startedAt).toLocaleString())} · C${r.cycle}/W${r.week} · ${r.status}</small></span><span>${r.sets.length} logs</span></summary>
      <p>${esc(r.notes || 'No session notes.')}</p>
      ${r.recoveryConfirmed ? notice('Subsequent recovery reviewed.') : button('Confirm subsequent recovery stayed normal', `confirmRecovery(${STATE.records.indexOf(r)})`, 'button')}
      ${r.session.rows
        .map((ex) => {
          const sets = r.sets.filter((s) => s.exerciseKey === ex.key);
          return `<div class="history-ex"><h3>${esc(ex.name)}</h3><p class="muted">${esc(prescription(ex))}</p>${sets.map((s) => `<p>${s.weight ? fmt(s.weight) + ' lb × ' : ''}${esc(s.reps)} · ${esc(s.endpoint || s.outcome)}${s.grade ? ' · ' + s.grade + ' / effort ' + s.effort : ''}${s.failedAttempt ? ' · unsuccessful final attempt' : ''}</p>`).join('')}${!sets.length ? '<p class="muted">Omitted / not logged</p>' : ''}</div>`;
        })
        .join('')}
    </details>`,
      )
      .join('') +
    (!rows.length ? '<div class="empty">Your first logged session will appear here.</div>' : '') +
    (STATE.legacy
      ? `<details class="history-card"><summary>Previous program archive · preserved unchanged</summary><p>${Object.keys(STATE.legacy.log || {}).length} historical sessions. Old loads and any unfinished workout are included in this archive and full exports.</p>${button('Download previous program data', 'exportLegacy()', 'button')}<pre>${esc(JSON.stringify(STATE.legacy.log || {}, null, 2))}</pre></details>`
      : '') +
    (STATE.legacyArchives || [])
      .map(
        (archive, i) =>
          `<details class="history-card"><summary>Additional previous-program cloud archive ${i + 1}</summary><pre>${esc(JSON.stringify(archive, null, 2))}</pre></details>`,
      )
      .join('') +
    `<div class="actions">${button('Export all data', 'exportData()', 'button')}</div>`
  );
}
function confirmRecovery(index) {
  const r = STATE.records[index];
  if (r) {
    r.recoveryConfirmed = true;
    save();
    render();
  }
}
function openReview() {
  if (STATE.activeWorkout) {
    toast('Finish the active session before changing the week.');
    return;
  }
  const t = STATE.training,
    i = info();
  showModal(
    'Weekly review',
    `<p>Cycle ${t.cycle}, week ${t.week}: ${i.name}. Repeat the successful dose when readiness or skill gates are not met.</p>
    ${checkbox('This was a normal green week; ≥90% acceptable Olympic reps and stable receiving positions', 'review-green')}
    ${checkbox('Two normal weeks meet the Build gate (≥90% acceptable reps; no recurring receiving limitation)', 'review-build', t.phaseGate !== 'F')}
    ${checkbox('80–85% singles are secure: Realization gate met', 'review-realization', t.phaseGate === 'R')}
    ${select(
      'Next step',
      'review-action',
      [
        ['advance', t.week === 13 ? 'Begin next 13-week cycle' : 'Advance to week ' + (t.week + 1)],
        ['repeat', 'Repeat this week / dose'],
      ],
      'advance',
    )}
    ${select(
      'Recovery prescription',
      'review-recovery',
      [
        ['normal', 'Normal / held dose'],
        ['targeted', 'Targeted reduction'],
        ['reset', 'Full reset'],
      ],
      'normal',
    )}
    <label class="field">Review notes<textarea id="review-notes" placeholder="C→D rack-jerk cost? Squat support? Incline/delt/trap tolerance? One change to trial…"></textarea></label>
    <p id="review-error" class="error"></p>${button('Save review', 'submitReview()', 'primary wide')}`,
  );
}
function submitReview() {
  const green = $('review-green').checked,
    buildReady = $('review-build').checked,
    realizationReady = $('review-realization').checked;
  if (realizationReady && !buildReady) {
    $('review-error').textContent = 'Realization also requires the Build criteria.';
    return;
  }
  const review = {
    green,
    buildReady,
    realizationReady,
    action: $('review-action').value,
    notes: $('review-notes').value,
  };
  STATE.training = MODEL.reviewAdvance(STATE.training, review);
  STATE.training.recovery = $('review-recovery').value;
  save();
  closeModal();
  render();
}
function renderSettings() {
  const t = STATE.training,
    r = readiness();
  return (
    header(
      'PROGRAM SETUP',
      'Make the plan yours',
      'Loads in pounds. Change only what your log and readiness justify.',
    ) +
    (STATE.activeWorkout
      ? notice(
          'Finish the active session before editing the program. Its prescription and anchor snapshot stay fixed.',
        )
      : '') +
    `<fieldset ${STATE.activeWorkout ? 'disabled' : ''}>
    <section class="settings-card"><h2>Today’s readiness</h2>
      ${select(
        'Readiness',
        'readiness',
        [
          ['green', 'Green · normal'],
          ['amber', 'Amber · reduce Olympic work, omit failure work'],
          ['red', 'Red · no training'],
        ],
        r.level,
      )}
      ${select(
        'Event / return status',
        'event',
        [
          ['normal', 'Normal / casual low-demand skills'],
          ['game', 'Demanding pickup game · defer affected session'],
          [
            'verification',
            'Sober and recovered after larger/uncertain exposure · verification return',
          ],
          ['unsafe', 'Intoxicated / uncertain sobriety / dizzy / poorly coordinated'],
        ],
        r.event,
      )}
      ${select(
        'Isolated problem (only with otherwise normal readiness)',
        'local-issue',
        [
          ['', 'None'],
          ['upper', 'Upper body'],
          ['lower', 'Lower body'],
        ],
        r.localIssue,
      )}
      ${checkbox('Pivot has residual fatigue: one set per conventional exercise', 'pivot-residual', r.pivotResidual)}
      ${button('Apply to today', 'setReadiness()', 'button')}
    </section>
    <section class="settings-card"><h2>Demonstrated lift references</h2><p class="muted">SN/CJ begin at 155/205 lb. Clean and rack jerk remain unknown until demonstrated. The old power clean and estimated TMs are archived.</p>
      <div class="two-col">${field('Snatch (SN)', 'anchor-snatch', t.anchors.snatch)}${field('Clean & jerk (CJ)', 'anchor-cj', t.anchors.cj)}${field('Rack jerk (RJ) · optional', 'anchor-jerk', t.anchors.jerk)}${field('Full clean · optional', 'anchor-clean', t.anchors.clean)}</div>
      ${select(
        'Smallest total barbell increment',
        'increment',
        [
          [2.5, '2.5 lb'],
          [5, '5 lb'],
          [1, '1 lb'],
        ],
        t.increment,
      )}
      ${field('Rack-jerk working load · optional direct progression', 'rack-load', t.rackLoad, 'number', 'min="0" step="any"')}
      ${button('Save demonstrated references', 'saveAnchors()', 'button')}
    </section>
    <section class="settings-card"><h2>Schedule & equipment</h2>
      ${checkbox('Split B/D after lateral raises: visit 2 at least 3 h later', 'split', t.split)}
      ${checkbox('Cutting · retain dose until recovery calls for a reduction', 'cutting', t.cutting)}
      ${select(
        'Lateral raise',
        'lateral',
        [
          ['cable', 'Cable'],
          ['db', 'Dumbbell'],
        ],
        t.lateral,
      )}
      ${checkbox('Overhead triceps is intolerable: use cable pressdown', 'triceps-fallback', t.tricepsFallback)}
      ${checkbox('Use supported knee-extended calf press', 'calf-fallback', t.calfFallback)}
      ${checkbox('Leg-extension machine cannot support reclined position: use upright', 'extension-fallback', t.legExtUpright)}
      ${checkbox('A doubles impair B: hold Monday snatch at 4×2', 'reduce-monday', t.reduceMondaySnatch)}
      ${checkbox('C jerks impair D: one fewer C jerk set; suspend C assistance', 'reduce-jerk', t.reduceCJerk)}
      ${button('Save schedule & equipment', 'saveEquipment()', 'button')}
    </section>
    <details class="settings-card"><summary><h2>Optional dose & assistance</h2></summary><p class="muted">Introduce in normal F/B after two stable green weeks, one dose change at a time. Checkpoints and Realization hold earned doses; taper omits them. Review assistance at 2 / 4 / 8 exposures.</p>
      ${select(
        'Athletic module',
        'athletic-enabled',
        [
          [0, 'Not introduced'],
          [1, 'Introduced / retained'],
        ],
        t.athletics.enabled ? 1 : 0,
      )}
      ${field('Athletic progression step (0 = 6 jumps + 3×10 m)', 'athletic-stage', t.athletics.stage, 'number', 'min="0" max="50" step="1"')}
      <p class="muted small">${esc(athleticDescription(t.athletics.stage))}. Advance one step after two productive exposures. Step 6 = 15 jumps and 3×20 m; step 7 = 15 jumps and 4×20 m. Later values remain reviewed trials.</p>
      ${select(
        'Primary athletic day',
        'athletic-day',
        [
          ['monday', 'Monday after A'],
          ['thursday', 'Thursday after C · relocation'],
        ],
        t.athletics.day,
      )}
      ${select(
        'Earned second Thursday exposure',
        'athletic-secondary',
        [
          [0, 'None'],
          [1, '2×3 jumps'],
          [2, '2×3 jumps + 2×10 m'],
        ],
        t.athletics.secondary,
      )}
      ${select(
        'Alternate-exposure running replacement',
        'athletic-variation',
        [
          ['none', 'None'],
          ['fly', 'Replace final 2 runs with 2 flying 10s'],
          ['cut', 'Replace final 2 runs with 2 sets of 45° cuts/side'],
        ],
        t.athletics.variation,
      )}
      ${select(
        'Replacement effort',
        'variation-effort',
        [
          [80, '75–85% cuts'],
          [90, '90% fly / 85–90% cuts'],
          [95, '95% fly'],
        ],
        t.athletics.variationEffort,
      )}
      ${select(
        'Aerobic work',
        'cardio-enabled',
        [
          [0, 'Not introduced'],
          [1, 'Introduced / retained'],
        ],
        t.cardio.enabled ? 1 : 0,
      )}
      ${field('Weekly aerobic moving minutes (split Wed/Sat)', 'cardio-minutes', t.cardio.minutes, 'number', 'min="40" max="300" step="5"')}
      <p class="muted small">Start 20+20. After two green weeks: +5 min to one session up to 30+30, then +10 weekly minutes. Review 150 for a full cycle before progressing toward 300. Longer doses can be split into walks after priority work.</p>
      ${select(
        'One assistance / dose trial',
        'trial-kind',
        [
          ['none', 'None'],
          ['squat', 'Extra relevant squat set · 3–5 to failure'],
          ['press', 'Supported overhead press · replace one Friday incline set'],
          ['pause_jerk', 'Pause-dip jerk · replace first two Thursday jerk sets'],
          ['set', 'One extra weekly accessory set'],
          ['calf_partial', 'Replace one Friday calf set with fixed partial ROM'],
        ],
        t.trial.kind,
      )}
      ${select(
        'Trial day (squat or accessory set)',
        'trial-day',
        [
          ['tuesday', 'Tuesday'],
          ['friday', 'Friday'],
        ],
        t.trial.day,
      )}
      ${select(
        'Accessory for extra-set trial',
        'trial-exercise',
        PROGRAM.accessories.map((x) => [x[0], PROGRAM.exercises[x[0]][0]]),
        t.trial.exercise,
      )}
      ${checkbox('Omit provisional snatch pulls after checkpoint review / omission trial', 'omit-pull', t.omitPull)}
      ${checkbox('The required stable weeks/exposures are complete; higher-priority work is unaffected', 'dose-ready')}
      <label class="field">Reason for this one change<textarea id="dose-reason" placeholder="What the log showed; what to review next…"></textarea></label>
      <p id="dose-error" class="error"></p>${button('Save reviewed dose', 'saveDose()', 'button')}
      ${t.trial.kind !== 'none' ? button('Review current assistance trial', 'openTrialReview()', 'button') : ''}
      ${(t.established || []).length ? '<h3 style="margin-top:20px">Established additions</h3>' : ''}
      ${(t.established || []).map((trial, i) => `<p class="muted">${esc(trialLabel(trial))} ${button('Remove', `removeEstablished(${i})`, 'text-button')}</p>`).join('')}
    </details>
    <details class="settings-card"><summary><h2>Heavy practice & assessments</h2></summary><p class="muted">Replacements within the existing attempt budget. F: two secure 80–85% exposures before 85–88%. B/R: two secure 85–88% before final D 90–92%; two secure exposures before 93–95% in R. Extra weekly slots each require two green weeks at the current dose.</p>
      <div class="two-col">${field('Earned final D snatch % (0 = base)', 'heavy-snatch', t.heavy.snatch, 'number', 'min="0" max="95" step="1"')}${field('Earned final D CJ % (0 = base)', 'heavy-cj', t.heavy.cj, 'number', 'min="0" max="95" step="1"')}${field('Additional snatch replacements/week', 'extra-snatch', t.heavy.extraSnatch, 'number', 'min="0" max="12" step="1"')}${field('Additional CJ replacements/week', 'extra-cj', t.heavy.extraCj, 'number', 'min="0" max="12" step="1"')}</div>
      ${select(
        'Component assessment replacement',
        'assessment',
        [
          ['none', 'None'],
          ['clean', 'Tuesday: 3 CJ pairs + up to 3 full cleans'],
          ['jerk', 'Thursday: assessed rack-jerk singles'],
        ],
        t.assessment,
      )}
      ${checkbox('Eligibility reviewed; secure exposures and subsequent recovery support this change', 'heavy-ready')}
      <p id="heavy-error" class="error"></p>${button('Save reviewed replacements', 'saveHeavy()', 'button')}
    </details>
    <section class="settings-card"><h2>Targeted mobility</h2><p class="muted">At most two actual restrictions. Wednesday, Saturday, Sunday; optional fourth day Monday. After lifting on lift days.</p>
      ${['Bent-knee ankle wall stretch', 'Bench lat stretch · ribs controlled', 'Front-rack wrist stretch', 'Hip 90/90'].map((n, i) => checkbox(n, 'mobility-' + i, t.mobility.includes(n))).join('')}
      ${select(
        'Hold duration',
        'mobility-seconds',
        [
          [30, '30 s'],
          [45, '45 s after two weeks without improvement'],
        ],
        t.mobilitySeconds,
      )}
      ${select(
        'Days each week',
        'mobility-days',
        [
          [3, '3'],
          [4, '4 after two weeks without improvement'],
        ],
        t.mobilityDays,
      )}
      ${button('Save mobility', 'saveMobility()', 'button')}
    </section>
    <details class="settings-card"><summary>Set program position manually</summary><p>For an established start or a corrected position. This does not prove a phase gate. Existing logs remain attached to their original week.</p>
      ${field('Cycle', 'position-cycle', t.cycle, 'number', 'min="1" max="100" step="1"')}${field('Cycle week', 'position-week', t.week, 'number', 'min="1" max="13" step="1"')}
      ${select(
        'Verified phase gate',
        'position-phase',
        [
          ['F', 'Foundation · Build criteria not yet met'],
          ['B', 'Build cleared · two normal ≥90% weeks'],
          ['R', 'Realization cleared · secure 80–85% singles'],
        ],
        t.phaseGate,
      )}
      ${select(
        'Entry dose',
        'entry-stage',
        [
          [1, 'Stage 1 · 14 failure sets/day'],
          [2, 'Stage 2 · 18/day'],
          [3, 'Full base · 22/day'],
        ],
        t.entryStage,
      )}
      ${checkbox('First-cycle onboarding is still needed', 'onboarding', t.onboarding)}
      ${button('Set position', 'setPosition()', 'button')}
    </details></fieldset>
    ${typeof syncSettingsHTML === 'function' ? syncSettingsHTML() : ''}
    <section class="settings-card"><h2>Your data</h2><div class="actions">${button('Export complete backup', 'exportData()', 'button')}<label class="button file-input">Import backup<input type="file" accept=".json,application/json" onchange="importData(this)"></label></div><p class="muted small">Revision 6 logs, active session, timers, reviews and the full previous program archive are included. No Google credentials are exported.</p></section>`
  );
}
function saveAnchors() {
  const values = {};
  for (const k of ['snatch', 'cj', 'jerk', 'clean']) {
    const value = Number($('anchor-' + k).value);
    if ((['snatch', 'cj'].includes(k) && value <= 0) || value < 0 || value > 2000) {
      toast('Enter valid demonstrated references.');
      return;
    }
    values[k] = value || null;
  }
  const rack = Number($('rack-load').value) || null;
  if (rack && !values.jerk) {
    toast('Assess RJ before using a directly progressed rack-jerk working load.');
    return;
  }
  STATE.training.anchors = values;
  STATE.training.increment = Number($('increment').value);
  STATE.training.rackLoad = rack;
  save();
  toast('References saved.');
  render();
}
function saveEquipment() {
  const t = STATE.training;
  t.split = $('split').checked;
  t.cutting = $('cutting').checked;
  t.lateral = $('lateral').value;
  t.tricepsFallback = $('triceps-fallback').checked;
  t.calfFallback = $('calf-fallback').checked;
  t.legExtUpright = $('extension-fallback').checked;
  t.reduceMondaySnatch = $('reduce-monday').checked;
  t.reduceCJerk = $('reduce-jerk').checked;
  save();
  toast('Schedule and equipment saved.');
  render();
}
function athleticDescription(stage) {
  const d = PROGRAM.athleticDose(stage);
  return `${d.jumpSets}×3 jumps, ${d.runs}×${d.meters} m at ${d.effort}`;
}
function saveDose() {
  const t = STATE.training,
    next = {
      athletics: {
        enabled: $('athletic-enabled').value === '1',
        stage: Number($('athletic-stage').value),
        day: $('athletic-day').value,
        secondary: Number($('athletic-secondary').value),
        variation: $('athletic-variation').value,
        variationEffort: Number($('variation-effort').value),
      },
      cardio: {
        enabled: $('cardio-enabled').value === '1',
        minutes: Number($('cardio-minutes').value),
      },
      trial: {
        ...t.trial,
        kind: $('trial-kind').value,
        day: $('trial-day').value,
        exercise: $('trial-exercise').value,
      },
      omitPull: $('omit-pull').checked,
    };
  if (['press', 'calf_partial', 'pause_jerk'].includes(next.trial.kind))
    next.trial.day = next.trial.kind === 'pause_jerk' ? 'thursday' : 'friday';
  const error = validateDose(t, next, $('dose-ready').checked, $('dose-reason').value);
  if (error) {
    $('dose-error').textContent = error;
    return;
  }
  if (JSON.stringify(t.trial) !== JSON.stringify(next.trial)) next.trial.startedAt = Date.now();
  t.review.push({
    at: Date.now(),
    week: t.week,
    cycle: t.cycle,
    kind: 'dose',
    notes: $('dose-reason').value,
    before: { athletics: t.athletics, cardio: t.cardio, trial: t.trial, omitPull: t.omitPull },
    after: next,
  });
  Object.assign(t, next);
  save();
  toast('Reviewed dose saved.');
  render();
}
function validateDose(t, n, ready, reason) {
  const changed = ['athletics', 'cardio', 'trial', 'omitPull'].filter(
    (k) => JSON.stringify(t[k]) !== JSON.stringify(n[k]),
  );
  if (changed.length > 1)
    return 'Change one module at a time, then observe its effect before changing another.';
  if (
    !Number.isInteger(n.athletics.stage) ||
    n.athletics.stage < 0 ||
    n.athletics.stage > 50 ||
    n.cardio.minutes < 40 ||
    n.cardio.minutes > 300
  )
    return 'Check the progression step and aerobic minutes.';
  const increases =
    (n.athletics.enabled && !t.athletics.enabled) ||
    n.athletics.stage > t.athletics.stage ||
    n.athletics.secondary > t.athletics.secondary ||
    (n.cardio.enabled && !t.cardio.enabled) ||
    n.cardio.minutes > t.cardio.minutes ||
    (n.trial.kind !== 'none' && JSON.stringify(n.trial) !== JSON.stringify(t.trial)) ||
    (n.athletics.variation !== 'none' && n.athletics.variation !== t.athletics.variation) ||
    n.athletics.variationEffort > t.athletics.variationEffort;
  if (increases && PROGRAM.weekInfo(t.week).held)
    return 'No new dose in checkpoint, Realization, taper or pivot. Retain or reduce an earned dose.';
  if (increases && (!ready || !reason.trim()))
    return 'Record the eligibility review and a reason for the change.';
  if (increases && t.recovery !== 'normal') return 'Restore normal recovery before adding dose.';
  if (n.athletics.stage > t.athletics.stage + 1)
    return 'Advance only one athletic step after two productive exposures.';
  if (
    !t.athletics.enabled &&
    n.athletics.enabled &&
    (n.athletics.stage !== 0 || n.athletics.secondary || n.athletics.variation !== 'none')
  )
    return 'Introduce the primary athletic module at step 0 alone.';
  const components = ['enabled', 'stage', 'secondary', 'variation', 'variationEffort'].filter(
    (k) => n.athletics[k] !== t.athletics[k],
  );
  if (components.length > 1) return 'Change one athletic component at a time.';
  if (n.athletics.secondary > 0 && n.athletics.day === 'thursday')
    return 'Thursday is either the primary relocation or a second exposure, not both.';
  const dose = PROGRAM.athleticDose(n.athletics.stage);
  if (n.athletics.variation !== 'none' && (dose.runs < 4 || dose.meters < 20))
    return 'Flying/cutting replacements require a tolerated 4×20 m primary running dose.';
  if (n.athletics.variation === 'fly' && n.athletics.variationEffort < 90)
    return 'Flying work begins at 90%, then progresses to 95%.';
  if (n.athletics.variation === 'cut' && n.athletics.variationEffort > 90)
    return 'Cutting progresses from 75–85% to 85–90%.';
  if (!t.cardio.enabled && n.cardio.enabled && n.cardio.minutes !== 40)
    return 'Introduce aerobics at 20 minutes on Wednesday and Saturday.';
  if (n.cardio.minutes > t.cardio.minutes + (t.cardio.minutes < 60 ? 5 : 10))
    return 'Increase aerobics by 5 weekly minutes below 60, then 10, after two green weeks.';
  if (
    ['press', 'pause_jerk', 'calf_partial'].includes(n.trial.kind) &&
    (t.established || []).some((x) => x.kind === n.trial.kind)
  )
    return 'This assistance is already established; remove it before starting a different trial of the same type.';
  return '';
}
function trialLabel(t) {
  return `${prettyDay(t.day)} · ${t.kind === 'set' ? '+1 ' + (PROGRAM.exercises[t.exercise]?.[0] || t.exercise) : { squat: '+1 relevant squat set', press: 'Overhead press replacing incline', pause_jerk: 'Pause-dip jerk replacement', calf_partial: 'Calf partial-ROM replacement' }[t.kind] || t.kind}`;
}
function openTrialReview() {
  const t = STATE.training.trial;
  const exposures = STATE.records.filter(
    (r) =>
      r.trialSnapshot?.startedAt === t.startedAt &&
      r.session.rows.some((e) => e.trial && r.sets.some((s) => s.exerciseKey === e.key)),
  ).length;
  showModal(
    'Assistance trial review',
    `<p>${esc(trialLabel(t))}</p><p>${exposures} logged trial exposures. Review tolerance at 2, direction at 4, benefit at 8; a promising trial may continue another 4. Stop for pain or interference.</p>${select(
      'Decision',
      'trial-decision',
      [
        ['continue', 'Continue trial'],
        ['retain', 'Retain this dose; free the trial slot'],
        ['stop', 'Remove this trial'],
      ],
      'continue',
    )}<label class="field">Outcome / next review<textarea id="trial-outcome" required></textarea></label><p id="trial-error" class="error"></p>${button('Save trial review', 'saveTrialReview()', 'primary wide')}`,
  );
}
function saveTrialReview() {
  const t = STATE.training,
    decision = $('trial-decision').value,
    notes = $('trial-outcome').value;
  if (!notes.trim()) {
    $('trial-error').textContent =
      'Record what changed and why the dose is being retained, continued or removed.';
    return;
  }
  t.review.push({ kind: 'trial-review', at: Date.now(), decision, notes, trial: { ...t.trial } });
  if (decision === 'retain') {
    t.established = t.established || [];
    t.established.push({ ...t.trial, acceptedAt: Date.now() });
  }
  if (decision !== 'continue') t.trial = { kind: 'none', day: 'friday', exercise: 'shrug' };
  save();
  closeModal();
  render();
}
function removeEstablished(index) {
  const t = STATE.training,
    removed = t.established.splice(index, 1)[0];
  t.review.push({ kind: 'removed-addition', at: Date.now(), trial: removed });
  save();
  render();
}
function saveHeavy() {
  const t = STATE.training,
    h = {
      snatch: Number($('heavy-snatch').value),
      cj: Number($('heavy-cj').value),
      extraSnatch: Number($('extra-snatch').value),
      extraCj: Number($('extra-cj').value),
    },
    assessment = $('assessment').value;
  const cap = t.phaseGate === 'F' ? 90 : t.phaseGate === 'B' ? 92 : 95;
  const error = (msg) => {
    $('heavy-error').textContent = msg;
  };
  if ([h.snatch, h.cj].some((n) => n !== 0 && (n < 85 || n > cap)))
    return error(`Earned final D must be 85–${cap}% or 0 for the base prescription.`);
  if ([h.extraSnatch, h.extraCj].some((n) => !Number.isInteger(n) || n < 0 || n > 12))
    return error('Enter a whole replacement count from 0–12.');
  const increases = Object.keys(h).some((k) => h[k] > t.heavy[k]);
  if (increases && ([4, 8, 11, 12, 13].includes(t.week) || t.recovery !== 'normal'))
    return error('No added heavy exposure in checkpoints, week 11/12, pivot or reduced weeks.');
  // Final-D load can progress within Realization, but new weekly dose cannot.
  if (h.extraSnatch > t.heavy.extraSnatch + 1 || h.extraCj > t.heavy.extraCj + 1)
    return error(
      'Add only one weekly replacement for one lift after two green weeks at the current dose.',
    );
  if ((h.extraSnatch || h.extraCj) && t.phaseGate === 'F')
    return error('Additional >90% practice requires Build/Realization eligibility.');
  const snatchChanged = h.snatch !== t.heavy.snatch || h.extraSnatch !== t.heavy.extraSnatch,
    cjChanged = h.cj !== t.heavy.cj || h.extraCj !== t.heavy.extraCj;
  if (increases && snatchChanged && cjChanged)
    return error('Progress one lift at a time while other workload changes are held.');
  if ((h.extraSnatch && !h.snatch) || (h.extraCj && !h.cj))
    return error('Earn the final D exposure before adding other heavy slots.');
  if (increases && !$('heavy-ready').checked)
    return error('Review eligibility and subsequent recovery before increasing heavy practice.');
  if (assessment === 'jerk' && t.reduceCJerk)
    return error(
      'Resolve the C-to-D recovery issue before replacing reduced jerk work with an assessment.',
    );
  if (assessment !== 'none' && (!['F', 'B'].includes(info().phase) || !$('heavy-ready').checked))
    return error(
      'Component assessments require two secure weeks in F/B, including a green checkpoint.',
    );
  t.heavy = h;
  t.assessment = assessment;
  t.review.push({
    kind: 'heavy',
    at: Date.now(),
    week: t.week,
    cycle: t.cycle,
    heavy: h,
    assessment,
  });
  save();
  render();
  toast('Replacements saved.');
}
function saveMobility() {
  const names = [
    'Bent-knee ankle wall stretch',
    'Bench lat stretch · ribs controlled',
    'Front-rack wrist stretch',
    'Hip 90/90',
  ].filter((_, i) => $('mobility-' + i).checked);
  if (names.length > 2) {
    toast('Choose at most two actual restrictions.');
    return;
  }
  STATE.training.mobility = names;
  STATE.training.mobilitySeconds = Number($('mobility-seconds').value);
  STATE.training.mobilityDays = Number($('mobility-days').value);
  save();
  render();
}
function setPosition() {
  const t = STATE.training,
    week = Number($('position-week').value),
    cycle = Number($('position-cycle').value);
  if (!Number.isInteger(week) || week < 1 || week > 13 || !Number.isInteger(cycle) || cycle < 1) {
    toast('Use a valid cycle and week 1–13.');
    return;
  }
  Object.assign(t, {
    week,
    cycle,
    phaseGate: $('position-phase').value,
    entryStage: Number($('entry-stage').value),
    onboarding: $('onboarding').checked,
    exposure: t.exposure + 1,
    assessment: 'none',
  });
  save();
  render();
  toast('Program position set.');
}
function download(data, name) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    ),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportData() {
  download(durable(), 'oly-tracker-revision6-' + dateISO() + '.json');
}
function exportLegacy() {
  download(STATE.legacy, 'oly-tracker-before-revision6.json');
}
async function importData(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const data = MODEL.migrate(JSON.parse(await file.text()));
    if (
      !confirm(
        'Replace current app state with this backup? Export current data first if you need both versions.',
      )
    )
      return;
    STATE = {
      ...data,
      view: data.activeWorkout ? 'workout' : 'home',
      selectedDay: STATE.selectedDay,
    };
    save();
    render();
  } catch (e) {
    toast('Import rejected: ' + e.message);
  }
  input.value = '';
}
const GUIDE = [
  [
    'The weekly prescription',
    'A Monday: snatch and CJ. B Tuesday: CJ, hang snatch, front squat, low-rep flat bench, accessories. C Thursday: snatch, rack jerk, provisional explosive snatch pulls. D Friday: snatch, CJ, high-bar squat, moderate flat bench, accessories. Split B/D after lateral raises if useful: 9 base failure sets in visit 1, 13 in visit 2 at least 3 h later. One visit is acceptable with full rest and normal execution.',
  ],
  [
    'Failure means the conventional work sets',
    'All squat, bench and hypertrophy work sets: strict-form failure / 0 RIR, about 2 s eccentric. Free weights stop at the last valid rep; use safeties/spotter. Stable machines/cables may include a controlled unsuccessful final attempt. No forced reps, drop sets, cheating or unplanned partials. Log TECH and pain separately. Olympic lifts, explosive pulls, warm-ups, sprints, jumps and mobility never go to failure.',
  ],
  [
    'Thirteen weeks, repeated four times',
    'Weeks 1–3 Foundation; week 4 holds week 3 at a green checkpoint. Weeks 5–7 Build; week 8 holds week 7. Weeks 9–11 Realization; Friday 11 has one failure set per conventional exercise. Week 12 tapers and tests Friday; bench Monday 3–5 and Saturday 6–8, after testing. Week 13 pivots: Monday/Thursday SN 4 singles + CJ 3 pairs at 60–70%, effort 6; Tuesday/Friday no Olympic work, squat 4–6, bench and recovered base accessories. Interruptions extend elapsed time; never compress work to a deadline.',
  ],
  [
    'Entry and phase gates',
    'First cycle: stage 1 uses low-end Olympic loads and ceil(⅔ sets), one set per accessory + squat and bench (14/day). Stage 2: full Olympic work if green; incline 2, lateral 3, row 2, others 1 (18/day). Stage 3: full base (22/day) only after both prior weeks green. Build requires two normal weeks ≥90% good work reps with no recurring receiving limitation. Realization requires secure 80–85% singles. Hold the last successful phase otherwise; week 12 becomes a ≤85% technical benchmark.',
  ],
  [
    'Olympic progression and misses',
    'Use the smallest increase after a normal week with ≥90% acceptable work reps, stable positions and effort inside the cap. F effort ≤7 except D ≤8; B/R ≤8; pulls ≤7. Two consecutive misses/same technical fault: reduce 5–10%, rest fully; either of the next two attempts poor ends the exercise. Misses count toward the attempt budget; never repay them. Component assessments stop at effort 8 or the first error with no retry.',
  ],
  [
    'Bench continuity',
    'One failure set on each of two distinct days; low 3–5 and moderate 6–8. Normal Tue/Fri spacing is 72/96 h. Preserve at least 48 actual hours when moving sessions, including across weeks. Tuesday can move to Wednesday only if Friday stays ≥48 h later; otherwise Friday low/Sunday moderate and shift next Tuesday. Friday can move to a ready Saturday. Whole-session deferrals carry their bench; do not duplicate it. Rescuing a bench must never compromise priority lifting.',
  ],
  [
    'Conventional load progression',
    'Squats/low bench: at the exact upper rep bound, add 2.5–5 lb after two normal successful exposures at that load. Above the bound: correct +2.5–5 lb next eligible exposure, no second overshoot required. Other multi-set exercises: every set at/above the upper bound, same load and standard, add the smallest increment. Every single-set row requires two successful exposures. Below the lower bound: reduce 5–10% next set/exposure after full rest. TECH, pain or subsequent recovery cost do not earn progression. Confirm subsequent recovery in History.',
  ],
  [
    'Weekly recovery review',
    'If two sessions fall >5% below normal, acceptable reps are <90% twice, or positions deteriorate twice: remove the obvious cause. Otherwise remove aerobic additions, then athletics, then local hypertrophy, protecting Olympic/squat support. Targeted reduction halves Olympic sets (ceil), low range, effort ≤7, omit pulls; one squat/bench if locally ready, incline/laterals ≤2 sets, other accessory rows ≤1. Full reset: half Olympic sets at 50–65%, effort ≤6; no pulls/squats/accessories, bench only if ready. Repeat the last successful week and restore +1 set per row/exposure. Do not replace reductions with lighter high-rep failure work.',
  ],
  [
    'Games, alcohol, and shifted sessions',
    'Demanding pickup replaces overlapping athletic work (secondary first) and may require deferring the affected whole lifting day. Casual skills can leave training unchanged. Known limited event: train only while sober/ready, without additions. Intoxicated, uncertain sobriety, dizzy, nauseated or poorly coordinated: no training and no barbell test of sobriety. Larger/uncertain exposure: after confirmed recovery use low-end Olympic practice, no PR, at most one failure set per already prescribed row; normal training returns at the next normal exposure. If Saturday test-week alcohol is larger/unfamiliar, move the bench after the event and after the Olympic test, preserving ≥48 h before the next bench.',
  ],
  [
    'Heavy-practice replacements',
    'Final D: after two secure 80–85% exposures, F can reach 85–88%; later F can retain one secure 85–90% exposure. B/R: after two secure 85–88% exposures, final D 90–92%; after two secure exposures, 93–95% in R. Final D may reach effort 9 in B/R. Additional heavy-dose trials: two green weeks at current dose, one extra >90% attempt per lift per week, replacing final C snatch / final B CJ, then penultimate D, then final A. Added attempts 90–92%, effort ≤8. Further replacements use remaining C/B then A, leaving one light A set. Review at 2/3/4 heavy attempts weekly; reverse additions that worsen priority work. Progress one lift at a time while other workload changes are held. No new heavy-dose additions in checkpoints, week 11/12 or reduced weeks.',
  ],
  [
    'Squat / overhead assistance trials',
    'After onboarding and two stable F/B weeks, explicitly review whether an extra relevant squat set could help clean stand-up or jerk drive; no plateau required. One extra 3–5 failure set after the base squat, before bench. Plausible fixation strength limitation can justify one Friday supported seated overhead press set 6–10 to failure, replacing an incline set. Paused dip assistance: 2 singles at 60–75% assessed RJ, 1 s pause, effort ≤7, replacing the first two C jerk sets. Without RJ use the distinct light 40–60% CJ regression. One trial at a time: tolerance at 2, direction at 4, benefit at 8 exposures; a promising trial may extend another 4. Stop for pain or interference.',
  ],
  [
    'Trial phase rules',
    'Checkpoints and weeks 9–10 retain the earned dose/load. Week 11: no pause-dip trial; Tuesday conventional trial retained, Friday one set per prescribed exercise and no extra squat. A Friday press replaces its only incline set. Week 12: none. Week 13: base dose, hold conventional/jerk trials until next Foundation. At the next cycle explicitly review whether to restart a held trial.',
  ],
  [
    'Component references and rack jerk',
    'After two secure F/B weeks, an eligible B can replace its ordinary CJ row with 3 CJ pairs at 60–70% and up to 3 full-clean singles, starting known-secure (usually CJ or lower); +5–10 lb after a secure rep. Next eligible C can replace rack work with up to 5 singles, capped by normal jerk-rep count. First about 80% CJ or lower; effort ≤6 +10–20 lb, 7 +5–10 lb, 8 stop. First error ends the assessment. These are demonstrated technical references, not inferred 1RMs. Normal rack jerk can add 2.5–5 lb after two wholly secure C exposures and may exceed its starting range/old reference. Watch whether Thursday rack work degrades Friday CJ. Reverse an implicated jerk increase first; if still impaired, trial one fewer C jerk set for two exposures, suspending C assistance. Retain only if Friday improves and ordinary jerk execution stays normal. If Monday doubles repeatedly compromise B, reduce A snatch to 4×2 before adding other work.',
  ],
  [
    'Optional athletic work',
    'Introduce only after two stable green weeks with no other dose increase, normally week 5 after weeks 3/4. Monday after A, preferably ≥3 h later; Thursday backup. Start 2×3 jumps and 3×10 m at 85–90%. After two good exposures at each step: 3×3 jumps, then 3×15 m, then 90–95%, then +3 jumps; alternate run progress (20 m, then +one run) with +3 jumps. Review 4×3 jumps / 4×20 m; not a ceiling. After four productive primary exposures, a second Thursday can start 2×3 jumps; after two green Thursday exposures add 2×10 m. Watch Friday.',
  ],
  [
    'Later athletic options and returns',
    'After 4×20 m is tolerated, on alternate exposures replace the last two runs with 2 flying 10s (20 m run-in, 90%, then 95% after two successes, rest 3–4 min) OR two sets of a 45° cut/side (5 m in/out, 75–85% then 85–90%, rest 2 min). Toggle the replacement off on the intervening exposure. Review 24–36 jumps and 6–8 runs without treating those as ceilings. Checkpoint/R9–10 hold. Week 11: Monday only, half jump sets/run reps rounded up. Week 12: none. Pivot: recovered pre-taper dose, no additions. After >14 days away, step back once for two exposures. Games replace overlapping modules, secondary first.',
  ],
  [
    'Aerobics and mobility',
    'Introduce aerobics separately from other dose increases after two green lifting weeks: Wed/Sat 20 min cycle/walk, RPE 3–4 full-sentence talk test. After two green weeks add 5 minutes to one session to 30+30; then +10 weekly moving minutes at a time to 150, and after a full tolerated cycle at 150, toward 300. Split longer doses into walks after priority work if needed. Checkpoint/R hold; week 12 no formal aerobic work or added walking (easy 10–15 min allowed); pivot restores tolerated dose without adding. Mobility: at most two restrictions, 2×30 s/side, rest 15 s, 3 days/week and 5 active reps. If unchanged after two weeks, 45 s or a fourth day.',
  ],
  [
    'Exercise substitutions and early review',
    'Cable and DB lateral raises are both menu options. Overhead cable triceps is the default; pressdown is an actual-intolerance fallback. Standing knee-extended calves both days; supported knee-extended calf press if shoulder loading is unsuitable. Leg extension prefers a securely supported reclined hip angle about 40° anatomical flexion; use upright if the machine cannot support it. After two stable F/B weeks, a planned calf trial can replace ONE Friday set with heel-down-to-neutral partials for 10–15 failure reps, fixed range. Provisional snatch pulls: at the first green checkpoint, if no clear target, omit for two C exposures with other changes held; retain omission if no useful performance is lost.',
  ],
  [
    'Dose review and physique priorities',
    'Base per B/D: incline 3, lateral 4, row 2, pulldown 1, shrug 1, rear delt 1, curl 1, overhead triceps 1, seated leg curl 2, standing calf 2, reclined leg extension 1, crunch 1, plus one squat and one bench. One weekly set addition at a time after two stable normal F/B weeks; observe two weeks. Priority-1 support first, then incline/delts; early trap trial after the first successful cycle can move 2→4 weekly sets one at a time. No glute isolation; retain useful squats. Later first sets losing ≥2 reps repeatedly despite full rest: trial the split for two exposures, then remove the latest addition if impairment persists.',
  ],
];
function renderGuide() {
  return (
    header(
      'EXECUTION GUIDE',
      'Rules for the work',
      'Revision 6 · Keep the higher-priority work productive.',
    ) +
    GUIDE.map(
      ([title, text]) =>
        `<details class="guide-card"><summary>${esc(title)}</summary><p>${esc(text)}</p></details>`,
    ).join('') +
    `<details class="guide-card"><summary>Exercise-specific warm-ups</summary>${Object.entries(
      PROGRAM.ramps,
    )
      .map(([k, v]) => `<h3>${esc(k)}</h3><p>${esc(v)}</p>`)
      .join('')}</details>`
  );
}
document.addEventListener('DOMContentLoaded', () => {
  const needsSave = load();
  // Only migrate known legacy data; a corrupt stored record is never overwritten.
  if (!STATE.storageError) {
    if (needsSave) save(false);
    else publishDayDurations();
  }
  document
    .querySelectorAll('[data-view]')
    .forEach((b) => b.addEventListener('click', () => nav(b.dataset.view)));
  $('modal').addEventListener('click', (e) => {
    if (e.target === $('modal')) closeModal();
  });
  render();
  restTick = setInterval(tickTimers, 1000);
  if ('serviceWorker' in navigator)
    navigator.serviceWorker
      .register('./sw.js')
      .catch(() => toast('Offline cache unavailable; online logging still works.'));
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    tickTimers();
    if (STATE.activeWorkout) requestWakeLock();
  }
});
window.addEventListener('storage', (e) => {
  if (e.key === 'oly_state' && !STATE.activeWorkout) {
    load();
    render();
  }
});
