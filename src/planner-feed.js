import { defaults, dayPlan } from "./prescription.js";
import {
  planFor,
  scheduledDate,
  addDays,
  localDate,
  benchWindow,
} from "./training.js";
import { fixedSession, fixedDay } from "./timeline.js";
import { paceStatus } from "./pacing.js";
import { canonical } from "./cloud-sync.js";
import { programDays, SLOT_LETTERS, scheduleName } from "./calendar.js";

export const FEED_KEY = "oly_planner_feed_v1";
const median = (values) => {
  const a = values.slice().sort((a, b) => a - b);
  const n = a.length;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
};
export function prescriptionSignature(session, config = {}) {
  return canonical({
    session: session.id,
    ...(config.continuation ? { continuation: true } : {}),
    kind: session.kind,
    equipment: config.equipment || {},
    unilateralCable: config.timing?.unilateralCable !== false,
    rows: session.rows.map((e) =>
      Object.fromEntries(
        [
          "id",
          "key",
          "kind",
          "sets",
          "reps",
          "repRange",
          "repSequence",
          "range",
          "sequence",
          "rest",
          "afterRest",
          "entryRecovery",
          "endpointPolicy",
          "warmupVersion",
          "selfSelectedLoad",
          "validRepRange",
          "resetSeconds",
          "recoveryAfter",
          "regression",
          "holdSeconds",
          "minutes",
          "setup",
        ]
          .filter((k) => e[k] !== undefined)
          .map((k) => [k, e[k]]),
      ),
    ),
  });
}
export function calibrationDefaults() {
  const config = defaults();
  return {
    excludedRecordIds: [],
    observations: [
      {
        id: "reported-intro-a-45",
        signature: prescriptionSignature(
          dayPlan(config, "monday").sessions.find((s) => s.id === "main"),
          config,
        ),
        seconds: 2700,
        includesChange: false,
        source:
          "User reported · introductory A · all warm-ups and rests included",
      },
    ],
  };
}
export function forecastSession(state, session, config = state.training) {
  const signature = prescriptionSignature(session, config);
  const calibration = state.calibration || calibrationDefaults();
  const records = state.records.filter(
    (r) =>
      r.status === "complete" &&
      !calibration.excludedRecordIds.includes(r.id) &&
      !r.timingExcluded &&
      r.endedAt > r.startedAt &&
      r.endedAt - r.startedAt < 10 * 3600000 &&
      prescriptionSignature(
        r.session,
        r.timeConfig || { equipment: r.equipment, timing: r.timing },
      ) === signature,
  );
  const observed = records
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, 5)
    .map((r) => ({
      seconds: (r.endedAt - r.startedAt) / 1000,
      includesChange: r.timingIncludesChange === true,
      source: "Completed matching session",
    }));
  // Seed observations are used until actual matching sessions are available.
  if (!observed.length)
    observed.push(
      ...calibration.observations
        .filter((o) => o.signature === signature)
        .slice(-5),
    );
  const guideSeconds = fixedSession(session, config, config).seconds[0];
  return {
    signature,
    guideSeconds,
    forecastSeconds: Math.round(
      observed.length
        ? median(
            observed.map((o) => o.seconds + (o.includesChange ? 0 : 600)),
          ) - (observed.every((o) => o.includesChange) ? 0 : 600)
        : guideSeconds,
    ),
    postChangeSeconds:
      observed.length && observed.every((o) => o.includesChange) ? 0 : 600,
    basis: observed.length
      ? records.length
        ? "measured"
        : "reported"
      : "model",
    sampleCount: observed.length,
    coverage: {
      warmups: true,
      rests: true,
      travel: false,
      postChange:
        observed.length > 0 && observed.every((o) => o.includesChange),
    },
  };
}
export function buildPlannerFeed(state, now = Date.now()) {
  const entries = [];
  for (const day of programDays(state.training).filter((d) =>
    dayPlan(state.training, d).sessions.some((s) =>
      ["main", "support"].includes(s.id),
    ),
  )) {
    const active = state.active?.day === day ? state.active : null;
    const plan = planFor(
      state,
      day,
      scheduledDate(state, day) === localDate(new Date(now)),
      now,
    );
    const included = plan.sessions
      .filter((s) => s.kind !== "mobility")
      .map((s) => (active?.session.id === s.id ? active.session : s));
    const dayTiming = fixedDay({ ...plan, sessions: included }, state.training);
    const sessionForecasts = included.map((s, index) => ({
      session: s,
      ...forecastSession(
        state,
        s,
        active?.session.id === s.id
          ? active.timeConfig || state.training
          : {
              ...state.training,
              continuation:
                included
                  .slice(0, index)
                  .some((p) => !p.skipped && p.rows.length) &&
                (s.id === "support" ||
                  ["cardio", "mobility"].includes(s.kind) ||
                  (s.kind === "athletic" &&
                    state.training.timing?.athleticsVisit === "same")),
            },
      ),
      ...(s.skipped || !s.rows.length
        ? { forecastSeconds: 0, postChangeSeconds: 0 }
        : {}),
    }));
    // Each model includes only its own visit overhead; measured continuations
    // already exclude it. Never subtract hypothetical arrival/breaks from logs.
    const seconds = sessionForecasts.reduce((n, f) => n + f.forecastSeconds, 0);
    const records = state.records.filter(
      (r) => r.weekId === state.weekId && r.day === day,
    );
    const complete = included.every(
      (s) =>
        !s.rows.length ||
        s.skipped ||
        records.some((r) => r.session.id === s.id),
    );
    const latestRecord = records
      .filter((r) => r.endedAt)
      .sort((a, b) => b.endedAt - a.endedAt)[0];
    let activeRemainingSeconds = null;
    if (active) {
      const timing = paceStatus(active, now);
      // Live guided remaining time protects actual rests and ongoing work.
      activeRemainingSeconds =
        timing?.remaining ??
        Math.max(0, seconds - (now - active.startedAt) / 1000);
      const activeIndex = included.findIndex((s) => s.id === active.session.id);
      activeRemainingSeconds += sessionForecasts
        .slice(activeIndex + 1)
        .reduce((n, f) => n + f.forecastSeconds, 0);
    }
    entries.push({
      id: `${state.weekId}:${day}`,
      day,
      label: SLOT_LETTERS[day]
        ? `Workout ${SLOT_LETTERS[day]}`
        : "Moderate bench",
      date: active?.date || scheduledDate(state, day),
      notBefore:
        !active &&
        included.some((s) => !s.skipped && s.rows.some((e) => e.id === "bench"))
          ? benchWindow(state, now).eligibleAt
          : null,
      signature: canonical(sessionForecasts.map((f) => f.signature)),
      forecastSeconds: Math.round(seconds),
      guideSeconds: sessionForecasts.reduce((n, f) => n + f.guideSeconds, 0),
      postChangeSeconds: sessionForecasts.at(-1)?.postChangeSeconds ?? 600,
      basis: sessionForecasts.every((f) => f.basis !== "model")
        ? sessionForecasts[0].basis
        : "model",
      sampleCount: Math.min(...sessionForecasts.map((f) => f.sampleCount)),
      coverage: { warmups: true, rests: true, travel: false },
      visits: dayTiming.visits,
      complete,
      active: !!active,
      startedAt: active?.startedAt || records[0]?.startedAt || null,
      endedAt: complete ? latestRecord?.endedAt || null : null,
      activeRemainingSeconds,
      modules: included.map((s) => ({
        id: s.id,
        title: s.title || s.name || s.id,
        rows: s.rows.length,
      })),
    });
  }
  return {
    schema: 1,
    type: "oly:planner-feed",
    generatedAt: now,
    sourceRevision: state.version,
    sourceUpdatedAt: state.updatedAt,
    weekId: state.weekId,
    weekStart: state.weekStart,
    program: {
      week: state.training.week,
      entry: state.training.entry,
      cycle: state.training.cycle,
      completed: state.completed,
      schedule: state.training.schedule,
      scheduleName: scheduleName(state.training),
    },
    repeatDays: programDays(state.training),
    repeatStart:
      entries.length && !state.training.nextSchedule
        ? [
            addDays(state.weekStart, 7),
            addDays(
              entries.find((e) => e.day === "friday")?.date || state.weekStart,
              3,
            ),
          ]
            .sort()
            .at(-1)
        : null,
    entries,
  };
}
// Projections contain no tokens, API keys or executable commands.
export function journalEntities(state) {
  const result = {
    program: Object.fromEntries(
      [
        "schema",
        "training",
        "weekId",
        "weekStart",
        "dates",
        "completed",
        "benchReservations",
      ].map((k) => [k, state[k]]),
    ),
    active: { active: state.active, restEnd: state.restEnd },
    readiness: state.readiness,
    calibration: state.calibration || calibrationDefaults(),
    archives: state.archives,
  };
  for (const r of state.records) result[`record:${r.id}`] = r;
  for (const r of state.reviews) result[`review:${canonical(r)}`] = r;
  for (const e of state.events) result[`event:${e.id || canonical(e)}`] = e;
  for (const key of ["legacy", "legacyArchives", "athleticDay"])
    if (state[key] !== undefined) result[key] = state[key];
  return result;
}
export function adoptJournalEntities(state, entities) {
  if (!entities.program || !entities.active || !entities.calibration)
    throw Error(
      "Cloud journal is missing required data. The local journal is intact.",
    );
  return {
    ...state,
    ...entities.program,
    ...entities.active,
    readiness: entities.readiness || null,
    calibration: entities.calibration,
    archives: entities.archives || [],
    records: Object.entries(entities)
      .filter(([k]) => k.startsWith("record:"))
      .map(([, v]) => v)
      .sort((a, b) => a.startedAt - b.startedAt),
    reviews: Object.entries(entities)
      .filter(([k]) => k.startsWith("review:"))
      .map(([, v]) => v)
      .sort((a, b) => a.at - b.at),
    events: Object.entries(entities)
      .filter(([k]) => k.startsWith("event:"))
      .map(([, v]) => v),
    ...Object.fromEntries(
      ["legacy", "legacyArchives", "athleticDay"]
        .filter((k) => entities[k] !== undefined)
        .map((k) => [k, entities[k]]),
    ),
  };
}
