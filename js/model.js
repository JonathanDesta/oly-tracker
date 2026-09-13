'use strict';
const MODEL = (() => {
  const P = typeof module !== 'undefined' ? require('./program.js').PROGRAM : PROGRAM;
  function migrate(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('Expected an Oly Tracker state object.');
    if (data.revision === 6 && data.training) {
      const base = P.defaults(),
        t = data.training;
      if (typeof t !== 'object' || Array.isArray(t))
        throw new Error('Invalid training configuration.');
      if (data.records != null && !Array.isArray(data.records))
        throw new Error('Invalid workout history.');
      const validSession = (r) =>
        r &&
        typeof r === 'object' &&
        r.session &&
        Array.isArray(r.session.rows) &&
        Array.isArray(r.sets) &&
        r.session.rows.every((e) => e && P.exercises[e.id] && typeof e.key === 'string');
      if ((data.records || []).some((r) => !validSession(r)))
        throw new Error('Invalid saved session.');
      if (
        data.activeWorkout &&
        (!validSession(data.activeWorkout) || !Array.isArray(data.activeWorkout.omitted))
      )
        throw new Error('Invalid active workout.');
      const next = {
        ...data,
        training: {
          ...base,
          ...t,
          anchors: { ...base.anchors, ...t.anchors },
          heavy: { ...base.heavy, ...t.heavy },
          athletics: { ...base.athletics, ...t.athletics },
          cardio: { ...base.cardio, ...t.cardio },
          trial: { ...base.trial, ...t.trial },
        },
        records: Array.isArray(data.records) ? data.records : [],
      };
      next.training.week = Math.max(1, Math.min(13, Number(t.week) || 1));
      next.training.cycle = Math.max(1, Number(t.cycle) || 1);
      next.training.exposure = Math.max(1, Number(t.exposure) || 1);
      for (const k of ['snatch', 'cj', 'jerk', 'clean']) {
        const v = next.training.anchors[k];
        next.training.anchors[k] =
          Number(v) > 0 ? Number(v) : k === 'snatch' ? 155 : k === 'cj' ? 205 : null;
      }
      return next;
    }
    if (
      Object.keys(data).length &&
      !('log' in data || 'maxes' in data || 'program' in data || 'activeWorkout' in data)
    )
      throw new Error('This file does not look like an Oly Tracker export.');
    // Preserve the complete previous state, including in-progress legacy work,
    // maxes, timers and old progression. None are relabelled as Revision 6 logs.
    return {
      revision: 6,
      schemaVersion: 4,
      ts: data.ts || 0,
      training: P.defaults(),
      records: [],
      pristine: Object.keys(data).length === 0,
      legacyArchives: [],
      activeWorkout: null,
      readiness: { date: null, level: 'green', event: 'normal', localIssue: '' },
      legacy: Object.keys(data).length ? data : null,
      migratedAt: Date.now(),
      restEnd: 0,
    };
  }
  function fingerprint(ex) {
    return [ex.key, ex.name, ex.repRange?.join('-') || ex.reps].join('|');
  }
  function qualityState(ex, rows) {
    let consecutive = 0,
      misses = 0,
      lastFault = '',
      reducedAt = -1,
      stop = false;
    rows.forEach((r, i) => {
      const bad = r.outcome !== 'make' || r.grade === 'C';
      misses = r.outcome !== 'make' ? misses + 1 : 0;
      if (ex.assessment && (bad || r.effort >= 8)) stop = true;
      if (reducedAt >= 0 && i > reducedAt && i <= reducedAt + 2 && bad) stop = true;
      const fault = r.fault || r.outcome;
      if (bad) {
        consecutive = fault === lastFault ? consecutive + 1 : 1;
        lastFault = fault;
      } else {
        consecutive = 0;
        lastFault = '';
      }
      if ((consecutive >= 2 || misses >= 2) && reducedAt < 0) reducedAt = i;
    });
    const reps = typeof ex.reps === 'number' ? ex.reps : 1;
    const planned = ex.repSequence
      ? ex.repSequence.reduce((n, r) => n + (typeof r === 'number' ? r : 1), 0)
      : ex.sets * reps;
    return {
      planned,
      done: rows.length >= planned || stop,
      stop,
      reducedAt,
      loadCap: reducedAt >= 0 ? rows[reducedAt].weight * 0.925 : null,
      message: stop
        ? 'End this exercise. Do not repay missed attempts.'
        : reducedAt >= 0
          ? 'Reduce 5–10%, rest fully. Either of the next two attempts poor: end the exercise.'
          : '',
    };
  }
  function slotAt(ex, attempt) {
    if (ex.repSequence) {
      let end = 0;
      for (let i = 0; i < ex.repSequence.length; i++) {
        end += typeof ex.repSequence[i] === 'number' ? ex.repSequence[i] : 1;
        if (attempt < end) return i;
      }
      return ex.sets - 1;
    }
    return Math.floor(
      attempt / (ex.kind === 'quality' && typeof ex.reps === 'number' ? ex.reps : 1),
    );
  }
  function reviewAdvance(training, review) {
    const t = JSON.parse(JSON.stringify(training));
    t.review = (t.review || []).concat({ ...review, at: Date.now(), week: t.week, cycle: t.cycle });
    t.exposure++;
    t.phaseGate = review.realizationReady ? 'R' : review.buildReady ? 'B' : 'F';
    if (
      review.action === 'repeat' ||
      (t.onboarding && t.cycle === 1 && t.entryStage < 3 && !review.green)
    )
      return t;
    if (t.week === 13) {
      t.cycle++;
      t.week = 1;
      t.onboarding = false;
      t.entryStage = 3;
      t.trial = { kind: 'none', day: 'friday', exercise: 'shrug' };
      t.recovery = 'normal';
    } else t.week++;
    if (t.onboarding && t.cycle === 1 && t.week <= 3 && review.green)
      t.entryStage = Math.min(3, t.entryStage + 1);
    if (review.buildReady) t.phaseGate = 'B';
    if (review.realizationReady) t.phaseGate = 'R';
    t.assessment = 'none';
    return t;
  }
  function benchRecords(state) {
    const rows = state.records.slice();
    if (state.activeWorkout) rows.push(state.activeWorkout);
    // Historical bench attempts still matter for actual 48-hour spacing.
    const legacyRecords = [state.legacy, ...(state.legacyArchives || [])]
      .filter(Boolean)
      .flatMap((source) => [
        ...Object.values(source.log || {}),
        ...(source.activeWorkout ? [source.activeWorkout] : []),
      ]);
    for (const record of legacyRecords) {
      const flat = Object.values(record.setsLogged || {}).flat();
      const all = [...flat, ...(Array.isArray(record.sets) ? record.sets : [])];
      const sets = all
        .filter((s) => ['bench', 'bench_press'].includes(s.exerciseId || s.exId))
        .map((s) => ({
          ...s,
          exerciseId: 'bench',
          at:
            Number(s.ts || s.timestamp || s.at || record.completedAt) ||
            new Date(record.date + 'T23:59:59').getTime(),
        }));
      if (sets.length) rows.push({ sets });
    }
    return rows;
  }
  return { migrate, fingerprint, qualityState, slotAt, reviewAdvance, benchRecords };
})();
if (typeof module !== 'undefined') module.exports = { MODEL };
