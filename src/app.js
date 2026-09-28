import {
  doseText,
  changeLabel,
  nextOptionalChange,
  athleticAlternatives,
  weekdayFor,
  introductionStatus,
  observation,
  optionalStatus,
  optionalPreview,
  applyGuidedChange,
  secondaryKind,
  optionalKind,
} from "./additions.js";
import {
  DOSE_STAGES,
  DOSE_VERSION,
  MUSCLES,
  MUSCLE_DECISIONS,
  DOSE_REVIEWS,
  doseLedger,
} from "./dose.js";
import {
  allLoadedFailure,
  olympicFailure,
  failureTrialPending,
  failureSets,
  validReps,
} from "./failure-policy.js";
import {
  programDays,
  primaryAthleticSlot,
  SLOT_LETTERS,
  weekdaySchedule,
  threeDaySchedule,
  secondaryAthleticSlot,
  scheduleName,
  scheduleTrialPending,
  setSchedule,
} from "./calendar.js";
import { installPlannerIntegration } from "./planner-integration.js";
import { PushAlerts } from "./push-alerts.js";
import { TimerAlerts, currentAlarm } from "./timer-alerts.js";
import {
  DAYS,
  PHASE_NAMES,
  phaseFor,
  describe,
  loadRange,
  dayPlan,
  copy,
  sportEvent,
} from "./prescription.js";
import {
  fresh,
  localDate,
  scheduledDate,
  contextFor,
  planFor,
  weekRecords,
  consumedBench,
  benchWindow,
  startSession,
  useFullWorkout,
  startMobility,
  completeMobilityStep,
  startAerobic,
  pauseAerobic,
  finishAerobic,
  deferDay,
  omissionRecord,
  rowStatus,
  nextRow,
  slotAt,
  nextQualityRange,
  logSet,
  logOlympicSet,
  correctOlympicSet,
  moveExerciseNext,
  chooseOlympicLoad,
  omitRow,
  finishSession,
  deleteSession,
  stopSession,
  benchmark,
  easyReturn,
  exposureHistory,
  nextLoad,
  advanceWeek,
  monitoring,
  monitoringTotals,
  normal,
  uid,
  reassessActive,
} from "./training.js";
import { loadStore, saveStore, importData, KEY } from "./storage.js";
import {
  minutesText,
  timeProfile,
  validTimeProfile,
  TIME_LABELS,
} from "./duration.js";
import {
  CHANGE_OPTIONS,
  sourceOlympicChange,
  applyChange,
  reviewTrial,
  trialExposures,
} from "./review.js";
import {
  mobilitySteps,
  preparationElapsed,
  startPreparation,
  pausePreparation,
  finishPreparation,
} from "./routines.js";
import {
  fixedDay as estimateDay,
  fixedSession as estimateSession,
  targetSeconds,
} from "./timeline.js";
import {
  createPacing,
  syncPacing,
  paceStage,
  paceStatus,
  paceSeconds,
  paceElapsed,
  paceMinimum,
  startPaceStage,
  pausePace,
  extendPace,
  endPaceSet,
  completePaceStage,
  takePaceBreak,
  finishPaceBreak,
} from "./pacing.js";
const $ = (id) => document.getElementById(id);
const APP_BUILD = "7.25";
let plannerIntegration;
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const pretty = (d) => d[0].toUpperCase() + d.slice(1);
const fmt = (n) =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
const time = (s) =>
  `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
const stamp = (n) =>
  new Date(n).toLocaleString(undefined, {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const weekdayLabel = (date, short = false) =>
  new Date(date + "T12:00:00Z").toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: short ? "short" : "long",
  });
const calendarWeekday = (day, short = false) =>
  weekdayLabel(scheduledDate(state, day), short);
const dateLabel = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
let state,
  storageError = "",
  view = "week",
  selected = "monday",
  guidePage = 1,
  pages = null,
  lastFocus = null,
  toastTimer,
  wakeLock;
try {
  const loaded = loadStore(localStorage);
  state = loaded.state;
  storageError = loaded.error;
  if (loaded.recovered)
    storageError = "Recovered the last valid backup. " + storageError;
} catch (e) {
  storageError = e.message;
}
if (state?.active) view = "workout";
const pushAlerts = new PushAlerts();
const timerAlerts = new TimerAlerts({
  document,
  navigator,
  URL,
  Blob,
  storage: localStorage,
});
if (state)
  selected =
    programDays(state.training).find(
      (d) =>
        dayPlan(state.training, d).sessions.some((s) => s.id === "main") &&
        !weekRecords(state).some((r) => r.day === d && r.session.id === "main"),
    ) || "monday";
const btn = (text, action, extra = "", cls = "button") =>
  `<button type="button" class="${cls}" data-action="${action}" ${extra}>${esc(text)}</button>`;
const notice = (s, type = "") => `<div class="notice ${type}">${esc(s)}</div>`;
const input = (label, name, value = "", type = "text", extra = "") =>
  `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const textarea = (label, name, value = "", extra = "") =>
  `<label>${esc(label)}<textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`;
const check = (label, name, value = false) =>
  `<label class="check"><input name="${name}" type="checkbox" ${value ? "checked" : ""}><span>${esc(label)}</span></label>`;
const select = (label, name, choices, value) =>
  `<label>${esc(label)}<select name="${name}">${Object.entries(choices)
    .map(
      ([k, v]) =>
        `<option value="${esc(k)}" ${String(k) === String(value) ? "selected" : ""}>${esc(v)}</option>`,
    )
    .join("")}</select></label>`;
const submit = (text) =>
  `<button class="button primary" type="submit">${esc(text)}</button>`;
const title = (eyebrow, heading, sub = "") =>
  `<header class="page-header"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(heading)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</header>`;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 7000);
}
function transact(fn, message) {
  if (!state) throw Error("Recover your stored journal before making changes.");
  const next = copy(state);
  fn(next);
  if (next.active?.pacing)
    syncPacing(
      next.active,
      Object.fromEntries(
        next.active.session.rows.map((e) => [e.key, rowStatus(next.active, e)]),
      ),
    );
  state = saveStore(localStorage, next, state.version);
  storageError = "";
  if (message) toast(message);
  render();
}
function modal(heading, body) {
  if (!$("dialog").open) lastFocus = document.activeElement;
  $("dialog").innerHTML =
    `<div class="dialog-head"><h2 id="dialog-title">${esc(heading)}</h2>${btn("Close", "close", "", "quiet")}</div>${body}`;
  $("dialog").showModal();
  $("dialog").scrollTop = 0;
  $("dialog-title").tabIndex = -1;
  $("dialog-title").focus({ preventScroll: true });
}
function close() {
  if ($("dialog").open) $("dialog").close();
  lastFocus?.isConnected && lastFocus.focus();
}
function formModal(heading, id, body, button = "Save") {
  modal(
    heading,
    `<form data-form="${id}">${body}<p class="form-error" role="alert"></p><div class="form-actions">${submit(button)}</div></form>`,
  );
}
function nav(next) {
  view = next;
  close();
  render();
  window.scrollTo({ top: 0 });
}
function rowSource(e) {
  return olympicFailure(e) || e.amendment
    ? btn("Failure amendment ↗", "failure-guide", "", "source-link")
    : sourceLink(e.page || 7);
}
function sourceLink(page) {
  return `<button class="source-link" data-action="source" data-page="${page}">Program p.${page} ↗</button>`;
}
function resolved(day, id) {
  return weekRecords(state).find((r) => r.day === day && r.session.id === id);
}
function readinessCard() {
  const r = contextFor(state),
    labels = {
      green: "Green · normal",
      amber: "Amber · global fatigue",
      red: "Red · stop",
      unchecked: "Optional readiness check",
    };
  return `<section class="readiness-strip"><div><span class="status-dot ${r.level}"></span><strong>${labels[r.level]}</strong><p>${r.level === "unchecked" ? "Use today’s positions, coordination and familiar warm-ups." : `${r.local ? "Local " + r.local + " issue · " : ""}${r.event.replaceAll("_", " ")}${sportEvent(r) !== "normal" ? " · " + sportEvent(r).replaceAll("_", " ") : ""} · ${dateLabel(r.date)}`}</p></div>${btn(r.level === "unchecked" ? "Check readiness" : "Update readiness", "readiness", "", "button")}</section>`;
}
function workoutRowsDiffer(a, b) {
  const comparable = (rows) =>
    JSON.stringify(rows, (key, value) =>
      key === "trialIds" && Array.isArray(value) && !value.length
        ? undefined
        : value,
    );
  return comparable(a) !== comparable(b);
}
function weekView() {
  const t = state.training,
    phase = phaseFor(t),
    p = planFor(state, selected, true, Date.now(), false, true),
    full = planFor(state, selected, true, Date.now(), true, true),
    year = (t.cycle - 1) * 13 + t.week,
    timing = estimateDay(p, t);
  const plans = DAYS.map((d) => dayPlan(t, d)),
    failureSets = plans
      .flatMap((p) => p.sessions)
      .flatMap((s) => s.rows)
      .filter((e) => e.kind === "failure" || olympicFailure(e))
      .reduce((n, e) => n + e.sets, 0);
  return (
    title(
      `THE TRAINING JOURNAL / WEEK ${year} OF 52`,
      state.completed
        ? "A year of work."
        : "Build the lifts. Keep the quality.",
      `Cycle ${t.cycle} · Week ${t.week}/13 · ${PHASE_NAMES[phase.phase]}${t.entry < 3 ? " · Entry dose " + t.entry : ""}`,
    ) +
    notice(scheduleName(t)) +
    notice(
      "You control the schedule. Choose any workout tab and start it today, including on consecutive days. Dates, workout order and recovery intervals are recommendations.",
    ) +
    (allLoadedFailure(t)
      ? notice(
          `Loaded work: failure endpoint. Olympic sets end at the first miss or invalid rep. Lifting build-up ${t.failureEntry}/${DOSE_STAGES}. Use “Add or adjust training” for your next step and optional training plans.`,
        )
      : t.nextWorkSetPolicy
        ? notice(
            "Your active workout keeps its original prescription. The failure amendment starts as soon as you finish or end that session.",
          )
        : "") +
    (t.nextDoseVersion
      ? notice(
          "The new Monday/Wednesday/Friday routine is installed. Your already-started week keeps its saved sessions; the new allocation begins after the weekly review. Logs remain intact and introduction resumes at no higher than stage 2.",
        )
      : "") +
    (t.nextSchedule
      ? notice(
          `The ${t.nextSchedule === "weekday" ? "weekday" : "source"} plan starts after this saved week. Finish or resolve the existing sessions; saved dates and logs stay intact.`,
        )
      : "") +
    (scheduleTrialPending(t)
      ? notice(
          `New schedule: ${t.scheduleTrial.weeks.length}/2 full weeks reviewed. Compare the following Olympic sessions and record normal recovery in Weekly review.`,
        )
      : "") +
    (storageError ? notice(storageError, "warning") : "") +
    (state.completed
      ? notice(
          "The prescribed 52 weeks are complete. Your logs, reviews and source remain available.",
        )
      : "") +
    (state.active
      ? `<div class="resume-banner"><span>Session in progress · ${esc(state.active.session.title)}</span>${btn("Resume workout", "resume", "", "primary button")}</div>`
      : "") +
    `<div class="overview"><article><small>PRIORITY</small><strong>01 <span>Weightlifting</span></strong><p>Then hypertrophy, athleticism, longevity.</p></article><article><small>PLANNED THIS WEEK</small><strong>${failureSets} <span>failure sets</span></strong><p>${allLoadedFailure(t) ? "Includes Olympic and conventional loaded work." : "Separate from quality-limited Olympic work."}</p></article><article><small>BENCH CONTINUITY</small><strong>${["bench_low", "bench_moderate"].filter((k) => consumedBench(state, k)).length}<span> / 2 exposures</span></strong><p>Low 3–5 · moderate 6–8 · 48 hours recommended.</p></article></div>` +
    trainingLink() +
    readinessCard() +
    `<section class="week-section"><div class="section-label"><h2>The week ahead</h2><span>Phase first. Readiness second.</span></div><div class="week-days">${programDays(
      t,
    )
      .map(
        (d) =>
          `<button data-action="day" data-day="${d}" class="day ${selected === d ? "selected" : ""}" aria-pressed="${selected === d}"><small>${calendarWeekday(d, true)}</small><strong>${threeDaySchedule(t) && t.week !== 12 && d === "monday" ? "—" : SLOT_LETTERS[d] || "—"}</strong><span>${dateLabel(scheduledDate(state, d))}</span>${resolved(d, "main") ? '<i aria-label="Resolved">✓</i>' : ""}</button>`,
      )
      .join("")}</div></section>` +
    `<section class="day-content"><div class="section-label"><div><div class="eyebrow">${calendarWeekday(selected)} / ${dateLabel(scheduledDate(state, selected))}</div><h2>${selected === "wednesday" || selected === "sunday" || (threeDaySchedule(t) && t.week !== 12 && selected === "monday") ? "Recovery & readiness" : PHASE_NAMES[p.phase]}</h2></div>${btn("Move this day", "defer", `data-day="${selected}"`, "quiet")}</div>${p.notes.map((s) => notice(s)).join("")}${dayTime(timing)}${dosePanel(p)}${p.sessions
      .map((s, i) => {
        const ordinary = full.sessions.find((x) => x.id === s.id);
        const alternative =
          ordinary &&
          !ordinary.skipped &&
          ordinary.rows.length &&
          (s.skipped || workoutRowsDiffer(ordinary.rows, s.rows));
        return (
          preview(s, p, timing.sessions[i]) +
          (alternative
            ? `<details class="panel"><summary>Full planned workout · optional override</summary><p>The check-in recommends the adjusted plan above. You can choose the full plan below; the original readiness notes remain in your log.</p>${preview(ordinary, full, estimateSession(ordinary, t, t), true)}</details>`
            : "")
        );
      })
      .join(
        "",
      )}${!p.sessions.length ? '<div class="empty-card"><span>↘</span><h3>Space to recover.</h3><p>Off or targeted mobility is recommended. To train today, choose any workout tab above; its date will not block you.</p></div>' : ""}${mobilityCard(p, timing)}</section>` +
    `<div class="week-actions">${btn("Weekly review", "review", "", "primary button")}${btn("Rescue a bench slot", "rescue")}${t.athletics.enabled ? btn(`Relocate athletics to ${SLOT_LETTERS[secondaryAthleticSlot(t)]} · ${calendarWeekday(secondaryAthleticSlot(t))}`, "relocate", "", "quiet") : ""}</div>` +
    `${monitoring(state)
      .map((s) => notice(s, "warning"))
      .join(
        "",
      )}<p class="fine-print">Day letters stay with the session when dates move; tabs show the actual weekday. To move the whole week, select its first unresolved session and use Move this day. Later dates move only when you select that option. ${allLoadedFailure(t) && t.week === 12 ? "Monday work, Friday benchmark, then moderate bench" : threeDaySchedule(t) ? "B–rest–C–rest–D–rest–rest" : allLoadedFailure(t) && t.week === 13 ? "B–rest–rest–rest–D–rest–rest" : weekdaySchedule(t) && t.week !== 12 ? "B–C–rest–A–D–rest–rest" : "A–B–rest–C–D–rest–rest"}; the source recommends at most two consecutive normal Olympic days. These are planning recommendations, not start restrictions. Test week keeps its separate taper and post-test bench. ${sourceLink(23)}</p>`
  );
}
function dosePanel(p) {
  if (!allLoadedFailure(state.training)) return "";
  const day = doseLedger([p]),
    week = doseLedger(DAYS.map((d) => dayPlan(state.training, d)));
  const target = doseLedger(
    DAYS.map((d) =>
      dayPlan(
        {
          ...state.training,
          doseVersion: DOSE_VERSION,
          entry: 3,
          failureEntry: 4,
          week: 3,
          gate: "F",
          recovery: "normal",
          trials: [],
          setReductions: [],
          lowerDose: false,
          reduceA: false,
          reduceJerk: false,
          omitPull: false,
          technique: { snatch: "none", clean: "none", jerk: "none" },
        },
        d,
      ),
    ),
  );
  const exerciseIds = [
    ...new Set([...week.exercises, ...target.exercises].map((e) => e.id)),
  ];
  const sum = (entries, id) =>
    entries.filter((e) => e.id === id).reduce((n, e) => n + e.sets, 0);
  const doseText = (m) =>
    `${m.fractional}${m.additional.length ? " + other work*" : ""}`;
  return `<details class="panel dose-panel"><summary><strong>Sets by exercise and muscle · today & week</strong></summary><p>This day's eligible plan: <b>${day.olympic} Olympic + ${day.conventional} conventional sets</b>. The ordinary planned week at your current dose has <b>${week.olympic} + ${week.conventional}</b>. These are prescriptions, not completed logs; daily readiness can reduce the weekly plan. Warm-ups, athletics and stretches are excluded from loaded-set totals.</p><div class="dose-scroll"><table><caption>Exercise work sets</caption><thead><tr><th>Exercise</th><th>This day</th><th>Current week</th><th>Established normal-week target</th></tr></thead><tbody>${exerciseIds.map((id) => `<tr><th>${esc([...week.exercises, ...target.exercises].find((e) => e.id === id).name)}</th><td>${sum(day.exercises, id)}</td><td>${sum(week.exercises, id)}</td><td>${sum(target.exercises, id)}</td></tr>`).join("")}</tbody></table></div><div class="dose-scroll"><table><caption>Muscle workload · conventional set estimate</caption><thead><tr><th>Muscle</th><th>This day</th><th>Current week</th><th>Established target</th></tr></thead><tbody>${Object.entries(
    MUSCLES,
  )
    .map(
      ([id, label]) =>
        `<tr><th>${label}<small>${week.muscles[id].direct} direct + ${week.muscles[id].indirect} indirect weekly sets</small></th><td>${doseText(day.muscles[id])}</td><td>${doseText(week.muscles[id])}</td><td>${doseText(target.muscles[id])}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><p class="fine-print">The muscle estimate counts a direct conventional set as 1 and an indirect set as ½. It is an accounting aid, not a measured stimulus. *Other work contributes without a defensible set conversion: Olympic lifts, bracing/grip, and flat-bench upper-chest work. Zero counted sets does not mean no training stimulus. Deep squats count toward glutes, with benefit dependent on depth and execution. Chest, calf and elbow-flexor regional rows overlap their parent totals; do not add them together. Muscle totals overlap and must not be summed into whole-body sets.</p><details><summary>Which exercises contribute additional work?</summary>${Object.entries(
    MUSCLES,
  )
    .filter(([id]) => week.muscles[id].additional.length)
    .map(
      ([id, label]) =>
        `<p><b>${label}:</b> ${esc(week.muscles[id].additional.join(", "))}</p>`,
    )
    .join(
      "",
    )}</details><details><summary>Regional decisions · including muscles with no isolation</summary><p>These decisions describe the established target. Your current introduction stage, phase, equipment and readiness can reduce the actual prescription.</p>${Object.entries(
    MUSCLES,
  )
    .map(([id, name]) => `<p><b>${name}:</b> ${MUSCLE_DECISIONS[id]}</p>`)
    .join(
      "",
    )}</details><h3>How the dose is reviewed</h3><p>Starting/restarting: four stages, advancing only after a complete green week and normal next-session follow-ups. An ordinary Foundation week progresses through 31, 41, 46 and 56 conventional sets, and 6, 6, 9 and 12 Olympic sets. Taper, pivot and readiness reductions take precedence. The last stage is the full selected allocation. Its exact counts are reasoned prescriptions, not measured individual optima.</p>${DOSE_REVIEWS.map(([name, text]) => `<p><b>${name}:</b> ${text}</p>`).join("")}<p>The chosen targets balance the priority order, training overlap and failure fatigue; they are not scientific thresholds. After two stable green weeks, trial one additional weekly set on one exercise. Hold other additions for two normal weeks, compare performance and recovery, and retain only with a useful response. Assess physique trends over a full cycle; two weeks mainly assesses tolerance. Improving performance alone does not prove maximum muscle growth. If later sets or the next Olympic session deteriorate, use Remove one weekly work set after review. It can pause a trial or reduce an established exercise; restoring a set uses the same controlled addition process.</p>${allLoadedFailure(state.training) ? btn("Add or adjust training", "change", "", "button") : ""}</details>`;
}
function sessionMuscles(s, p) {
  if (s.skipped || s.kind !== "lifting") return "";
  const l = doseLedger([{ day: p.day, sessions: [s] }]);
  return `<details class="session-dose"><summary>Muscle sets in this workout</summary><p>${l.olympic} Olympic sets and ${l.conventional} conventional sets. Direct sets count as 1; indirect sets count as ½ for this estimate. Olympic and other unquantified work are additional, not included in the numeric muscle totals.</p><dl class="time-parts">${Object.entries(
    MUSCLES,
  )
    .filter(
      ([id]) => l.muscles[id].fractional || l.muscles[id].additional.length,
    )
    .map(
      ([id, label]) =>
        `<div><dt>${label}</dt><dd>${l.muscles[id].fractional}${l.muscles[id].additional.length ? " + other work" : ""}</dd></div>`,
    )
    .join(
      "",
    )}</dl><p class="fine-print">Muscle totals overlap. Chest, calf and elbow-flexor regional rows overlap. See Sets by exercise and muscle above for the direct/indirect breakdown and contributing exercises.</p></details>`;
}
function timeParts(parts, labels) {
  return `<dl class="time-parts">${Object.entries(parts)
    .filter(([, v]) => v[1] > 0)
    .map(
      ([k, v]) =>
        `<div><dt>${esc(labels[k])}</dt><dd>${minutesText(v)}</dd></div>`,
    )
    .join("")}</dl>`;
}
function timingDetails(t) {
  return `<details class="timing-details"><summary>How this time is planned</summary><p>${t.rows.length && t.rows.every((r) => r.station === "mobility") ? "Includes both sides, setup, between-hold rests and five slow active reps." : `Fixed time targets, including ${esc(t.profile.traffic)} gym traffic. Rests follow this prescription; allow more whenever readiness needs it. Exercise allowances include preparation and transitions.`}</p>${timeParts(t.overhead, { arrival: "Arrival, belongings & equipment check", general: "General / field warm-up", transition: "Transition to athletics", breaks: "Water, restroom & miscellaneous breaks", departure: "Final log, unloading & packing up" })}${t.rows.map((r) => `<details class="exercise-timing"><summary>${esc(r.name)} · ${minutesText(r.seconds)}</summary>${timeParts(r.parts, r.station === "mobility" ? { ...TIME_LABELS, setup: "Drill setup & side changes", rest: "Rest between holds", work: "Holds & five active reps" } : TIME_LABELS)}</details>`).join("")}<p class="fine-print">Loading, station changes, waiting and logging use recovery time where possible; only the extra time is added. Warm-up rests include plate changes. Rep speed is a planning assumption. Olympic failure budgets assume the top of the valid-rep window plus one terminal attempt; actual valid reps extend the countdown, and an earlier endpoint removes unused steps. Adjust setup, traffic and break allowances in Settings; these are not program doses. The displayed targets and countdown steps use the same seconds. Long interruptions, travel to/from training and optional unscheduled walks are outside this estimate. After more than 15 minutes idle, allow the prescribed re-warm-up. No additional cooldown is prescribed.</p></details>`;
}
function dayTime(t) {
  return `<section class="day-time" aria-label="Whole-day time estimate"><div><span class="eyebrow">WHOLE-DAY PLANNING BUDGET</span><strong>${minutesText(t.seconds)}</strong><p>Scheduled training${t.mobility[1] ? ` + ${minutesText(t.mobility)} targeted mobility / stretches` : ""}. Includes preparation, rest, transitions and breaks; this is the full plan, not time remaining.</p></div>${t.gapSeconds ? `<p class="visit-gap">${t.visits} visits · add at least ${t.gapSeconds / 3600} hours between visits. Earliest planned finish: ${minutesText(t.elapsed)} after starting, plus travel.</p>` : ""}${t.sessions.some((s) => s.profile && s.overhead.transition[1]) ? "<p>Athletics shares the visit: includes the 5-minute transition and full field warm-up.</p>" : ""}${t.sessions.some((s) => s.id === "cardio") ? "<p>Aerobics is budgeted after other scheduled training when present. Its target includes moving time and setup/waiting. Additional walks include their moving time; add travel for separate outings.</p>" : ""}<p class="fine-print">${esc(t.profile.traffic)} gym traffic · ${t.profile.breakMinutes} min breaks per gym/field visit · adjust in Settings → Time planning.</p></section>`;
}
function mobilityCard(p, timing) {
  if (p.sessions.some((s) => s.kind === "mobility")) return "";
  if (
    !timing.mobilityRows.length &&
    !["wednesday", "saturday", "sunday"].includes(p.day)
  )
    return "";
  return `<section class="session-card mobility-card" aria-label="Targeted mobility and stretch times"><div class="session-head"><div><span class="pill">TARGETED MOBILITY</span><h3>Stretches & active movement</h3></div><div class="duration">${minutesText(timing.mobility)}<small>included in day total</small></div></div>${timing.mobilityRows.length ? timing.mobilityRows.map((r) => `<div class="mobility-row"><strong>${minutesText(r.seconds)} per restriction</strong><p>${esc(r.description)}</p></div>`).join("") + '<p class="fine-print">Includes holds on both sides, 15-second rests, five slow active reps, setup and side changes.</p>' : "<p>No targeted stretches are scheduled: no mobility restrictions are selected. Choose up to two restrictions you actually have in Settings. The program omits extra stretching when the relevant positions are comfortable.</p>"}${btn("Choose mobility restrictions", "mobility-settings", "", "quiet")}${sourceLink(22)}</section>`;
}
function mobilityPreview(s, p, timing, fullPlan = false) {
  const done = resolved(p.day, s.id);
  return `<article class="session-card mobility-card"><div class="session-head"><div><span class="pill">TARGETED MOBILITY</span><h3>${esc(s.title)}</h3></div><div class="duration">${s.skipped ? "—" : minutesText(timing.seconds)}<small>included in day total</small></div></div><p>${esc(s.note)}</p>${s.skipped ? notice(s.reason) : ""}${s.rows.map((e) => `<div class="mobility-row">${!s.skipped ? `<strong>${minutesText(timing.rows.find((r) => r.key === e.key).seconds)} per restriction</strong>` : ""}<p>${esc(e.note)}</p></div>`).join("")}<p class="fine-print">Includes holds on both sides, 15-second rests, five slow active reps, setup and side changes.</p><div class="session-bottom">${!done && !s.skipped ? btn(fullPlan ? "Start full planned workout" : "Start session →", "start", `data-day="${p.day}" data-id="${s.id}" data-full="${fullPlan ? "1" : "0"}"`, "primary button") : ""}${!done ? btn("Omit", "omit-session", `data-day="${p.day}" data-id="${s.id}"`, "quiet") : btn("View log", "record", `data-id="${done.id}"`, "quiet") + btn("Repeat session", "start", `data-day="${p.day}" data-id="${s.id}" data-repeat="1" data-full="1"`, "button")}</div>${!s.skipped ? timingDetails(timing) : ""}${sourceLink(22)}</article>`;
}
function preview(s, p, timing, fullPlan = false) {
  if (s.kind === "mobility") return mobilityPreview(s, p, timing, fullPlan);
  const done = resolved(p.day, s.id),
    summary = s.rows.reduce(
      (n, e) => n + (e.kind === "failure" ? e.sets : 0),
      0,
    );
  return `<article class="session-card"><div class="session-head"><div><span class="pill">${esc(done ? done.status : s.kind === "lifting" ? "PRIORITY SESSION" : s.kind === "athletic" ? "QUALITY / OPTIONAL" : "EASY / OPTIONAL")}</span><h3>${esc(s.title)}</h3></div><div class="duration">${s.skipped ? "—" : minutesText(timing.seconds)}<small>planned total</small></div></div>${s.note ? `<p class="muted">${esc(s.note)}</p>` : ""}${s.skipped ? notice(s.reason) : ""}<div class="exercise-table">${s.rows.map((e, i) => `<div><span class="row-index">${String(i + 1).padStart(2, "0")}</span><span>${esc(e.name)}</span><strong>${esc(describe(e))}${!s.skipped ? `<small class="exercise-duration">${minutesText(timing.rows[i].seconds)} including prep & rest</small>` : ""}</strong></div>`).join("")}</div><div class="session-bottom"><span>${summary ? `${summary} conventional work sets · strict-form failure` : s.kind === "cardio" ? "Count actual moving minutes. Full-sentence talk test." : s.rows.some(olympicFailure) ? "Each Olympic work set ends at its first miss/invalid rep." : "Short sets. Secure positions. No failure."}</span><div>${!done && !s.skipped ? btn(fullPlan ? "Start full planned workout" : "Start session →", "start", `data-day="${p.day}" data-id="${s.id}" data-full="${fullPlan ? "1" : "0"}"`, "button primary") : ""}${!done ? btn("Omit", "omit-session", `data-day="${p.day}" data-id="${s.id}"`, "quiet") : btn("View log", "record", `data-id="${done.id}"`, "quiet") + btn("Repeat session", "start", `data-day="${p.day}" data-id="${s.id}" data-repeat="1" data-full="1"`, "button")}</div></div><details><summary>Warm-up & execution</summary><p>${esc(s.warmup)}</p>${s.rows.map((e) => `<p><b>${esc(e.name)}</b><br>${esc(e.note)} ${rowSource(e)}<br><span class="muted">${esc(e.warmup || "")} Rest ${time(e.rest || 0)}.</span></p>`).join("")}</details>${sessionMuscles(s, p)}${!s.skipped ? timingDetails(timing) : ""}</article>`;
}
function preparationControls(key, budget, label) {
  const timer = state.active.preparationTimer,
    running = timer?.key === key;
  return `<div class="preparation-run"><p>${key === "rewarm" ? "Additional interruption allowance" : "Preparation allowance"}: ${minutesText(budget)}${key === "rewarm" ? " beyond the starting budget" : " · included in the session budget"}.</p>${running ? `<p class="routine-clock">Remaining <strong id="preparation-clock" role="timer" data-target="${targetSeconds(budget)}">${countdownText(targetSeconds(budget) - preparationElapsed(timer))}</strong>${timer.pausedAt ? " · paused" : ""}</p>${btn(timer.pausedAt ? "Resume preparation" : "Pause preparation", "prep-pause")}` : btn(key === "general" ? "Run warm-up" : key === "rewarm" ? "Run re-warm-up" : "Run exercise preparation", "prep-start", `data-key="${key}"`, "primary button")} ${btn(label, key === "general" ? "warmup" : "prepare", `data-key="${key}"`, "button")}<p class="fine-print">Complete all the instructions above before recording completion. If already performed, completion is recorded as confirmed without an invented duration.</p></div>`;
}
function preparationLog(w) {
  return (w.preparationLog || []).length
    ? `<section class="panel preparation-ledger"><h2>Preparation log</h2><ol>${w.preparationLog.map((r) => `<li>${esc(r.name)} · ${r.seconds === null ? "completion confirmed" : time(r.seconds) + (r.method === "interrupted" ? " · interrupted" : " timed")}</li>`).join("")}</ol></section>`
    : "";
}
function pacingLog(w) {
  if (!w.pacing) return "";
  return `<details class="panel"><summary>Countdown record · target ${minutesText(w.pacing.plannedSeconds)}</summary><p>Elapsed session: ${time(((w.endedAt || Date.now()) - w.startedAt) / 1000)}. Untimed confirmations do not claim a measured duration.</p><ol>${w.pacing.completed.map((step) => `<li>${esc(step.label)} · ${step.seconds === null ? esc(step.method) : time(step.seconds) + " actual"} · target ${time(step.targetSeconds)}</li>`).join("")}</ol></details>`;
}
function partialMobilityLog(w) {
  return (w.mobilityPartials || []).length
    ? `<section class="panel"><h2>Interrupted mobility</h2>${w.mobilityPartials.map((m) => `<p>${esc(w.session.rows.find((e) => e.key === m.key).name)} · ${m.steps.filter((s) => s.title.includes("hold")).length} holds completed before stopping; ${time((m.stoppedAt - m.stepStartedAt) / 1000)} on interrupted step. ${esc(m.reason)}</p>`).join("")}</section>`
    : "";
}
function mobilityFocus(w, e) {
  const run = w.mobilityRun,
    step = run?.key === e.key ? mobilitySteps(e)[run.index] : null;
  return `<section class="focus-card"><span class="pill">MOBILITY / NEVER PAINFUL</span><h2>${esc(e.name)}</h2><p>${esc(e.note)}</p>${step ? `<p>Step ${run.index + 1} of 8</p><h3>${esc(step.title)}</h3><p class="routine-clock"><strong id="mobility-clock" role="timer">${time(Math.max(0, step.seconds - (Date.now() - run.stepStartedAt) / 1000))}</strong></p>${btn(run.index === 7 ? "Five active reps complete · save drill" : "Continue", "mobility-next", `id="mobility-next" ${Date.now() < run.stepStartedAt + step.seconds * 1000 ? "disabled" : ""}`, "primary button")}` : `<p>The runner times each hold and rest. Stop if the position becomes painful.</p>${btn("Position comfortable · start drill", "mobility-start", "", "primary button")}`}<div class="focus-actions">${btn("Stop mobility", "end-early", "", "quiet")}${btn("Omit this drill", "omit-row", `data-key="${e.key}"`, "quiet")}</div>${sourceLink(22)}</section>`;
}
function aerobicFocus(w, e, timing) {
  const timer = w.aerobicRun,
    moving = timer ? preparationElapsed(timer) : 0;
  return `<section class="focus-card"><span class="pill">EASY AEROBICS / MOVING TIME</span><h2>${esc(e.name)}</h2><p class="prescription">${e.minutes} min moving</p><p class="exercise-duration">Full exercise allowance: ${minutesText(timing.seconds)} including setup and any equipment wait.</p><p>${esc(e.note)}</p><p>Start easy. The easy start is part of these moving minutes. Pause for traffic lights, water, restroom stops or any time you are not moving. No separate lifting warm-up or cooldown is prescribed.</p>${timer ? `<p class="routine-clock">Remaining <strong id="aerobic-clock" role="timer">${countdownText(e.minutes * 60 - moving)}</strong>${timer.pausedAt !== null ? " · paused" : ""}</p><p id="aerobic-target">${moving >= e.minutes * 60 ? "Target reached. Stop and confirm actual moving minutes." : `${time(e.minutes * 60 - moving)} to the planned target.`}</p>${btn(timer.pausedAt !== null ? "Resume moving time" : "Pause moving time", "aerobic-pause")}${btn("Stop & review moving time", "aerobic-review", "", "primary button")}` : `${btn("Start moving time", "aerobic-start", "", "primary button")}${btn("Log already completed minutes", "aerobic-review", "", "quiet")}`}<p class="fine-print">The clock is a record of unpaused time; confirm actual movement before saving. Setup and breaks count in the session budget, not the aerobic dose. Stop when the target is reached. A shorter bout is saved as partial work.</p><div class="focus-actions">${btn("End session early", "end-early", "", "quiet")}${btn("Omit this exercise", "omit-row", `data-key="${e.key}"`, "quiet")}</div>${sourceLink(22)}</section>`;
}
function partialAerobicLog(w) {
  return (w.aerobicPartials || []).length
    ? `<section class="panel"><h2>Interrupted aerobics</h2>${w.aerobicPartials.map((r) => `<p>${esc(w.session.rows.find((e) => e.key === r.key).name)} · ${time(r.movingSeconds)} unpaused time before stopping; actual moving dose unconfirmed. ${esc(r.reason)}</p>`).join("")}</section>`
    : "";
}
function paceDisplay(w) {
  const info = paceStatus(w),
    p = w.pacing;
  if (p?.breakRun)
    return { label: "Water / restroom break", seconds: info.breakLeft, info };
  if (p?.workEndedAt) {
    const i = p.plan.findIndex((s) => s.id === p.currentId),
      next = p.plan[i + 1];
    if (next?.role === "rest")
      return {
        label: "Recovery while you record the result",
        seconds: paceSeconds(w, next) - (Date.now() - p.workEndedAt) / 1000,
        info,
      };
    return {
      label: "Set ended · record the actual result below",
      seconds: 0,
      info,
    };
  }
  return {
    label: info?.stage?.label || "Timed plan complete",
    seconds: info?.phaseRemaining || 0,
    info,
  };
}
const countdownText = (seconds) =>
  seconds < 0 ? `${time(-seconds)} over` : time(Math.ceil(seconds));
function pacingCard(w) {
  if (!w.pacing)
    return `<section class="pace-card">${btn("Enable guided countdown", "pace-enable", "", "primary button")}<p>Start a countdown for the remaining work in this saved session.</p></section>`;
  const p = w.pacing,
    display = paceDisplay(w),
    stage = display.info.stage;
  let controls = "";
  if (p.breakRun)
    controls = btn(
      "Finish break · resume",
      "pace-break-end",
      "",
      "primary button",
    );
  else if (stage) {
    if (
      !p.timer &&
      ["work", "work-part", "mobility", "aerobic"].includes(stage.role)
    )
      controls += btn(
        stage.role === "work" ? "Start timed set" : "Start timed step",
        "pace-start",
        "",
        "primary button",
      );
    else if (stage.role === "work")
      controls += p.workEndedAt
        ? "<p>Save the actual attempt/set outcome below to advance. Recovery is already counting.</p>"
        : btn(
            "Set finished · record result",
            "pace-set-end",
            "",
            "primary button",
          );
    else if (stage.role === "aerobic")
      controls += btn(
        "Stop & confirm moving minutes",
        "aerobic-review",
        "",
        "primary button",
      );
    else
      controls += btn(
        stage.role === "general-check"
          ? "Warm-up complete"
          : stage.role === "prepare-check"
            ? "Ready for this exercise"
            : stage.role === "mobility" && stage.step === 7
              ? "Active reps complete · save timed drill"
              : "Done · next step",
        "pace-next",
        `id="pace-next" ${paceElapsed(p.timer) < paceMinimum(w, stage) ? "disabled" : ""}`,
        "primary button",
      );
    if (p.timer && !p.workEndedAt && stage.role !== "mobility")
      controls += btn(
        p.timer.pausedAt === null ? "Pause countdown" : "Resume countdown",
        "pace-pause",
      );
    if (
      !stage.role.endsWith("check") &&
      stage.role !== "mobility" &&
      !p.workEndedAt
    )
      controls += btn("Add 1 minute", "pace-add", "", "quiet");
    if (
      [
        "ramp",
        "ramp-rest",
        "rest",
        "recovery",
        "waiting",
        "break-pool",
      ].includes(stage.role)
    )
      controls += btn(
        stage.role === "ramp"
          ? "Skip this warm-up set"
          : stage.role === "ramp-rest"
            ? "Ready · skip warm-up rest"
            : ["rest", "recovery"].includes(stage.role)
              ? "End rest early"
              : stage.role === "waiting"
                ? "Equipment available"
                : "Release unused break allowance",
        "pace-skip",
        "",
        "quiet",
      );
    if (stage.role !== "break-pool")
      controls += btn("Take a 2-minute break", "pace-break", "", "quiet");
  }
  return `<section class="pace-card" aria-label="Guided session countdown"><div class="eyebrow">GUIDED COUNTDOWN${stage?.exercise ? ` / ${esc(stage.exercise)}` : ""}</div><h2 id="pace-label">${esc(display.label)}</h2><div class="pace-clock"><strong id="pace-clock" role="timer">${countdownText(display.seconds)}</strong>${p.timer?.pausedAt !== null && p.timer && !p.workEndedAt ? "<span>Paused</span>" : ""}</div><p id="pace-forecast">${time(display.info.remaining)} of planned steps left · projected finish ${new Date(display.info.finishAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p><p class="fine-print">Session target <span id="pace-budget">${countdownText(display.info.budgetRemaining)}</span> remaining. ${time(Math.max(0, (p.plan.find((s) => s.role === "break-pool")?.seconds || 0) - p.breakUsed))} of miscellaneous allowance unused. Pausing a step does not hide elapsed session time.</p><div class="pace-actions">${controls}${btn(timerAlerts.preferences.enabled ? "Alarm sound on · mute" : "Alarm sound off · enable", "pace-sound", "", "quiet")}</div><p class="fine-print" data-alarm-state></p><p class="fine-print">In-app sound mixes with music and uses media volume. For alerts with the phone locked or the app closed, connect background notifications in Settings → Alarms. Wait for confirmation that this countdown is saved, then test with your normal music and notification settings.</p><p class="fine-print">Zero is a cue, not a completed set. Follow the current exercise’s endpoint and record the real outcome. For Olympic failure sets, keep going at the same load until the first miss or invalid rep; the planned rep count is only a time estimate. Take longer recovery when needed. Loading and logging share rest time. Confirm each preparation step; Use the rest target as a recommendation. If you end it early, the actual rest is recorded. Skip a warm-up set only when you are already prepared for that weight.</p><details><summary>Remaining countdown steps</summary><ol class="pace-plan">${p.plan
    .filter((step) => !p.completed.some((x) => x.id === step.id))
    .map(
      (step) =>
        `<li>${esc(step.exercise ? step.exercise + " · " : "")}${esc(step.label)} <strong>${time(paceSeconds(w, step))}</strong></li>`,
    )
    .join("")}</ol></details></section>`;
}
function workoutList(w) {
  const current = nextRow(w);
  return `<details class="panel workout-list"><summary>All exercises · reps, weights & change order</summary><p>See the whole workout here. Use “Do next” to choose any unfinished lift when a station is occupied. Olympic work first is a recommendation. Finish and record a set before switching.</p>${w.session.rows
    .map((e) => {
      const status = rowStatus(w, e);
      const suggested =
        e.kind === "quality"
          ? nextQualityRange(w, e)?.[0]
          : e.kind === "failure"
            ? nextLoad(e, exposureHistory(state, e), w.increment).weight
            : null;
      const used = status.logs.at(-1)?.weight;
      return `<article class="workout-list-row" data-exercise="${e.key}"><div><strong>${esc(e.name)}</strong><p>${esc(describe(e))}</p><p class="muted">${used || suggested ? `${fmt(used || suggested)} lb ${used ? "used" : "suggested"} · ` : "Choose weight after an easy warm-up · "}Rest ${time(e.rest || 0)}${status.done ? " · Finished" : current?.key === e.key ? " · Current exercise" : ""}</p></div>${!status.done && current?.key !== e.key && ["quality", "failure"].includes(e.kind) ? btn("Do next", "exercise-next", `data-key="${e.key}" aria-label="Do ${esc(e.name)} next"`, "button") : ""}</article>`;
    })
    .join("")}</details>`;
}
function reportedFinish(log) {
  return ["fatigue", "pain", "stop"].includes(log.endpoint)
    ? log.endpoint
    : log.grade === "C"
      ? "form"
      : ["clean_miss", "jerk_miss"].includes(log.outcome)
        ? log.outcome
        : "miss";
}
function olympicReportFields(
  e,
  reps = "",
  weight = "",
  finish = "miss",
  fault = "",
) {
  return `<p>Count only completed reps with the prescribed form. For clean & jerk, count complete clean + jerk pairs. Do not count the failed rep. For example: six good reps, then a miss = <b>6</b>.</p><div class="input-grid">${input("Weight used · lb", "weight", weight, "number", 'min="0.1" max="2000" step="any" required inputmode="decimal"')}${input("Good reps completed in this set", "reps", reps, "number", 'min="0" max="100" step="1" required inputmode="numeric"')}${select(
    "What ended the set?",
    "finish",
    {
      miss: "The next rep missed",
      ...(e.id === "cj"
        ? {
            clean_miss: "The clean missed",
            jerk_miss: "The clean succeeded; the jerk missed",
          }
        : {}),
      form: "Form changed · no further reps counted",
      fatigue: "Breathing / burning stopped me before a miss",
      pain: "Pain · stopped",
      ...(finish === "stop" ? { stop: "Other interruption · stopped" } : {}),
    },
    finish,
  )}</div>${input("Details (optional)", "fault", fault, "text", 'placeholder="e.g. changed to a power catch, or jerk missed"')}<p class="fine-print">This records your set total. It does not invent individual rep times or effort ratings. A miss or form change is not a measurement of power output.</p>`;
}
function workoutView() {
  const w = state.active;
  if (!w)
    return (
      title(
        "TRAIN WITH INTENT",
        "Ready when you are.",
        "Choose any session. Readiness check-ins are optional.",
      ) + btn("Back to your week", "week", "", "primary button")
    );
  const e = nextRow(w),
    done = w.session.rows.filter((e) => rowStatus(w, e).done).length,
    timeConfig = w.timeConfig || {
      ...state.training,
      anchors: w.anchors,
      increment: w.increment,
    },
    originalTiming = estimateSession(
      w.originalSession || w.session,
      timeConfig,
      timeConfig,
    ),
    currentTiming = estimateSession(w.session, timeConfig, timeConfig);
  let body =
    title(
      `${weekdayLabel(w.date)} · CYCLE ${w.cycle} / WEEK ${w.week}`,
      w.session.title,
      `${dateLabel(w.date)} · Started ${stamp(w.startedAt)}`,
    ) +
    (w.warnings?.length
      ? `<details class="panel"><summary>Training guidance · you decide</summary>${w.warnings.map((text) => `<p>${esc(text)}</p>`).join("")}</details>`
      : "") +
    (!w.fullPlan &&
    w.baseSession &&
    workoutRowsDiffer(w.baseSession.rows, w.session.rows)
      ? `<p>${btn("Use full planned workout", "use-full-workout", "", "button")} Readiness recommendations remain in your log.</p>`
      : "") +
    `<div class="progress-line"><span style="width:${(done / w.session.rows.length) * 100}%"></span></div><p class="muted">${done} of ${w.session.rows.length} ${w.session.kind === "mobility" ? "mobility drills" : "exercises"} resolved. ${w.session.kind === "mobility" ? "Complete the scheduled holds, rests and active reps, or record an early stop." : "Log actual outcomes, including misses and safety stops."}</p><p class="session-budget">Starting session budget: <strong>${minutesText(originalTiming.seconds)}</strong> · includes prep, rest and breaks; fixed targets.</p>${workoutList(w)}${pacingCard(w)}${timingDetails(originalTiming)}`;
  if (w.warmup && w.session.kind === "lifting" && e)
    body += `<details ${w.preparationTimer?.key === "rewarm" ? "open" : ""}><summary>Preparation after an interruption</summary><p>If idle more than 15 minutes: 2 minutes easy movement, then two brief ascending rehearsals before resuming.</p>${preparationControls("rewarm", [180, 300], "Re-warm-up complete")}</details>`;
  if (!w.warmup && w.session.kind !== "cardio")
    return (
      body +
      `<section class="focus-card"><span class="pill">PREPARE / NEVER TO FAILURE</span><h2>Warm up first.</h2><p>${esc(w.session.warmup)}</p>${originalTiming.overhead.transition[1] ? "<p>First take the 5-minute transition, then complete the field warm-up.</p>" : ""}${preparationControls(
        "general",
        originalTiming.overhead.general.map(
          (n, i) => n + originalTiming.overhead.transition[i],
        ),
        "General warm-up complete",
      )}</section>` +
      btn("End session early", "end-early", "", "quiet")
    );
  if (e?.kind === "mobility") {
    body += mobilityFocus(w, e);
  } else if (e?.kind === "aerobic") {
    body += aerobicFocus(
      w,
      e,
      currentTiming.rows.find((r) => r.key === e.key),
    );
  } else if (e) {
    const status = rowStatus(w, e),
      slot = slotAt(e, status.count),
      range = e.kind === "quality" ? nextQualityRange(w, e) : null,
      suggestion =
        e.kind === "failure"
          ? nextLoad(e, exposureHistory(state, e), state.training.increment)
          : null;
    let proposed =
      status.logs.at(-1)?.weight || suggestion?.weight || range?.[0] || "";
    if (range) proposed = range[0];
    if (status.cap)
      proposed = Math.min(Number(proposed) || status.cap, status.cap);

    if (proposed)
      proposed =
        e.kind === "failure"
          ? proposed
          : Math.floor((proposed + 1e-8) / w.increment) * w.increment;
    const prepared = w.preparations.includes(e.key);
    body += `<section class="focus-card"><div class="focus-meta"><span class="pill">${e.kind === "failure" ? "STRICT-FORM FAILURE" : e.kind === "quality" ? (olympicFailure(e) ? "OLYMPIC FAILURE SET" : "OLYMPIC QUALITY") : e.kind === "speed" ? "ATHLETIC QUALITY" : "EASY AEROBICS"}</span><span>${olympicFailure(e) ? `${status.completedSets}/${e.sets} sets ended · set ${status.currentSet}: ${status.currentValidReps} valid ${e.id === "cj" ? "pairs" : "reps"}` : `${status.count} / ${status.planned} ${e.kind === "quality" ? "attempts" : "sets"}`}</span></div><h2>${esc(e.name)}</h2><p class="prescription">${esc(describe(e))}</p><p class="exercise-duration">Full exercise allowance: ${minutesText(currentTiming.rows.find((r) => r.key === e.key).seconds)} including prep & rest.</p>${
      range
        ? `<div class="suggested-load"><strong>${range
            .map(fmt)
            .filter((v, i, a) => i === 0 || v !== a[0])
            .join(
              "–",
            )}<small> lb</small></strong><span>${olympicFailure(e) ? "Selected / previous weight · you can choose your starting weight below. Keep it fixed once work begins." : "Rounded down · secure positions and effort cap govern."}</span></div>`
        : ""
    }${status.reason ? notice(status.reason, "warning") : ""}${e.selfSelectedLoad && !status.count ? `<form data-form="olympic-load" data-key="${e.key}" class="working-load-form"><h3>Choose your working weight</h3><p>You choose the weight. Saving it updates the lighter warm-up steps. Your last comparable weight, when available, is a reference rather than a limit.</p>${input("Working weight · lb", "weight", e.workingLoad || "", "number", 'min="0.1" max="2000" step="any" inputmode="decimal" required')}<p class="form-error" role="alert"></p>${submit("Use this weight")}</form>` : ""}<p>${esc(e.note)} ${rowSource(e)}</p>${suggestion ? notice(suggestion.text) : e.progressionNote ? notice(e.progressionNote) : ""}<details ${prepared ? "" : "open"}><summary>Prepare this exercise · rest ${time(e.rest || 0)}</summary><p>${esc(e.warmup || "Full preparation and smooth rehearsals first.")}</p><p>All retained conventional work sets use strict-form failure. Olympic failure sets stop at the first miss or invalid rep. Preparation stays easy. A rep-window error is logged honestly; no extra failure test to fix it.</p>${
      !prepared
        ? preparationControls(
            e.key,
            [0, 1].map((i) =>
              ["setup", "waiting", "recovery", "ramp"].reduce(
                (n, k) =>
                  n +
                  currentTiming.rows.find((r) => r.key === e.key).parts[k][i],
                0,
              ),
            ),
            e.kind === "failure" &&
              ["bench", "front_squat", "back_squat"].includes(e.id)
              ? "Safeties, spotter / safe exit & warm-up checked"
              : "Warm-up, setup & local readiness checked",
          )
        : ""
    }</details>`;
    if (prepared) {
      if (olympicFailure(e))
        body += `<section class="whole-set-entry"><h3>Finished the whole set?</h3><p>Enter the total reps once. You do not have to log each rep separately.</p>${btn("Log completed set · enter reps", "olympic-report", `data-key="${e.key}"`, "primary button")}<p class="muted">Or use the individual-rep form below.</p></section>`;
      body += `<form data-form="set"><div class="input-grid">`;
      if (["quality", "failure"].includes(e.kind))
        body += input(
          e.loadUnit === "per dumbbell"
            ? "Each dumbbell · lb"
            : e.loadUnit === "total barbell"
              ? "Barbell + plates · lb"
              : "Actual load · lb",
          "weight",
          proposed,
          "number",
          `min="0.1" max="2000" step="any" inputmode="decimal" required ${olympicFailure(e) && status.count ? "readonly" : ""}`,
        );
      if (e.kind === "failure")
        body +=
          input(
            "Valid completed reps",
            "reps",
            "",
            "number",
            'min="0" max="200" step="1" inputmode="numeric" required',
          ) +
          select(
            "What ended the set?",
            "endpoint",
            {
              failure: "No more reps possible with the same form",
              tech: "Form changed · stopped",
              pain: "Pain · stop session",
              stop: "Other unsafe symptoms · stop",
            },
            "failure",
          ) +
          check("I attempted another rep and could not finish it", "failed");
      if (e.kind === "quality")
        body +=
          select(
            "Attempt outcome",
            "outcome",
            {
              make: e.id === "cj" ? "Clean AND jerk made" : "Made",
              miss: "Miss",
              ...(e.id === "cj"
                ? {
                    clean_miss: "Clean missed · no jerk",
                    jerk_miss: "Clean made · jerk missed",
                  }
                : {}),
            },
            "make",
          ) +
          select(
            "Technical quality",
            "grade",
            {
              A: "A · smooth and controlled",
              B: "B · completed with a small correction",
              C: "C · form broke down",
            },
            "A",
          ) +
          input(
            "How difficult was the lift? · 1 easy, 10 maximum",
            "effort",
            Math.min(e.effort, 7),
            "number",
            'min="1" max="10" step="0.5" required',
          ) +
          input(
            "What went wrong, or what helped? (optional)",
            "fault",
            "",
            "text",
            'placeholder="e.g. forward dip"',
          ) +
          (olympicFailure(e)
            ? ""
            : check(
                "This was an actual preparation attempt above 90% SN/CJ; it counts in this attempt budget",
                "preparation",
              )) +
          (e.test && !e.benchmark
            ? check(
                "This attempt was easy as well as valid (required before increasing the opener to 97–100%)",
                "easy",
              )
            : "") +
          input(
            "Video reference (optional)",
            "video",
            "",
            "text",
            'placeholder="Clip name or link"',
          );
      if (e.kind === "speed")
        body +=
          select(
            "Execution",
            "quality",
            {
              good: "Good · speed and control held",
              stop: "Quality loss / pain · stop module",
            },
            "good",
          ) +
          (e.id === "jump"
            ? input(
                "Three heights, same units (optional)",
                "heights",
                "",
                "text",
                'placeholder="e.g. 30, 31, 30"',
              )
            : input(
                "Reliable time · seconds (optional)",
                "seconds",
                "",
                "number",
                'step="0.001" min="0.001"',
              ));
      if (e.kind === "aerobic")
        body += input(
          "Actual moving minutes",
          "minutes",
          e.minutes,
          "number",
          `step="any" min="0.1" max="${e.minutes}" required`,
        );
      body += `</div><p class="form-error" role="alert"></p>${submit(e.kind === "quality" ? "Save attempt" : "Save set")}</form>`;
    }
    body += `<div class="focus-actions">${btn("Omit this exercise", "omit-row", `data-key="${e.key}"`, "quiet")}${e.test && !e.benchmark ? btn("Use ≤85% benchmark", "benchmark", "", "quiet") : ""}${e.kind === "quality" && !olympicFailure(e) ? btn("Reduced work still poor", "easy-return", "", "quiet") : ""}</div></section>`;
  } else
    body += `<section class="empty-card"><span>✓</span><h2>Work accounted for.</h2><p>${w.session.kind === "mobility" ? "Save the completed holds, rests, active reps and position recheck." : "Save the session, then check the response at your next priority workout."}</p>${btn("Finish session", "finish", "", "primary button")}</section>`;
  body += `${preparationLog(w)}${partialMobilityLog(w)}${partialAerobicLog(w)}<section class="session-ledger"><h2>Session log</h2>${w.session.rows
    .map((e) => {
      const r = rowStatus(w, e);
      return `<details ${r.logs.length ? "open" : ""}><summary>${esc(e.name)} <span>${olympicFailure(e) ? `${r.completedSets}/${e.sets} sets ended · ${r.validReps} total valid reps${r.endpointReached ? " · all endpoints reached" : ""}` : `${r.count}/${r.planned}`}${r.done ? " · resolved" : ""}</span></summary>${r.logs.length ? `<ol>${r.logs.map((x) => `<li>${setText(x)}${x.overCap ? " · outside prescription" : ""}</li>`).join("")}</ol>` : '<p class="muted">No sets logged.</p>'}${r.reason ? `<p>${esc(r.reason)}</p>` : ""}</details>`;
    })
    .join(
      "",
    )}${w.sets.length ? btn("Undo most recent entry", "undo", "", "quiet") : ""}</section><div class="week-actions">${btn("End session early", "end-early", "", "quiet")}</div>`;
  return body;
}
function setText(x) {
  if (x.reportedAsSet)
    return `${x.setNumber ? "Set " + x.setNumber + " · " : ""}${fmt(x.weight)} lb · ${x.validRep ? (x.exerciseId === "cj" ? "completed clean + jerk" : "completed rep") : x.endpoint === "fatigue" ? "stopped for breathing / burning" : x.endpoint === "pain" ? "stopped for pain" : x.endpoint === "stop" ? "stopped for an interruption" : x.grade === "C" ? "form changed" : x.outcome === "jerk_miss" ? "jerk missed" : "rep missed"} · reported with set total${x.fault ? " · " + esc(x.fault) : ""}`;
  if (x.failurePolicy)
    return `${x.setNumber ? "Set " + x.setNumber + " · " : ""}${fmt(x.weight)} lb · ${x.validRep ? (x.exerciseId === "cj" ? "valid CJ pair" : "valid rep") : x.terminal ? "terminal attempt · 0 valid reps" : "interrupted attempt"} · ${esc(x.outcome)} · ${esc(x.grade)} / effort ${fmt(x.effort)}${x.fault ? " · " + esc(x.fault) : ""}`;
  if (x.exerciseId === "aerobic")
    return `${fmt(x.minutes)} min moving · ${x.shortened ? "shortened bout" : "recorded"}${x.timingMethod === "timed-confirmed" ? ` · ${time(x.timedSeconds)} unpaused / ${time(x.pausedSeconds)} paused; actual minutes confirmed` : " · actual minutes confirmed"}`;
  if (x.exerciseId === "mobility")
    return `${x.holds} × ${x.holdSeconds} s holds · ${x.activeReps} active reps · ${time(x.elapsedSeconds)} elapsed`;
  return `${x.weight ? fmt(x.weight) + (x.loadUnit === "per dumbbell" ? " lb per dumbbell · " : " lb · ") : ""}${esc(x.reps ?? x.minutes)} ${x.exerciseId === "aerobic" ? "min" : x.reps === "1+1" ? "pair" : "reps"} · ${esc(x.endpoint || x.outcome || x.quality || "recorded")}${x.grade ? " · " + x.grade + " / effort " + x.effort : ""}${x.fault ? " · " + esc(x.fault) : ""}${x.failed ? " · unsuccessful attempt" : ""}${x.preparation ? " · preparation attempt, included in heavy dose" : ""}${x.reviewFlag ? " · " + esc(x.reviewFlag) : ""}${x.seconds ? " · " + fmt(x.seconds) + " s" : ""}${x.heights?.length ? " · heights " + x.heights.map(fmt).join(", ") + " · mean " + fmt(x.heights.reduce((n, h) => n + h, 0) / x.heights.length) : ""}`;
}
function historyView() {
  const totals = monitoringTotals(state);
  const sets = state.records.flatMap((r) => r.sets),
    failureCount = sets.filter((s) => s.endpoint === "failure").length,
    ol = sets.filter(
      (s) =>
        s.grade &&
        !(s.reportedAsSet && ["fatigue", "pain", "stop"].includes(s.endpoint)),
    ),
    good = ol.filter(
      (s) => s.outcome === "make" && s.grade !== "C" && !s.overCap,
    ).length;
  return (
    title(
      "THE WORK, RECORDED",
      "Your training history.",
      "Prescription snapshots stay attached to each session. No missed-volume debt.",
    ) +
    `<div class="overview"><article><small>SESSIONS</small><strong>${state.records.filter((r) => r.sets.length).length}</strong></article><article><small>VALID FAILURE SETS</small><strong>${failureCount}</strong></article><article><small>ACCEPTABLE OLYMPIC REPS</small><strong>${ol.length ? Math.round((good / ol.length) * 100) + "%" : "—"}</strong><p>${good} of ${ol.length} attempts / pairs</p></article></div>` +
    `<section class="panel"><h2>Actual quality dose</h2><p>Above 90% of the session’s frozen anchor: ${totals.heavy.snatch} snatch attempts · ${totals.heavy.cj} CJ pairs. Includes misses and recorded heavy preparation; rows with no saved anchor are not estimated.</p><p>CMJ: ${totals.jumpMeans.length} normal-session means of three planned jumps. ${totals.jumpMeans.length < 3 ? "Collect at least three normal-session values before interpreting a trend." : "Compare these values only with the same device, units, surface, warm-up and session position; no single-session diagnostic cutoff."}</p>${
      totals.jumpMeans.length
        ? `<p>Recent means: ${totals.jumpMeans
            .slice(-6)
            .map((x) => `${dateLabel(x.date)}: ${fmt(x.mean)}`)
            .join(" · ")}</p>`
        : ""
    }${sourceLink(30)}</section>` +
    `<div class="section-label"><h2>Workout journal</h2>${btn("Export backup", "export")}</div>${
      state.records.length
        ? `<div class="record-list">${state.records
            .slice()
            .reverse()
            .map(
              (r) =>
                `<button data-action="record" data-id="${r.id}"><span class="record-date">${dateLabel(r.date)}<small>C${r.cycle} · W${r.week}</small></span><span><strong>${esc(r.session.title)}</strong><small>${r.sets.length} log entries · ${r.status} · ${r.followup ? `next session ${r.followup.normal ? "normal" : "needs review"}` : "follow-up pending"}</small></span><span>↗</span></button>`,
            )
            .join("")}</div>`
        : '<div class="empty-card"><h3>Your first session starts the record.</h3><p>Loads, outcomes, technique and the next-session response will live here.</p></div>'
    }` +
    `<section class="panel"><h2>Decisions & events</h2>${
      [...state.reviews, ...state.events]
        .sort((a, b) => b.at - a.at)
        .slice(0, 40)
        .map(
          (r) =>
            `<details><summary>${stamp(r.at)} · ${esc(r.type || "Weekly review")}</summary><p>${esc(r.notes || r.reason || r.change?.reason || "")}</p><pre>${esc(JSON.stringify(r, null, 2))}</pre></details>`,
        )
        .join("") ||
      '<p class="muted">Readiness events and reviewed changes are kept here.</p>'
    }</section>` +
    (state.archives.length
      ? `<section class="panel"><h2>Previous-program archives</h2><p>${state.archives.length} complete saved state${state.archives.length === 1 ? "" : "s"} preserved. Includes old logs and unfinished work; never relabelled as this rebuild.</p>${btn("Export previous records", "export-archives")}</section>`
      : "")
  );
}
const guideTitles = [
  "Assumptions",
  "What failure means",
  "Evidence & priorities",
  "Weekly rhythm",
  "Entry weeks & anchors",
  "52-week progression",
  "Olympic phase prescriptions",
  "General warm-up",
  "Lift-specific preparation",
  "A and C",
  "Tuesday B",
  "Friday D",
  "Upper block",
  "Lower block",
  "Dose trials",
  "Technique regressions",
  "Readiness & misses",
  "Checkpoints & reductions",
  "Taper & mock meet",
  "Progression & bench continuity",
  "Athletics",
  "Aerobics & mobility",
  "Pickup & rolling sessions",
  "Alcohol rules",
  "Bulk/cut & equipment",
  "Run sheet",
  "Component assessments",
  "Heavy practice",
  "Athletic development",
  "Monitoring & annual audit",
  "Assistance selection",
  "Trial reviews",
  "Evidence boundaries",
  "Exercise trials",
];
function failureGuide() {
  return `<section class="panel" id="failure-amendment"><h2>September 21 · loaded working sets to failure</h2>
  <p>Your amendment supersedes the PDF wherever endpoints or workload conflict. It applies to loaded working sets, including Olympic lifts and pulls. Warm-ups, unloaded rehearsal, athletics, aerobic work and mobility retain their original endpoints. The original PDF remains available as the unchanged source.</p>
  <p><strong>Olympic endpoint:</strong> each prescribed work set uses a fixed load. Complete a valid rep, rest 40 seconds, then repeat. A clean-and-jerk rep requires BOTH lifts to be valid. The first miss or rep that loses the prescribed form ends the set immediately. The recommended recovery before the next prescribed set is five minutes. No extra retry sets, drop sets or escalating attempts. Zero valid reps in a set, or the same material fault ending two sets, ends the exercise. Use “Log completed set” to enter the total good reps and what ended it, or record each rep individually. A catch-style change or miss does not measure power output. Pain or an unsafe situation ends work and is recorded as incomplete, never disguised as failure.</p>
  <p><strong>Choosing weight:</strong> choose your own working weight, as you do for the other lifts. The app does not prescribe a percentage-based Olympic starting weight. Foundation uses about 2–4 good reps, Build 1–3 and Realization 1–2 as weight-selection guides. Your previous comparable weight and result are shown for reference. A completed clean & jerk rep includes both lifts. A higher catch is not evidence that you ran out of power; log any form change or breathing/burning limit honestly. After the previous comparable workout: increase 10 lb when every working set reaches the top of the rep range or higher; decrease 10 lb if any completed working set is below the bottom. Otherwise repeat the last working weight. For dumbbells, change 5 lb per hand. Missed/invalid attempts do not count as good reps. Incomplete, pain or fatigue stops do not earn increases. These recommendations replace earlier smaller-step and two-workout load rules, including held weeks. Weights remain editable; use warm-ups to check them.</p>
  <p><strong>Shrugs · September 28:</strong> use a barbell taken from rack supports. Keep the same sets and 10–15 rep range. Log the total bar-and-plate weight and select a fresh starting load through warm-ups; the old dumbbell loads stay in their own history. Add 10 lb only when every prescribed set reaches 15 or more. Change the equipment choice in Settings if needed.</p>
  <p><strong>Warm-ups:</strong> perform the general warm-up once per visit. The first Olympic lift uses a short light-bar check and three single-rep steps at 50%, 70% and 85% of your selected working weight. The second uses its own light-bar check and two single-rep steps at 60% and 85%. These are adjustable preparation guides, not proven unique optima. Use “Ready · skip warm-up rest” when ready, or add time if needed. Work-set recovery still has a recommended target; ending it early is recorded.</p>
  <p><strong>Dose and calendar:</strong> the whole-week allocation uses Monday, Wednesday and Friday. Both competition lifts lead each visit; assistance follows. Each competition lift still has three weekly exposures, with recovery days between loaded sessions. The restart has four stages: an ordinary Foundation week has 31/41/46/56 conventional sets and 6/6/9/12 Olympic sets. Each complete green weekly review may advance one stage, with next-session follow-ups required. Good historical recovery supports trying the progression; it does not skip observation. Record the next-session checks in History. Then review two full green weeks at a stable workload before optional additions. A controlled addition can now add one weekly Olympic or conventional set to a selected existing exercise. Source heavy-slot and bounded-assessment rules remain superseded. Existing logs and active sessions keep their original prescription.</p>
  <p><strong>Recovery:</strong> the recommended target is five minutes after each Olympic failure set before the next set or loaded exercise, plus any next-exercise ramp. Amber/global fatigue, targeted/reset weeks and sport later that day omit Olympic failure work. A technical restriction omits the affected work; no submaximal working-set substitute. Week 12 has Monday Olympic failure sets plus low-rep bench, no Tuesday/Thursday loading, Friday fixed-load failure benchmarks, and moderate bench afterward. The benchmark is not a three-attempt competition total. Week 13 has no Olympic loading and one set per retained conventional exercise. Actual bench exposures still require at least 48 hours.</p>
  <p><strong>Timing:</strong> the initial Olympic budget assumes the upper valid-rep target plus one terminal attempt. Each valid extra rep adds its work/reset countdown; an early endpoint removes unused attempts. Timers never decide whether a rep was valid or a set reached failure. Preparation, equipment changes, moderate waiting and miscellaneous time remain included. The budget uses your current warm-up steps and work/rest targets; selecting a weight or changing exercise order updates the remaining steps. Your current stage's actual plan and time appear on each day.</p>
  <p><strong>Regional coverage:</strong> the full target includes one hammer-curl set per week and two sets each of wrist curls and wrist extensions, placed after grip-dependent lifting. Wrist training research supports additional specific strength benefits, but does not establish these precise hypertrophy doses: <a href="https://pubmed.ncbi.nlm.nih.gov/15320673/" target="_blank" rel="noopener">Szymanski et al. (2004)</a>. Seated hamstring curls, knee-extended calf raises and overhead triceps extensions retain regional coverage supported by <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7969179/" target="_blank" rel="noopener">Maeo et al. (2021)</a>, <a href="https://pubmed.ncbi.nlm.nih.gov/38156065/" target="_blank" rel="noopener">Kinoshita et al. (2023)</a> and <a href="https://pubmed.ncbi.nlm.nih.gov/35819335/" target="_blank" rel="noopener">Maeo et al. (2023)</a>. <a href="https://pubmed.ncbi.nlm.nih.gov/31230110/" target="_blank" rel="noopener">Kubo et al. (2019)</a> supports adductor/glute coverage from deep squats. None establishes the exact combined weekly allocation. See the regional decisions in each day's set table for every included region and every zero-isolation choice.</p>
  <p>Volume review: <a href="https://link.springer.com/article/10.1007/s40279-025-02344-w" target="_blank" rel="noopener">Pelland et al. (2026)</a> supports a dose response with diminishing returns and fractional accounting as a heuristic; <a href="https://pubmed.ncbi.nlm.nih.gov/41843416/" target="_blank" rel="noopener">ACSM (2026)</a> supports multiple sets and higher muscle-building volume. Neither establishes these exact counts or a failure-set conversion for Olympic lifting. See the day’s set table and review landmarks.</p><p><strong>Evidence limits:</strong> failure is not established as superior for strength or power. Closer-to-failure conventional resistance work can support hypertrophy, but that does not validate repeated snatches or clean-and-jerks to technical failure. The exact per-exercise set allocation, between-rep rests, recovery period and taper/pivot changes above are practical inferences under your preference, not proven optimal or equivalent to the original plan. See <a href="https://pubmed.ncbi.nlm.nih.gov/33555822/" target="_blank" rel="noopener">Vieira et al., 2021</a>, <a href="https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/" target="_blank" rel="noopener">Robinson et al., 2024</a>, <a href="https://pubmed.ncbi.nlm.nih.gov/27038416/" target="_blank" rel="noopener">Pareja-Blanco et al., 2017</a> and <a href="https://pubmed.ncbi.nlm.nih.gov/23121475/" target="_blank" rel="noopener">Hardee et al., 2013</a>.</p></section>`;
}
function guideView() {
  const page = pages?.[guidePage - 1];
  return (
    title(
      "THE SOURCE OF TRUTH",
      "The complete program.",
      "Revision 6 · 13 September 2026 · Exact rules are reasoned inference unless the source labels them otherwise.",
    ) +
    (allLoadedFailure(state.training) ? failureGuide() : "") +
    `<section class="panel"><h2>Your current schedule</h2><p>${esc(scheduleName(state.training))}.</p><p>${state.training.doseVersion === DOSE_VERSION ? "Ordinary weeks: lift Monday, Wednesday and Friday, with both competition lifts first. Tuesday/Thursday and the weekend contain only any prescribed recovery work. Primary athletics goes after Wednesday’s Olympic work and before assistance; an earned secondary exposure uses the same order Monday. Each day’s tabs include every scheduled component. Week 11 reduces all lifting days; week 12 uses Monday work, Friday benchmarks and moderate bench afterward; week 13 has one set per assistance exercise on the three ordinary lifting days, with no Olympic failure work." : "This saved week retains its previous calendar and prescriptions. The whole-week allocation starts at the next weekly review boundary."}</p><p>Friday readiness still depends on Thursday alcohol exposure, and Monday on weekend recovery. A lighter calendar cannot cancel alcohol’s effects. The original PDF below is unchanged; the later failure and whole-week amendments govern your current prescription.</p></section>` +
    `<div class="guide-grid"><section class="panel"><h2>Four priorities, in order.</h2><ol class="priority-list"><li>Olympic weightlifting performance</li><li>Hypertrophy · upper chest, side delts, traps</li><li>Athleticism</li><li>Longevity</li></ol><p>${allLoadedFailure(state.training) ? "Your loaded-set constraint changes the Olympic prescription: each Olympic set ends at the first miss or invalid rep. Conventional work retains strict-form failure. Preparation, athletics and mobility stay outside this requirement. Equal optimality for weightlifting is not established." : "Every conventional work set reaches strict-form failure. Olympic lifts, preparation, athletics and mobility remain quality-limited."}</p><a class="button" href="program/revision-6.pdf" target="_blank" rel="noopener">Open original PDF ↗</a></section><section class="panel"><h2>Keep the endpoint honest.</h2><p>Stable machines: another complete concentric cannot be achieved with prescribed form. Free weights: last complete valid rep, no further valid rep in reserve. TECH, pain and unsafe stops are separate outcomes.</p><p>Rep ranges select the load. They do not replace the endpoint. No forced reps, drop sets, rest-pause extensions or assisted negatives.</p>${sourceLink(2)}</section></div><section class="panel source-panel"><div class="section-label"><h2>Read the source</h2><span>43 pages · available offline</span></div><div class="source-controls">${select("Program page", "guide-page", Object.fromEntries(Array.from({ length: 43 }, (_, i) => [i + 1, `${i + 1}. ${guideTitles[i] || "Peer-reviewed references"}`])), guidePage)}${input("Find a word or phrase", "guide-search", "", "search", 'placeholder="e.g. two exposures"')}</div>${page ? `<pre class="source-text" tabindex="0">${esc(page.text)}</pre>` : "<p>Loading the locally bundled source…</p>"}<div id="search-results"></div></section>`
  );
}
function settingsView() {
  const t = state.training,
    timing = timeProfile(t);
  return (
    title(
      "YOUR PROGRAM, YOUR RECORD",
      "Training setup.",
      "Use reviewed changes for workload progression. Setup changes start a new load comparison.",
    ) +
    `<section class="panel"><h2>App & offline updates</h2><p>App ${APP_BUILD} · complete session timing. Each browser/device keeps an offline copy; connect Google below to sync your journal and setup.</p>${btn("Check for updates", "check-update", "", "quiet")}<p>Updates preserve saved records. Save form changes and finish any active session before using the update banner.</p></section>` +
    `<section class="panel"><h2>Alarms</h2><p>Sound is on by default. While the app is open, the alert repeats at zero and mixes with your music.</p><form data-form="alarms">${check("Alarm sound on", "enabled", timerAlerts.preferences.enabled)}${select("Alarm volume", "volume", { 1: "Loud · 100%", 0.75: "Medium · 75%", 0.5: "Lower · 50%" }, timerAlerts.preferences.volume)}${submit("Save alarm settings")}</form><p data-alarm-state></p>${btn("Test alarm sound", "alarm-test")}<p>Use media volume for the in-app sound. On iPhone, turn off Silent mode to hear this music-friendly alert.</p><h3>When the app is closed or your phone is locked</h3><p>Enter your connection code once and allow notifications. The online service then alerts you even when the app is closed. Wait for “Background alert saved” before leaving; saving changes and receiving alerts need internet.</p><p data-push-state role="status">${esc(pushAlerts.status)}</p>${input("Connection code", "push-code", "", "password", 'autocomplete="off" spellcheck="false"')}<div class="actions">${btn(pushAlerts.device ? "Reconnect notifications" : "Enable background notifications", "push-enable")}${pushAlerts.device ? btn("Disconnect notifications", "push-disable", "", "quiet") : ""}${btn("Test with phone locked · 10 seconds", "alarm-test-away")}</div><p>Turn on Oly Tracker’s notification sounds and allow it in Focus. Your iPhone chooses the background sound and volume. Delivery may be delayed; an alert already sent cannot be recalled. Test with Apple Music playing and your screen locked.</p><p class="muted">Connect each device separately. The service receives an anonymous timer deadline and notification address, never your workout log.</p></section>` +
    `<section class="panel"><h2>Weekly schedule</h2><p>${esc(scheduleName(t))}</p>${t.doseVersion === DOSE_VERSION ? "<p>The selected whole-week prescription uses Monday, Wednesday and Friday. Both lifts come first, with assistance distributed across the three visits. Week 12 retains its special taper/benchmark calendar. Use Move this day for a real conflict; you can move just that day or also shift later unfinished days.</p>" : `<p>This saved week keeps its existing calendar until reviewed. The pending whole-week update will then apply.</p><form data-form="schedule">${select("Training calendar", "schedule", { weekday: "Weekday plan · Mon B / Tue C / Thu A / Fri D", source: "Original PDF order · Mon A / Tue B / Thu C / Fri D" }, t.nextSchedule || t.schedule)}<p class="form-error" role="alert"></p>${submit("Save training calendar")}</form>`}</section>` +
    `<section class="panel"><h2>Schedule & equipment</h2><form data-form="equipment"><div class="input-grid">${select("Visits on B/D", "split", t.doseVersion === DOSE_VERSION ? { single: "One visit per lifting day" } : { single: "Single visit", split: "Split after incline + laterals (≥3 h)" }, t.split ? "split" : "single")}${select("Smallest barbell increment · lb", "increment", { 2.5: "2.5 lb", 5: "5 lb" }, t.increment)}${select("Incline press", "incline", { default: "Machine · 30–45°", smith: "Smith · safeties", db: "Dumbbells · safe endpoint" }, t.equipment.incline || "default")}${select("Lateral raise", "lateral", { default: "Cable", db: "Dumbbell" }, t.equipment.lateral || "default")}${select("Supported row", "row", { default: "Chest-supported row · unspecified", db: "Dumbbells · chest on incline bench", machine: "Supported machine row" }, t.equipment.row || "default")}${select("Shrugs", "shrug", { barbell: "Barbell · from rack", db: "Dumbbells", machine: "Supported machine", default: "Previous setup · unspecified" }, t.equipment.shrug || "default")}${select("Leg curl", "leg_curl", { default: "Seated leg curl", lying: "Lying leg curl" }, t.equipment.leg_curl || "default")}${select("Calves", "calf", { default: "Standing, knees extended", press: "Supported knee-extended press", seated: "Seated · individualized fallback" }, t.equipment.calf || "default")}${select("Leg extension", "leg_ext", { default: "Supported reclined · ~40° hip flexion", upright: "Upright · equipment fallback" }, t.equipment.leg_ext || "default")}${select("Abdominals", "crunch", { default: "Machine crunch", cable: "Cable crunch" }, t.equipment.crunch || "default")}${select("Triceps", "triceps", { default: "Overhead cable extension", pressdown: "Pressdown · intolerance/interference" }, t.equipment.triceps || "default")}</div><p class="muted">Substitutions retain sets, reps and endpoint. Bench requires a flat barbell, safeties and competent spotting. No glute isolation.</p><p class="form-error" role="alert"></p>${submit("Save schedule & equipment")}</form></section>` +
    `<section class="panel"><h2>Time planning</h2><p>These allowances set the displayed times and guided countdowns. Training doses stay the same; extra recovery extends the prescribed rest.</p><form data-form="timing"><div class="input-grid">${select("Gym traffic · wait per station", "traffic", { quiet: "Quiet · 30 seconds", moderate: "Moderate · 2 minutes", busy: "Busy · 4 minutes" }, timing.traffic)}${input("Water, restroom & misc. · min per visit", "breakMinutes", timing.breakMinutes, "number", 'min="0" max="60" required')}${input("Typical plate / stack change · seconds", "plateSeconds", timing.plateSeconds, "number", 'min="0" max="300" required')}${input("Typical station move & setup · seconds", "stationSeconds", timing.stationSeconds, "number", 'min="0" max="600" required')}${input("Extra recovery allowance · seconds per work-set rest", "extraRestSeconds", timing.extraRestSeconds, "number", 'min="0" max="300" required')}${select("Athletics timing", "athleticsVisit", t.doseVersion === DOSE_VERSION ? { same: "Same visit · after Olympic lifts, before assistance" } : { separate: "Separate visit · allow ≥3 hours", same: "Same visit · 5-minute transition" }, timing.athleticsVisit)}</div>${check("Cable lateral raises performed one arm at a time (time both sides)", "unilateralCable", timing.unilateralCable)}<p class="muted">Setup and loading use your selected times. Countdown targets include prescribed rest plus your extra recovery allowance. One-arm timing does not apply when dumbbells are selected. Cardio shares the preceding visit when present. Arrival and departure are included; commuting is additional. A long interruption can require extra preparation. Active sessions keep their starting assumptions.</p><p class="form-error" role="alert"></p>${submit("Save time planning")}</form></section>` +
    `<section class="panel"><h2>Technical references</h2><p>SN ${t.anchors.snatch} lb · CJ ${t.anchors.cj} lb · CL ${t.anchors.clean || "unassessed"} · RJ ${t.anchors.jerk || "unassessed"}. Power clean never loads full CJ.</p>${btn("Record a demonstrated reference", "anchor")}${sourceLink(27)}</section>` +
    `<section class="panel"><h2>Technique & interference</h2><form data-form="technique"><div class="input-grid">${["snatch", "clean", "jerk"].map((k) => select(pretty(k), k, allLoadedFailure(t) ? { none: "Ordinary failure prescription", receive: "Defer affected failure work for technique / receiving review", ...(t.technique[k] !== "none" && t.technique[k] !== "receive" ? { [t.technique[k]]: "Existing technique issue · affected work deferred" } : {}) } : k === "jerk" ? { none: "Ordinary prescription", stance: "Light split stance/recovery", dip: "Light pause-dip regression" } : { none: "Ordinary prescription", receive: "Unsafe receiving · technique-bar rehearsal", return: "Secure return · 4 singles at 40–60%", turnover: "High-hang turnover replacement", balance: "First two sets knee-pause" }, t.technique[k])).join("")}</div>${t.doseVersion === DOSE_VERSION ? "" : check(allLoadedFailure(t) ? "Omit A snatch failure set: repeated next-session cost" : "Reduce A snatch doubles to 4 × 2: repeated next-session cost", "reduceA", t.reduceA)}${t.doseVersion === DOSE_VERSION ? "" : check(allLoadedFailure(t) ? "Omit C jerk failure set while reviewing recovery" : "One fewer C jerk set for two exposures; suspend C assistance", "reduceJerk", t.reduceJerk)}${check("Lower-block fatigue: curls/calves 1; omit extensions/crunch", "lowerDose", t.lowerDose)}${check("Omit week-11 D affected lower work for slow recovery", "omitLastLower", t.omitLastLower)}${t.doseVersion === DOSE_VERSION ? "" : check("Omit provisional C pulls after target/cost review", "omitPull", t.omitPull)}${textarea("Observed issue / target and return review", "reason", "", "required")}<p class="form-error" role="alert"></p>${submit("Save technical prescription")}</form>${sourceLink(16)}${sourceLink(34)}</section>` +
    trainingLink() +
    `<section class="panel" id="training-changes"><h2>Saved lifting changes</h2>${t.trials.length ? t.trials.map((trial) => `<div class="trial-row"><div><strong>${esc(trial.kind.replaceAll("_", " "))} · ${calendarWeekday(trial.day)}</strong><p>${esc(trial.reason)}</p><small>${trialExposures(state, trial).length} comparable sessions · ${trial.paused ? "paused" : trial.status}</small></div>${btn("Review", "trial", `data-id="${trial.id}"`)}</div>`).join("") : "<p>No extra sets or exercise substitutions under review.</p>"}</section>` +
    `<section class="panel"><h2>Targeted mobility</h2><form data-form="mobility"><p>Choose at most two restrictions; no extra stretching if positions are comfortable.</p>${["Ankle · bent-knee calf stretch, heel down", "Overhead shoulder · hands-on-bench lat stretch, ribs controlled", "Front rack · supported wrist stretch or unloaded elbow lifts", "Hip rotation · supported 90/90"].map((x) => check(x, "mobility", t.mobility.includes(x)).replace('name="mobility"', `name="mobility" value="${esc(x)}"`)).join("")}<div class="input-grid">${select("Hold duration", "seconds", { 30: "30 s", 45: "45 s after two weeks without improvement" }, t.mobilitySeconds)}${select("Days per week", "days", { 3: "3", 4: "4 after two weeks without improvement" }, t.mobilityDays)}</div><p class="form-error" role="alert"></p>${check("Two weeks at the current dose did not improve the selected position", "observed")}${submit("Save mobility")}</form></section>` +
    `<section class="panel"><h2>Program position</h2><p>New users start with the entry ramp. Weeks advance through review; interruptions extend elapsed time.</p>${btn("Set reviewed starting position", "position", "", "quiet")}</section><section class="panel"><h2>Backup & restore</h2><p>This journal is saved locally and can sync through Google Drive. Export regularly; browser data clearing removes local copies. The original program and app work offline after the first load.</p><div class="actions">${btn("Export full backup", "export")}<label class="file-button">Import backup<input type="file" id="import" accept="application/json,.json"></label></div><p class="muted">Import is validated before replacing the active journal; the current journal is archived in the imported backup.</p></section>`
  );
}
function render() {
  document.querySelectorAll("[data-nav]").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === view);
    b.setAttribute("aria-current", b.dataset.nav === view ? "page" : "false");
  });
  if (!state) {
    $("main").innerHTML =
      title("STORAGE RECOVERY", "Your saved data is intact.", storageError) +
      `<section class="panel"><p>Import a valid backup to recover. Existing browser keys are preserved.</p><label class="file-button">Import backup<input type="file" id="import" accept="application/json,.json"></label><a class="button" href="program/revision-6.pdf">Read the program</a></section>`;
    return;
  }
  $("main").innerHTML = (
    {
      week: weekView,
      workout: workoutView,
      history: historyView,
      guide: guideView,
      settings: settingsView,
    }[view] || weekView
  )();
  plannerIntegration?.mount(view);
  tick();
  if (view === "guide" && !pages)
    fetch("program/pages.json")
      .then((r) => {
        if (!r.ok) throw Error("Source unavailable");
        return r.json();
      })
      .then((p) => {
        pages = p;
        if (view === "guide") render();
      })
      .catch((e) => toast(e.message));
}
function openReadiness() {
  const r = contextFor(state);
  formModal(
    "Today’s readiness",
    "readiness",
    select(
      "Global state",
      "level",
      {
        green: "Green · usual positions, coordination and warm-ups",
        amber: "Amber · unusual heaviness / global fatigue",
        red: "Red · pain changes movement, dizziness, unsafe release or impairment",
      },
      r.level === "unchecked" ? "green" : r.level,
    ) +
      select(
        "Isolated local issue",
        "local",
        {
          "": "None",
          upper: "Upper-body / rack / overhead limitation",
          lower: "Lower-body limitation",
        },
        r.local,
      ) +
      select(
        "Alcohol exposure / present state",
        "event",
        {
          normal: "No disruption / casual skills only",
          limited_later:
            "Known limited event later · sober, no prior recovery problems",
          larger_later: "Larger/unfamiliar alcohol event later",
          limited_return:
            "Next day · known limited, no prior impairment, normal now",
          verification: "Larger/unknown exposure · sober & symptom-free return",
          unsafe: "Intoxicated / uncertain sobriety / impaired",
        },
        r.event?.startsWith("game") ? "normal" : r.event,
      ) +
      select(
        "Sport on the same day (also applies with alcohol)",
        "sport",
        {
          normal: "No additional sport restriction",
          game: "Demanding game already completed · defer session",
          game_defer: "Fixed demanding game · defer whole session",
          game_later: "Fixed demanding game later · ready Olympic work only",
        },
        sportEvent(r),
      ) +
      check(
        "No proper barbell bench/squat protection available",
        "noProtection",
        r.noProtection,
      ) +
      notice(
        "Bench requires tested safeties and competent spotting; squats require rack safeties and a verified safe exit. Defer unprotected barbell failure sets. Machine or dumbbell pressing does not fulfill the flat barbell bench requirement (p.25).",
      ) +
      check(
        "Game replaces nearest overlapping athletics / residual leg fatigue",
        "replaceAthletics",
        r.replaceAthletics,
      ) +
      check(
        "After completed demanding game: optional secure light rehearsal only",
        "rehearsal",
        r.rehearsal,
      ) +
      check(
        "Pivot: residual fatigue but local warm-ups are green",
        "pivotResidual",
        r.pivotResidual,
      ) +
      textarea(
        "Local soreness, positions; sport minutes/effort/runs/jumps/contact; alcohol timing & impairment",
        "notes",
        r.notes || "",
      ) +
      notice(
        "Event and safety rules override the phase. Normal warm-ups do not prove unchanged recovery. Never use loaded warm-ups to establish sobriety.",
      ),
    "Apply to today",
  );
}
function reviewChecklist(pivot) {
  return `<section class="review-checklist"><h3>Normal Friday review</h3><ul><li>Compare like-load Olympic quality and first-set failure performance. ${allLoadedFailure(state.training) ? "Review zero valid reps, >5% load loss, altered positions, or >20% valid-rep loss twice at a familiar load. The required terminal miss/invalid rep is not a failure of the program’s 90% quality gate; that gate belongs to the original submaximal protocol." : "Review >5% load loss at comparable quality, <90% good Olympic reps, altered positions, or >20% first-set rep loss twice."}</li><li>If later failure sets lose ≥2 reps twice, or the next Olympic session deteriorates, review excessive dose, rest and exercise order before adding volume. One visit remains the default; do not add a second shower requirement.</li><li>Decide: hold, one trial addition, reversal, or a reduced week.</li></ul>${pivot ? `<h3>Pivot review</h3><ul><li>Valid total or technical benchmark.</li><li>Lift videos.</li><li>Squat/bench rep performance.</li><li>Standardized physique photos and circumferences.</li><li>Optional CMJ/short-run trend from eligible athletic sessions.</li></ul>` : ""}${sourceLink(26)}</section>`;
}
function openReview() {
  const t = state.training;
  formModal(
    "Weekly comparison & decision",
    "review",
    `${reviewChecklist(t.week === 13)}${allLoadedFailure(t) ? notice(`Failure introduction ${t.failureEntry}/${DOSE_STAGES}; ${t.failureWeeks.length}/2 stable green weeks. Log next-session follow-ups in History. Only complete weeks under the new prescription qualify; older/mixed or omitted weeks do not.`) : ""}${scheduleTrialPending(t) ? notice("Schedule trial: complete two green weeks at the established dose. Compare Wednesday after Monday and Friday after Wednesday at familiar loads; review any athletic cost. A tolerable schedule is not proof of equal long-term gains.") + check(t.doseVersion === DOSE_VERSION ? "Receiving positions, Olympic quality and first-set output stayed normal across the three-day schedule" : "C/D quality, receiving positions and first-set output stayed normal under this schedule", "scheduleQuality") : ""}<p>Compare like-load Olympic quality, first failure sets and next-session positions. Resolve priority-1 needs first. If unclear: reverse health-only additions, then athletics, then recent/local hypertrophy.</p>${monitoring(
      state,
    )
      .map((s) => notice(s, "warning"))
      .join(
        "",
      )}${t.cycle === 1 ? notice(allLoadedFailure(t) ? "Review dose against the current exercise/muscle table. The established revised base already includes 4 direct shrug and 4 squat sets per week; review further additions only where useful. No plateau is required, and improving reps alone does not prove maximum growth." : "First successful cycle: schedule a trap trial toward 4 direct sets. After entry + two stable green weeks, explicitly consider one useful squat support set; no plateau required.") : ""}${[4, 8].includes(t.week) ? notice(t.doseVersion === DOSE_VERSION ? "Checkpoint: repeat the preceding secure loads and set counts. Review performance across the three lifting days; no automatic additions." : "Checkpoint: repeat the preceding successful loads/sets. At the first green checkpoint, record a target for C pulls; if none, trial omission for two C exposures.") : ""}${t.week === 13 ? notice("Pivot: review demonstrated lifts, videos, squat/bench reps, standardized physique photos/circumferences, and existing jump/run trends. Change one input at a time.") : ""}${select("Week decision", "action", { hold: "Hold / repeat this phase week", advance: "Advance after resolving the week" }, "hold")}${select("Recovery dose", "recovery", { normal: "Normal / return toward normal", targeted: "Targeted reduction", reset: "Full fatigue reset" }, t.recovery === "restore" ? "normal" : t.recovery)}${check("This was a green week; subsequent practice and local warm-ups stayed normal", "green")}${check(allLoadedFailure(t) ? "Build gate: two normal weeks, secure valid reps before the endpoint, no recurring receiving limitation" : "Build gate: two normal weeks, ≥90% acceptable Olympic reps, no recurring receiving limitation", "buildReady", t.gate !== "F")}${check("Realization gate: 80–85% singles are secure", "realizationReady", t.gate === "R")}${t.recovery === "restore" ? check("Gradual restoration has reached the prior tolerated dose with normal subsequent practice", "restored") : ""}${textarea("Like-load comparisons, dose decision, squat/trap/pull review; pivot measurements and video references", "notes", "", "required")}${sourceLink(30)}`,
    "Save weekly review",
  );
}
function trainingLink() {
  return `<section class="panel training-entry"><div><h2>Add or adjust training</h2><p>Jumps & short runs, easy cardio, lifting sets or targeted stretching. See what changes, when to add it, and what comes next.</p></div>${btn("Add or adjust training", "change", "", "primary button")}</section>`;
}
function trainingStatus() {
  const step = introductionStatus(state),
    pending = observation(state);
  return `<div class="training-status"><strong>${esc(step.title)}</strong><p>${esc(step.text)}</p>${step.action ? btn("Open Weekly review", step.action) : ""}${pending ? `<p>${esc(pending.text)}</p>${btn(pending.action === "history" ? "Record next-session recovery" : "Open Weekly review", pending.action)}` : ""}</div>`;
}
function openTraining() {
  const t = state.training;
  modal(
    "Add or adjust training",
    `${trainingStatus()}<div class="training-options">
    <article><h3>Jumps & short runs</h3><p>Build jumping and sprinting skills. ${t.athletics.enabled ? esc(doseText(t.athletics)) : "Start with one short session after your Olympic lifts."}</p>${btn("See athletics plan", "optional", 'data-domain="athletics"', "primary button")}</article>
    <article><h3>Easy cardio</h3><p>${t.cardio.enabled ? `${t.cardio.minutes} moving minutes per week.` : "Start with two 20-minute brisk walks or easy rides."} Keep a pace where you can speak in full sentences.</p>${btn("See cardio plan", "optional", 'data-domain="cardio"')}</article>
    <article><h3>Lifting sets</h3><p>Add one weekly set to an exercise with a clear reason, or remove an unproductive set. More work is not automatically better.</p>${allLoadedFailure(t) ? btn("Adjust lifting sets", "lifting-changes") : btn("Review lifting changes", "advanced-change")}</article>
    <article><h3>Targeted stretching</h3><p>Choose up to two positions that actually limit your lifts. The stretches, timers and active movement checks appear on their workout days.</p>${btn("Choose stretches", "mobility-settings")}</article>
    </div><details class="training-details"><summary>Exercise substitutions and other specialized changes</summary><p>Use this for a specific observed limitation. Ordinary jumps, runs and cardio are covered in the guided plans above.</p>${btn("Review one program change", "advanced-change")}${state.training.trials.length ? btn("Review existing lifting changes", "trials") : ""}</details><details class="training-details"><summary>Why this order?</summary><p>Your priority order is weightlifting, muscle development, athletics, then health-only conditioning. Make one useful change, observe its effect, and keep it only if it helps without disrupting higher priorities. You do not have to exhaust lifting changes or wait for muscle growth to stall before starting athletics.</p><p>Research supports jump/sprint training and aerobic health benefits, but does not establish an exact best dose or guarantee zero interference for your failure-based routine. The small starting doses, two-session reviews and ordering are individualized programming choices. The first six jumps are familiarization, not a permanent target.</p><p><a href="https://pubmed.ncbi.nlm.nih.gov/31754845/" target="_blank" rel="noopener">Sprint training review</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC10457889/" target="_blank" rel="noopener">Jump-training evidence gaps</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8891239/" target="_blank" rel="noopener">Concurrent training review</a></p></details>`,
  );
}
function optionalPreviewHTML(kind) {
  const p = optionalPreview(state, kind);
  return `<div class="dose-comparison"><div><small>NOW</small><p>${esc(kind.startsWith("cardio") ? (state.training.cardio.enabled ? `${state.training.cardio.minutes} aerobic minutes per week` : "No formal cardio added") : doseText(state.training.athletics, secondaryKind(kind)))}</p></div><div><small>AFTER THIS CHANGE</small><p>${esc(kind.startsWith("cardio") ? `${p.training.cardio.minutes} aerobic minutes per week` : doseText(p.training.athletics, secondaryKind(kind)))}</p></div></div>${p.days
    .map(
      (d) =>
        `<article class="training-day"><h4>${esc(d.label)} · ${esc(dateLabel(d.date))}</h4><ul>${d.sessions
          .flatMap((s) => s.rows)
          .map((r) => `<li>${esc(r.name)}: ${esc(describe(r))}</li>`)
          .join(
            "",
          )}</ul><p><b>${minutesText([d.afterSeconds, d.afterSeconds])} whole day</b> · ${d.addedSeconds >= 0 ? "+" : "−"}${minutesText([Math.abs(d.addedSeconds), Math.abs(d.addedSeconds)])} from this change</p></article>`,
    )
    .join(
      "",
    )}${!p.days.length ? notice(p.unchangedReason) : ""}<p class="muted">Planned times include warm-ups, rests, transitions, setup, your gym-traffic allowance and misc. time. Daily readiness, interruptions and moving workout dates can change the actual plan.</p>`;
}
function optionalAction(kind) {
  const status = optionalStatus(state, kind);
  const guidance = `<div class="training-status"><strong>${status.allowed ? "Ready to review" : "Before adding this"}</strong><p>${esc(status.reason)}</p>${status.action ? btn({ review: "Open Weekly review", history: "Record next-session recovery", resume: "Return to workout", trials: "Review existing lifting changes" }[status.action], status.action) : ""}</div>`;
  return `${status.allowed ? "" : guidance}<h3>${esc(changeLabel(state.training, kind))}</h3>${optionalPreviewHTML(kind)}${status.allowed ? guidance + btn("Review this change", "optional-change", `data-kind="${kind}"`, "primary button") : ""}`;
}
function openOptional(domain) {
  const t = state.training,
    athletics = domain === "athletics",
    kind = nextOptionalChange(t, domain);
  const mainDay = weekdayFor(state, primaryAthleticSlot(t));
  const secondDay = weekdayFor(state, secondaryAthleticSlot(t));
  const options = athletics ? athleticAlternatives(t) : [];
  const a = t.athletics;
  modal(
    athletics ? "Your athletics plan" : "Your cardio plan",
    `${btn("All training options", "change", "", "quiet")}<p>${athletics ? `Normally ${mainDay}, after Olympic lifts${threeDaySchedule(t) ? " and before assistance, in the same visit" : ""}. Full running warm-up and rests are included. Jumps and runs stop when quality falls; they do not go to failure.` : "Brisk walking or easy cycling at a full-sentence talking pace. The main sessions build to 30 minutes each; additional minutes become short walks on other days. Your actual days are listed below."}</p>${athletics && a.secondary ? `<p><b>Second session · ${secondDay}:</b> ${esc(doseText(a, true))}</p>` : ""}<section class="training-next"><span class="eyebrow">${athletics && a.enabled && a.stage >= 7 ? "REVIEW BEFORE ADDING MORE" : "NEXT SMALL CHANGE"}</span>${kind ? optionalAction(kind) : "<p>You have reached the program’s current planning limit. Keep or reduce the established dose and review whether it is useful.</p>"}</section>${athletics ? `<details class="training-details"><summary>See the progression from the beginning</summary><p>Repeat each dose for at least two successful sessions and confirm normal recovery at the following lifting session. Then change just one part. Eligible weeks and higher-priority training still take precedence.</p><ol class="athletic-roadmap">${Array.from({ length: 8 }, (_, stage) => `<li${a.enabled && a.stage === stage ? ' aria-current="step"' : ""}><b>${stage === 0 ? "Start" : `Next ${stage}`} ${a.enabled && a.stage === stage ? "· Current dose" : ""}</b><br>${esc(doseText({ ...a, enabled: true, stage, secondary: 0, variation: "none" }))}</li>`).join("")}</ol><p>Review how the work is helping around 4 sets of jumps and 4 × 20 m runs. These are review points, not quotas. Continuing at the same dose is a valid decision.</p></details>${options.length ? `<details class="training-details"><summary>Other athletic goals · choose one alternative</summary><p>These replace the next change above. A second day requires four successful main sessions. Flying runs or cuts require established 4 × 20 m runs; they replace two runs on alternate sessions. Review around 24–36 purposeful jumps and 6–8 short runs per week across both days; those are not mandatory targets.</p><div class="training-buttons">${options.map((k) => btn(changeLabel(t, k), "optional-change", `data-kind="${k}"`)).join("")}</div></details>` : ""}` : `<details class="training-details"><summary>How cardio increases</summary><ol><li>Start with 20 minutes on each of two days.</li><li>After two weeks with normal performance and recovery, add 5 minutes to one session. Repeat gradually until both reach 30 minutes.</li><li>Then add 10 minutes per week as short walks, with two weeks to review each increase, toward 150 minutes.</li><li>Only after a full cycle tolerating 150 minutes, consider further 10-minute increases toward 300.</li></ol><p>A justified lifting or athletic change comes before extra health-only cardio. Keep the pace easy and count actual moving minutes once.</p></details>`}${(athletics ? a.enabled : t.cardio.enabled) ? `<details class="training-details"><summary>Keep, reduce or pause</summary><p>Keeping the current dose needs no action. If the new work worsens lifting, technique, soreness or recovery, reduce the responsible addition and check the next comparable workout.</p>${btn("Reduce or pause this work", "optional-reduce", `data-domain="${domain}"`)}</details>` : ""}`,
  );
}
function openOptionalChange(kind) {
  const status = optionalStatus(state, kind),
    athletics = !kind.startsWith("cardio");
  const body = `${btn("Back to plan", "optional", `data-domain="${athletics ? "athletics" : "cardio"}"`, "quiet")}${optionalPreviewHTML(kind)}${notice(status.reason)}${status.action ? btn({ review: "Open Weekly review", history: "Record next-session recovery", resume: "Return to workout", trials: "Review existing lifting changes" }[status.action], status.action) : ""}`;
  if (!status.allowed) return modal(changeLabel(state.training, kind), body);
  formModal(
    changeLabel(state.training, kind),
    "optional-change",
    `${body}<input type="hidden" name="kind" value="${kind}"><p><b>After saving:</b> this work appears on the day tabs with its warm-up, timers and rests. ${athletics ? "Keep other additions steady for two successful sessions. Confirm normal recovery at the following lifting session in History, then return here." : "Keep other additions steady for two weeks, then complete Weekly review and return here."} No increase happens automatically.</p>${check(athletics ? "Lifting and recovery are normal; the listed preparation is complete, and I am changing only this part of training." : "I have had two weeks of normal lifting and recovery at this workload, and I am not increasing lifting or athletics at the same time.", "confirmed")}${kind === "cardio_step" && state.training.cardio.minutes >= 150 ? check("I tolerated 150 minutes per week for a full cycle before this further expansion.", "fullCycle") : ""}${textarea("What this should improve / anything to compare next time", "reason", athletics ? "Develop jumping and sprinting while preserving Olympic quality and normal next-session recovery." : "Improve aerobic health while preserving lifting and athletic performance.", "required")}`,
    "Add to my week",
  );
}
function openLiftingChanges() {
  const t = state.training;
  modal(
    "Adjust lifting sets",
    `${btn("All training options", "change", "", "quiet")}<p>Select an exercise on the day you want to change. One added set is one extra set per week, not an extra set every day. Use repeated comparable performance and recovery observations to decide whether it helps.</p>${programDays(
      t,
    )
      .map((day) => {
        const rows = dayPlan(t, day)
          .sessions.flatMap((s) => s.rows)
          .filter((e) => e.kind === "failure" || olympicFailure(e));
        return rows.length
          ? `<details class="training-details"><summary>${esc(weekdayFor(state, day))} · ${rows.length} exercises</summary>${rows.map((e) => `<div class="training-lift"><strong>${esc(e.name)} · ${e.sets} ${e.sets === 1 ? "set" : "sets"}</strong><div>${btn("Add 1 weekly set", "set-change", `data-day="${day}" data-id="${e.id}" data-kind="${olympicFailure(e) ? "olympic_set" : "set"}"`)}${e.sets > 1 ? btn("Remove 1 weekly set", "set-change", `data-day="${day}" data-id="${e.id}" data-kind="reduce_set"`) : ""}</div></div>`).join("")}</details>`
          : "";
      })
      .join("")}`,
  );
}
function openSetChange(day, id, kind) {
  const row = dayPlan(state.training, day)
      .sessions.flatMap((s) => s.rows)
      .find((e) => e.id === id),
    remove = kind === "reduce_set";
  if (!remove) {
    let reason = "";
    const pending = observation(state);
    if (pending && !pending.complete) reason = pending.text;
    else {
      try {
        applyChange(copy(state), {
          kind,
          day,
          exercise: id,
          ready: true,
          stable: true,
          reason: "Preview only",
        });
      } catch (e) {
        reason =
          failureTrialPending(state.training) ||
          scheduleTrialPending(state.training)
            ? `${introductionStatus(state).title}. ${introductionStatus(state).text}`
            : e.message;
      }
    }
    if (reason)
      return modal(
        "Before adding this set",
        `<p><b>${esc(row.name)} · ${esc(weekdayFor(state, day))}</b></p>${notice(reason)}${btn("Back to lifting sets", "lifting-changes")}${btn("Open Weekly review", "review")}`,
      );
  }
  formModal(
    `${remove ? "Remove" : "Add"} one ${weekdayFor(state, day)} set`,
    "change",
    `<input type="hidden" name="kind" value="${kind}"><input type="hidden" name="exercise" value="${id}"><input type="hidden" name="day" value="${day}"><p><b>${esc(row.name)}:</b> ${row.sets} → ${row.sets + (remove ? -1 : 1)} sets on ${esc(weekdayFor(state, day))}. Other days stay at their current set counts.</p>${remove ? "" : `${trainingStatus()}${check("At least three comparable observations support this addition; lifting and recovery are normal.", "ready")}${check("Two weeks at the same workload are complete; I am changing only this exercise.", "stable")}<p>Keep other additions steady. Review tolerance after two comparable sessions, early response after four, and benefit after eight. These reviews do not establish a personal maximum for muscle growth.</p>`}${textarea("What your recent training showed and why this change should help", "reason", "", "required")}`,
    remove ? "Remove this weekly set" : "Add this weekly set",
  );
}

function openAdvancedChange() {
  formModal(
    "One reviewed change",
    "change",
    select(
      "Program change",
      "kind",
      Object.fromEntries(
        Object.entries(CHANGE_OPTIONS).filter(([k]) =>
          allLoadedFailure(state.training)
            ? !sourceOlympicChange(k) && !optionalKind(k)
            : !["olympic_set", "reduce_set"].includes(k),
        ),
      ),
      "set",
    ) +
      `<div class="input-grid">${select("Exercise for this change", "exercise", { snatch: "Full snatch", cj: "Clean & jerk", hang: "Hang snatch", jerk: "Rack jerk", pull: "Snatch pull", bench: "Flat barbell bench", incline: "Incline", lateral: "Lateral raise", shrug: "Shrug", row: "Row", pulldown: "Pulldown", rear_delt: "Rear delt", curl: "Supinated curl", hammer_curl: "Hammer curl", wrist_curl: "Wrist curl", wrist_extension: "Wrist extension", triceps: "Triceps", leg_curl: "Leg curl", calf: "Calf", leg_ext: "Leg extension", crunch: "Crunch", front_squat: "Front squat", back_squat: "Back squat", press: "Overhead press (active substitution)" }, "shrug")}${select("Day for an added set", "day", { monday: `A · ${calendarWeekday("monday")}`, thursday: `C · ${calendarWeekday("thursday")}`, tuesday: `B · ${calendarWeekday("tuesday")}`, friday: `D · ${calendarWeekday("friday")}` }, "friday")}${allLoadedFailure(state.training) ? "" : input("Previous secure rack working load (rack progression only)", "baselineLoad", "", "number", 'min="1" step="any"') + input("New rack or pause-jerk trial load (+2.5–5 lb only)", "load", "", "number", 'min="1" step="any"')}</div>` +
      notice(
        allLoadedFailure(state.training)
          ? "Failure amendment: Olympic load recommendations use the previous workout: +10 lb if every set reaches the top of its good-rep range, −10 lb if a completed set is below the bottom, otherwise hold. One added weekly Olympic set can be trialed on an existing row after the stable-dose review. Source heavy slots and bounded assessments remain superseded. Optional conventional/athletic/aerobic additions require the new introduction plus two complete stable green weeks. Other source eligibility rules still apply."
          : "Use pages 15, 21–22, 27–29 and 31–34 for eligibility. Assessments need two secure Olympic weeks + safe release. Assistance needs ≥3 comparable observations. Primary athletics progresses after two good exposures per step; second slot after four productive primary exposures. Heavy trials replace one attempt in one lift, at 90–92%, with the final D gate earned first.",
      ) +
      check(
        "Relevant prerequisite observations, technique, readiness and priority order are satisfied",
        "ready",
      ) +
      check(
        "Two green weeks at stable workload / the specified successful exposures; no other dose change in this observation window",
        "stable",
      ) +
      check(
        "Earlier athletics start only: already adapted to this dose before this journal, with two stable green weeks in my training history",
        "adapted",
      ) +
      check(
        "Four productive primary athletic exposures completed (second slot only)",
        "fourPrimary",
      ) +
      check(
        "150 min was well tolerated for a full cycle (progression above 150 only)",
        "fullCycle",
      ) +
      textarea(
        "Target and baseline: comparable loads, video/position/rep observations, reason to trial or progress",
        "reason",
        "",
        "required",
      ),
    "Apply reviewed change",
  );
}
function openRecord(id) {
  const r = state.records.find((r) => r.id === id);
  if (!r) return;
  modal(
    r.session.title,
    `<p>${stamp(r.startedAt)} · ${esc(r.status)} · Cycle ${r.cycle}, week ${r.week}</p>${btn("Delete session", "delete-session", `data-id="${r.id}"`, "button danger")}${pacingLog(r)}${preparationLog(r)}${partialMobilityLog(r)}${partialAerobicLog(r)}${r.session.rows
      .map(
        (e) =>
          `<details open><summary>${esc(e.name)} · ${esc(describe(e))}</summary><ol>${r.sets
            .filter((x) => x.key === e.key)
            .map((x) => `<li>${setText(x)}</li>`)
            .join(
              "",
            )}</ol>${olympicFailure(e) && r.sets.some((x) => x.key === e.key) ? btn("Correct rep count", "correct-olympic", `data-id="${r.id}" data-key="${e.key}"`, "button") : ""}${r.omissions
            .filter((x) => x.key === e.key)
            .map((x) => `<p>Omitted: ${esc(x.reason)}</p>`)
            .join("")}</details>`,
      )
      .join(
        "",
      )}<p>${esc(r.notes)}</p><hr><form data-form="followup" data-id="${r.id}"><h3>Next-session check</h3>${check("Comparable next Olympic practice and local positions were normal", "normal", r.followup?.normal)}${check("This exposure needed more than 5% less load for comparable Olympic quality (same task and conditions)", "loadDrop", r.followup?.loadDrop)}${select("Receiving / lockout positions", "positions", { normal: "Normal", altered: "Soreness or fatigue altered positions" }, r.followup?.positions || "normal")}${textarea("Next-session response, familiar loads/reps, unusual soreness and video reference", "notes", r.followup?.notes || "", "required")}<p class="form-error" role="alert"></p>${submit("Save follow-up")}</form>`,
  );
}
function exportJSON(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function action(el) {
  const { action: a, day, id, key } = el.dataset;
  if (a === "close") return close();
  if (a === "day") {
    selected = day;
    return render();
  }
  if (a === "week") return nav("week");
  if (a === "resume") return nav("workout");
  if (a === "readiness") return openReadiness();
  if (a === "review") return openReview();
  if (a === "change") return openTraining();
  if (a === "advanced-change") return openAdvancedChange();
  if (a === "optional") return openOptional(el.dataset.domain);
  if (a === "optional-change") return openOptionalChange(el.dataset.kind);
  if (a === "lifting-changes") return openLiftingChanges();
  if (a === "set-change") return openSetChange(day, id, el.dataset.kind);
  if (a === "history") return nav("history");
  if (a === "trials") {
    nav("settings");
    document
      .getElementById("training-changes")
      ?.scrollIntoView({ block: "start" });
    return;
  }
  if (a === "optional-reduce") {
    const athletics = el.dataset.domain === "athletics";
    const last = state.reviews.findLast(
      (r) =>
        r.afterAthletics &&
        JSON.stringify(r.afterAthletics) ===
          JSON.stringify(state.training.athletics),
    );
    const choices = athletics
      ? {
          athletics: "Pause all athletics",
          ...(last?.beforeAthletics
            ? { athletics_undo: "Undo the last saved athletic change" }
            : {}),
          ...(state.training.athletics.stage > 0
            ? { athletic_step: "Undo one increase on the main day" }
            : {}),
          ...(state.training.athletics.secondary
            ? { secondary: "Remove the second athletic day" }
            : {}),
        }
      : {
          cardio: "Pause formal cardio",
          ...(state.training.cardio.minutes > 40
            ? { cardio_step: "Undo one increase in weekly minutes" }
            : {}),
        };
    return formModal(
      "Reduce or pause",
      "reduce-optional",
      select(
        "What to change",
        "kind",
        choices,
        athletics ? "athletics" : "cardio",
      ) +
        textarea(
          "What changed in your performance or recovery?",
          "reason",
          "",
          "required",
        ),
      "Save reduction",
    );
  }
  if (a === "record") return openRecord(id);
  if (a === "exercise-next")
    return transact(
      (s) => moveExerciseNext(s, key),
      "Exercise moved next. Your remaining work is still in the workout list.",
    );
  if (a === "olympic-report") {
    const w = state.active,
      e = nextRow(w),
      status = rowStatus(w, e);
    return formModal(
      "Log the completed Olympic set",
      "olympic-report",
      olympicReportFields(
        e,
        status.currentValidReps || "",
        status.logs[0]?.weight ||
          e.workingLoad ||
          nextQualityRange(w, e)?.[0] ||
          "",
      ),
      "Save completed set",
    );
  }
  if (a === "correct-olympic") {
    const r = state.records.find((r) => r.id === id),
      e = r.session.rows.find((e) => e.key === key);
    const groups = failureSets(r.sets.filter((x) => x.key === key)),
      last = groups.at(-1);
    return formModal(
      "Correct saved Olympic reps",
      "correct-olympic",
      `<input type="hidden" name="record" value="${id}"><input type="hidden" name="key" value="${key}">${select("Saved set", "setNumber", Object.fromEntries(groups.map((g, i) => [i + 1, `Set ${i + 1} · ${validReps(g)} good reps saved`])), groups.length)}<div class="correction-fields">${olympicReportFields(e, validReps(last), last[0].weight, reportedFinish(last.at(-1)), last.at(-1).fault || "")}</div><p>The original entry is retained in the correction history. Select the intended set and enter its actual total.</p>`,
      "Save correction",
    );
  }
  if (a === "delete-session") {
    const r = state.records.find((r) => r.id === id);
    if (!r) throw Error("This saved session no longer exists.");
    return modal(
      "Delete this session?",
      `<h3>${esc(r.session.title)}</h3><p>${stamp(r.startedAt)} · Cycle ${r.cycle}, week ${r.week} · ${r.sets.length} saved entries</p><p>Delete this session’s entries, warm-ups, timers, notes and follow-up. It will no longer count toward history or progression.${r.weekId === state.weekId ? " Its slot in this week will be available to start again, whenever you choose." : " Your current program week will stay unchanged."}</p><p>This cannot be undone in the app. Existing exported backups are unchanged.</p><div class="actions">${btn("Keep session", "record", `data-id="${id}"`)}${btn("Delete session permanently", "confirm-delete-session", `data-id="${id}"`, "button danger")}</div>`,
    );
  }
  if (a === "confirm-delete-session") {
    let result;
    transact((s) => {
      result = deleteSession(s, id);
    });
    close();
    if (result.currentWeek) selected = result.day;
    nav(result.currentWeek ? "week" : "history");
    toast(
      result.currentWeek
        ? "Session deleted. Its slot is available again."
        : "Session deleted from history.",
    );
    return;
  }
  if (a === "source") {
    guidePage = Number(el.dataset.page);
    return nav("guide");
  }
  if (a === "start") {
    const options = {
      fullPlan: el.dataset.full === "1",
      repeat: el.dataset.repeat === "1",
    };
    if (state.active) {
      if (state.active.day === day && state.active.session.id === id) {
        if (options.fullPlan) transact((s) => useFullWorkout(s));
        return nav("workout");
      }
      return formModal(
        "Switch workouts",
        "switch-workout",
        `<p>A workout is already open. Save it as an unfinished workout and start the selected session, or close this window to keep it open. All recorded sets will be kept.</p><input type="hidden" name="day" value="${day}"><input type="hidden" name="id" value="${id}"><input type="hidden" name="fullPlan" value="${options.fullPlan}"><input type="hidden" name="repeat" value="${options.repeat}">`,
        "Save current & start selected workout",
      );
    }
    timerAlerts.acknowledge();
    transact((s) => startSession(s, day, id, Date.now(), options));
    nav("workout");
    try {
      wakeLock = await navigator.wakeLock?.request("screen");
    } catch {}
    return;
  }
  if (a === "use-full-workout") return transact((s) => useFullWorkout(s));
  if (a === "defer")
    return formModal(
      "Move the whole session day",
      "defer",
      `<input type="hidden" name="day" value="${day}">${input("Workout date", "date", scheduledDate(state, day), "date", "required")}${check("Also shift later unfinished days by the same interval", "rollLater")}${textarea("Note (optional)", "reason")}<p>Choose an earlier or later date. Other days stay where they are unless you select the option above. Existing logs retain their actual dates.</p>`,
      "Save workout date",
    );
  if (a === "omit-session")
    return formModal(
      "Omit this session",
      "omit-session",
      `<input type="hidden" name="day" value="${day}"><input type="hidden" name="id" value="${id}">${textarea("Reason; omitted blocks are dropped, bench can be rescued separately", "reason", "", "required")}`,
      "Record omission",
    );
  if (a === "failure-guide") return nav("guide");
  if (a === "mobility-settings") {
    nav("settings");
    document
      .querySelector('[data-form="mobility"]')
      ?.scrollIntoView({ block: "center" });
  }
  if (a === "rescue")
    return formModal(
      "Preserve bench continuity",
      "rescue",
      select(
        "Unperformed slot",
        "slot",
        {
          bench_low: "Low-rep flat barbell bench · 3–5",
          bench_moderate: "Moderate flat barbell bench · 6–8",
        },
        consumedBench(state, "bench_low") ? "bench_moderate" : "bench_low",
      ) +
        `<p>The program recommends ≥48 actual hours between sessions. This is guidance; you can start whenever you choose. Keep bench after priority lifting and away from a vulnerable next session. D can become low-rep with moderate bench on the next eligible day; shift the next B when needed. Only bench is rescued.</p>${notice(benchWindow(state).last ? "Last bench: " + stamp(benchWindow(state).last) + ". Recommended next: " + stamp(benchWindow(state).eligibleAt) : "No previous bench timestamp recorded.")}${sourceLink(20)}`,
      "Start bench session",
    );
  if (a === "relocate") {
    transact((s) => {
      if (s.active)
        throw Error("Finish the active session before relocating athletics.");
      if (s.training.week === 11 || s.training.week === 12)
        throw Error(
          "Week 11 retains only the scheduled half-dose primary module; week 12 has no athletics.",
        );
      if (
        weekRecords(s).some(
          (r) => r.session.id === "athletics" && r.sets.length,
        )
      )
        throw Error("Primary module already performed this week.");
      s.athleticDay = secondaryAthleticSlot(s.training);
    }, "Primary athletics moved to the backup lifting slot; no extra module.");
    return;
  }
  if (a === "pace-show") {
    nav("workout");
    document.querySelector(".pace-card")?.scrollIntoView({ block: "start" });
    return;
  }
  if (a === "pace-enable")
    return transact((s) => {
      s.active.timeConfig ||= {
        ...copy(s.training),
        anchors: copy(s.active.anchors),
        increment: s.active.increment,
      };
      createPacing(s.active);
      syncPacing(
        s.active,
        Object.fromEntries(
          s.active.session.rows.map((e) => [e.key, rowStatus(s.active, e)]),
        ),
      );
      s.active.pacing.plannedSeconds = paceStatus(s.active).remaining;
    });
  if (a === "pace-sound") {
    timerAlerts.save({ enabled: !timerAlerts.preferences.enabled });
    refreshAlerts(true);
    return render();
  }
  if (a === "push-enable") {
    el.disabled = true;
    try {
      await pushAlerts.enable(
        document.querySelector('[name="push-code"]').value,
      );
      render();
      refreshAlerts(true);
    } finally {
      el.disabled = false;
    }
    return;
  }
  if (a === "push-disable") {
    el.disabled = true;
    try {
      await pushAlerts.disable();
      render();
      refreshAlerts();
    } finally {
      el.disabled = false;
    }
    return;
  }
  if (a === "alarm-dismiss") {
    timerAlerts.acknowledge();
    refreshAlerts();
    return;
  }
  if (a === "alarm-resume") {
    refreshAlerts(true);
    return;
  }
  if (a === "alarm-test" || a === "alarm-test-away") {
    if (state.active)
      throw Error(
        "Test the alarm between workouts so the test cannot replace a session alarm.",
      );
    if (!timerAlerts.preferences.enabled)
      throw Error("Turn alarm sound on before testing.");
    if (a === "alarm-test-away" && !pushAlerts.device)
      throw Error(
        "Enable background notifications on this device before the locked-phone test.",
      );
    timerAlerts.test(a === "alarm-test-away" ? 10 : 0);
    refreshAlerts();
    return;
  }
  if (a === "pace-start") {
    return transact((s) => {
      const w = s.active,
        stage = paceStage(w);
      startPaceStage(w);
      if (stage.role === "mobility" && !w.mobilityRun) startMobility(s);
      if (stage.role === "aerobic") startAerobic(s);
    });
  }
  if (a === "pace-set-end") {
    transact((s) => endPaceSet(s.active));
    document
      .querySelector('[data-form="set"]')
      ?.scrollIntoView({ block: "center" });
    return;
  }
  if (a === "pace-pause")
    return transact((s) => {
      pausePace(s.active);
      if (paceStage(s.active).role === "aerobic" && s.active.aerobicRun)
        pauseAerobic(s);
      if (s.active.preparationTimer) pausePreparation(s);
    });
  if (a === "pace-add") return transact((s) => extendPace(s.active));
  if (a === "pace-break") return transact((s) => takePaceBreak(s.active));
  if (a === "pace-break-end") return transact((s) => finishPaceBreak(s.active));
  if (["pace-next", "pace-skip"].includes(a))
    return transact((s) => {
      const w = s.active,
        stage = paceStage(w),
        now = Date.now();
      if (stage.role === "mobility") {
        if (!w.mobilityRun) throw Error("Start the timed drill first.");
        completeMobilityStep(s, now);
        return;
      }
      if (stage.role === "general" && !w.preparationTimer)
        startPreparation(s, "general", w.pacing.timer?.startedAt ?? now);
      if (
        stage.key &&
        ["setup", "waiting", "recovery", "ramp", "ramp-rest"].includes(
          stage.role,
        ) &&
        !w.preparationTimer &&
        !w.preparations.includes(stage.key) &&
        ["quality", "failure", "speed"].includes(
          w.session.rows.find((e) => e.key === stage.key)?.kind,
        )
      )
        startPreparation(s, stage.key, w.pacing.timer?.startedAt ?? now);
      if (stage.role === "general-check") finishPreparation(s, "general", now);
      if (stage.role === "prepare-check") finishPreparation(s, stage.key, now);
      completePaceStage(w, now, a === "pace-skip");
      if (a === "pace-skip" && ["rest", "recovery"].includes(stage.role))
        s.restEnd = 0;
      if (a === "pace-skip" && stage.role === "ramp") {
        const next =
          w.pacing.plan[w.pacing.plan.findIndex((x) => x.id === stage.id) + 1];
        if (next?.role === "ramp-rest")
          w.pacing.completed.push({
            id: next.id,
            label: next.label,
            key: next.key,
            role: next.role,
            targetSeconds: next.seconds,
            startedAt: null,
            endedAt: now,
            seconds: null,
            method: "not-needed",
          });
      }
    });
  if (a === "prep-start")
    return transact((s) => {
      const p = s.active.pacing;
      if (
        key === "rewarm" &&
        p?.timer &&
        p.timer.pausedAt === null &&
        !p.workEndedAt
      ) {
        pausePace(s.active);
        p.rewarmResume = true;
      }
      startPreparation(s, key);
      s.active.preparationTimer.manualCountdown = true;
    });
  if (a === "check-update") return $("check-update").click();
  if (a === "prep-pause") return transact((s) => pausePreparation(s));
  if (a === "mobility-start") return transact((s) => startMobility(s));
  if (a === "mobility-next") return transact((s) => completeMobilityStep(s));
  if (a === "aerobic-start") return transact((s) => startAerobic(s));
  if (a === "aerobic-pause") return transact((s) => pauseAerobic(s));
  if (a === "aerobic-review") {
    if (state.active.aerobicRun?.pausedAt === null)
      transact((s) => pauseAerobic(s));
    const e = nextRow(state.active),
      timer = state.active.aerobicRun;
    return formModal(
      "Save actual moving time",
      "aerobic",
      `<p>Planned: ${e.minutes} min. ${timer ? `Clock: ${time(preparationElapsed(timer))} unpaused. ` : ""}Exclude setup, waits and breaks. Confirm the minutes you actually moved; shorter work is retained without make-up debt.</p>${input("Actual moving minutes", "minutes", timer ? Math.min(e.minutes, Math.floor(preparationElapsed(timer) / 6) / 10) : e.minutes, "number", `min="0.1" max="${e.minutes}" step="any" required`)}`,
      "Save moving minutes",
    );
  }
  if (a === "warmup") return transact((s) => finishPreparation(s, "general"));
  if (a === "prepare")
    return transact((s) => {
      finishPreparation(s, key);
      if (key === "rewarm" && s.active.pacing?.rewarmResume) {
        pausePace(s.active);
        s.active.pacing.rewarmResume = false;
      }
    });
  if (a === "omit-row")
    return formModal(
      "Omit exercise",
      "omit-row",
      `<input type="hidden" name="key" value="${key}">${textarea("Reason", "reason", "", "required")}`,
      "Record omission",
    );
  if (a === "end-early")
    return formModal(
      "End the session",
      "end-early",
      textarea("Why is the remaining work omitted?", "reason", "", "required") +
        "<p>Completed work stays logged. Omitted accessories create no debt. Unperformed bench may be rescued.</p>",
      "End & save",
    );
  if (a === "finish")
    return formModal(
      "Save the session",
      "finish",
      textarea(
        state.active.session.kind === "mobility"
          ? "Position recheck, comfort and changes"
          : state.active.session.kind === "cardio"
            ? "Talk test, effort, route and any interruptions"
            : "Technique cue, best secure singles, changes and local soreness",
        "notes",
        state.active.notes || "",
      ),
      "Finish session",
    );
  if (a === "benchmark")
    return transact(
      benchmark,
      "Technical benchmark selected; existing attempts still count.",
    );
  if (a === "easy-return")
    return formModal(
      "Reduced Olympic work still poor",
      "easy-return",
      `<p>Stop, or at most four easy singles at 50–60%, capped by remaining planned reps. Continue only if secure. No failure work.</p>${check("Easy singles are secure; otherwise I will end the session", "secure")}`,
      "Use bounded easy singles",
    );
  if (a === "undo")
    return transact((s) => {
      const w = s.active,
        last = w.sets.pop();
      if (!last) return;
      w.omissions = w.omissions.filter(
        (o) =>
          !(
            o.at === last.at &&
            (o.reason.includes("Recorded effort") ||
              o.reason.includes("Session stopped") ||
              o.reason.includes("Athletic quality"))
          ),
      );
      if (w.pacing) {
        const index = w.pacing.plan.findIndex(
          (step) =>
            step.key === last.key &&
            ["work", "aerobic", "mobility"].includes(step.role) &&
            (step.attempt === w.sets.filter((x) => x.key === last.key).length ||
              step.role === "mobility"),
        );
        const redo = new Set(
          w.pacing.plan.slice(Math.max(0, index)).map((step) => step.id),
        );
        w.pacing.completed = w.pacing.completed.filter(
          (step) => !redo.has(step.id),
        );
        w.pacing.currentId = null;
        w.pacing.timer = null;
        w.pacing.workEndedAt = null;
      }
      s.restEnd = 0;
    }, "Most recent entry removed.");
  if (a === "rest-add")
    return transact(
      (s) => (s.restEnd = Math.max(Date.now(), s.restEnd) + 30000),
    );
  if (a === "rest-end") return transact((s) => (s.restEnd = 0));
  if (a === "export")
    return exportJSON(state, `oly-tracker-${localDate()}.json`);
  if (a === "export-archives")
    return exportJSON(
      state.archives,
      `oly-previous-programs-${localDate()}.json`,
    );
  if (a === "anchor")
    return formModal(
      "Record a demonstrated reference",
      "anchor",
      select(
        "Reference",
        "lift",
        {
          snatch: "SN · full snatch",
          cj: "CJ · full clean & jerk",
          clean: "CL · full clean single",
          jerk: "RJ · rack jerk single",
        },
        "snatch",
      ) +
        input(
          "Demonstrated valid load · lb",
          "load",
          "",
          "number",
          'min="1" max="2000" step="any" required',
        ) +
        input("Date of valid lift", "date", localDate(), "date", "required") +
        input(
          "Technical effort",
          "effort",
          "",
          "number",
          'min="1" max="10" step="0.5" required',
        ) +
        textarea(
          "Video / secure receiving and recovery evidence; use a lower secure anchor when needed",
          "evidence",
          "",
          "required",
        ) +
        check(
          "This is a demonstrated valid full lift/component single, not a power-clean or rep-equation estimate",
          "demonstrated",
        ),
      "Save reference",
    );
  if (a === "position")
    return formModal(
      "Reviewed starting position",
      "position",
      `<p>For established training or a long-interruption restart. Logs remain intact. Use the entry ramp again after a long interruption.</p><div class="input-grid">${input("Cycle", "cycle", state.training.cycle, "number", 'min="1" max="4" step="1" required')}${input("Cycle week", "week", state.training.week, "number", 'min="1" max="13" step="1" required')}${select("Entry tolerance dose", "entry", { 1: "Entry 1", 2: "Entry 2", 3: "Established base" }, state.training.entry)}${select("Demonstrated phase gate", "gate", { F: "Foundation", B: "Build · two secure normal weeks", R: "Realization · secure 80–85% singles" }, state.training.gate)}${input("First date of this training week (normally Monday)", "date", state.weekStart, "date", "required")}</div>${textarea("Training history and reason for this starting position", "reason", "", "required")}${check("Position and phase gate are supported by my actual training; no compression to meet dates", "confirmed")}`,
      "Set reviewed position",
    );
  if (a === "reduce-optional")
    return formModal(
      "Reverse an interfering addition",
      "reduce-optional",
      select(
        "Action",
        "kind",
        {
          athletics: "Suspend athletics",
          secondary: "Remove secondary athletics first",
          athletic_step: "Reverse one primary athletics step",
          cardio: "Suspend formal aerobics",
          cardio_step: "Reverse last aerobic increment",
          heavy_snatch: "Reverse one snatch heavy replacement",
          heavy_cj: "Reverse one CJ heavy replacement",
          rack: "Clear direct rack load increase",
        },
        "cardio",
      ) +
        textarea(
          "Observed cost and next-exposure review",
          "reason",
          "",
          "required",
        ),
      "Apply reduction",
    );
  if (a === "trial") {
    const t = state.training.trials.find((t) => t.id === id);
    return formModal(
      "Assistance / dose review",
      "trial",
      `<input type="hidden" name="id" value="${id}"><p>${esc(t.reason)} · ${trialExposures(state, t).length} comparable completed exposures.</p><p>2: tolerance. 4: early direction. 8: benefit and opportunity cost. Promising but unclear: one further 4-exposure review. Pain or clear interference ends the trial immediately.</p>${select("Decision", "decision", { continue: "Continue same dose", retain: "Retain useful dose", extend: "Specify another 4-exposure review", remove: "Remove / restore substituted base when ready", pause: "Pause, preserve continuity", resume: "Resume same trial after readiness review" }, t.paused ? "resume" : "continue")}${textarea("Target measures, next-session response, benefit/cost and rationale", "reason", "", "required")}${sourceLink(32)}`,
      "Save trial review",
    );
  }
}
function values(form) {
  const f = new FormData(form);
  return {
    get: (n) => f.get(n),
    has: (n) => f.has(n),
    all: (n) => f.getAll(n),
    num: (n) => (f.get(n) === "" ? null : Number(f.get(n))),
  };
}
function handleForm(form) {
  const f = values(form),
    type = form.dataset.form;
  if (type === "alarms") {
    timerAlerts.save({ enabled: f.has("enabled"), volume: f.num("volume") });
    refreshAlerts(true);
    render();
    toast("Alarm preferences saved on this device.");
    return;
  }
  if (["olympic-report", "correct-olympic"].includes(type)) {
    const data = {
      weight: f.num("weight"),
      reps: f.num("reps"),
      finish: f.get("finish"),
      fault: f.get("fault"),
    };
    transact(
      (s) => {
        if (type === "olympic-report")
          logOlympicSet(s, data, s.active.pacing?.workEndedAt ?? Date.now());
        else
          correctOlympicSet(
            s,
            f.get("record"),
            f.get("key"),
            f.num("setNumber"),
            data,
          );
      },
      type === "olympic-report"
        ? "Set saved with your completed rep count."
        : "Rep count corrected. The original entry is preserved.",
    );
    close();
    return;
  }
  if (type === "olympic-load") {
    transact(
      (s) => chooseOlympicLoad(s, form.dataset.key, f.num("weight")),
      "Working weight saved. Warm-up weights updated.",
    );
    return;
  }
  if (type === "set") {
    const e = nextRow(state.active),
      data = {};
    if (["quality", "failure"].includes(e.kind)) data.weight = f.num("weight");
    if (e.kind === "failure")
      Object.assign(data, {
        reps: f.num("reps"),
        endpoint: f.get("endpoint"),
        failed: f.has("failed"),
      });
    if (e.kind === "quality")
      Object.assign(data, {
        outcome: f.get("outcome"),
        grade: f.get("grade"),
        effort: f.num("effort"),
        fault: f.get("fault"),
        video: f.get("video"),
        preparation: f.has("preparation"),
        easy: f.has("easy"),
      });
    if (e.kind === "speed")
      Object.assign(data, {
        quality: f.get("quality"),
        seconds: f.num("seconds"),
        heights: f.get("heights")?.trim()
          ? f.get("heights").split(",").map(Number)
          : [],
      });
    if (e.kind === "aerobic") data.minutes = f.num("minutes");
    let savedSet;
    transact((s) => {
      savedSet = logSet(s, data, s.active.pacing?.workEndedAt ?? Date.now());
    });
    if (savedSet.reviewFlag) toast(savedSet.reviewFlag);
    document
      .querySelector(".pace-card, .focus-card")
      ?.scrollIntoView({ block: "start" });
    return;
  }
  transact((s) => {
    if (type === "schedule") {
      const schedule = f.get("schedule");
      if (s.active)
        throw Error("Finish the active session before changing the calendar.");
      if (!["source", "weekday"].includes(schedule))
        throw Error("Choose a training calendar.");
      if (schedule === s.training.schedule) delete s.training.nextSchedule;
      else if (
        weekRecords(s).length ||
        Object.keys(s.dates).length ||
        s.benchReservations.some((b) => b.weekId === s.weekId)
      )
        s.training.nextSchedule = schedule;
      else {
        setSchedule(s.training, schedule);
        s.athleticDay = null;
      }
    }
    if (type === "aerobic") finishAerobic(s, f.num("minutes"));
    if (type === "readiness") {
      s.readiness = {
        date: localDate(),
        level: f.get("level"),
        local: f.get("local"),
        event: f.get("event"),
        sport: f.get("sport"),
        noProtection: f.has("noProtection"),
        replaceAthletics: f.has("replaceAthletics"),
        rehearsal: f.has("rehearsal"),
        pivotResidual: f.has("pivotResidual"),
        notes: f.get("notes"),
      };
      s.events.push({
        ...s.readiness,
        at: Date.now(),
        type: "Readiness / event",
      });
      if (s.active) reassessActive(s);
    }
    if (type === "switch-workout") {
      stopSession(s, "Switched to another workout.");
      startSession(s, f.get("day"), f.get("id"), Date.now(), {
        fullPlan: f.get("fullPlan") === "true",
        repeat: f.get("repeat") === "true",
      });
    }
    if (type === "start-without")
      startSession(s, f.get("day"), f.get("id"), Date.now(), {
        deferBench: true,
      });
    if (type === "defer") {
      deferDay(s, f.get("day"), f.get("date"), {
        rollLater: f.has("rollLater"),
      });
      s.events.push({
        at: Date.now(),
        type: "Workout date changed",
        rollLater: f.has("rollLater"),
        day: f.get("day"),
        date: f.get("date"),
        notes: f.get("reason"),
      });
    }
    if (type === "omit-session")
      omissionRecord(s, f.get("day"), f.get("id"), f.get("reason"));
    if (type === "rescue") {
      const slot = f.get("slot");
      startSession(
        s,
        slot === "bench_low" ? "tuesday" : "friday",
        "rescue",
        Date.now(),
        { rescue: slot },
      );
      s.benchReservations.push({
        weekId: s.weekId,
        slot,
        sessionId: s.active.id,
      });
    }
    if (type === "omit-row") omitRow(s, f.get("key"), f.get("reason"));
    if (type === "end-early") stopSession(s, f.get("reason"));
    if (type === "finish") finishSession(s, f.get("notes"));
    if (type === "easy-return") {
      if (!f.has("secure"))
        throw Error("End the session if easy singles are not secure.");
      easyReturn(s);
    }
    if (type === "review")
      advanceWeek(s, {
        action: f.get("action"),
        recovery: f.get("recovery"),
        green: f.has("green"),
        buildReady: f.has("buildReady"),
        scheduleQuality: f.has("scheduleQuality"),
        realizationReady: f.has("realizationReady"),
        restored: f.has("restored"),
        notes: f.get("notes"),
      });
    if (type === "timing") {
      const timing = {
        traffic: f.get("traffic"),
        breakMinutes: f.num("breakMinutes"),
        plateSeconds: f.num("plateSeconds"),
        stationSeconds: f.num("stationSeconds"),
        extraRestSeconds: f.num("extraRestSeconds"),
        athleticsVisit: f.get("athleticsVisit"),
        unilateralCable: f.has("unilateralCable"),
      };
      if (!validTimeProfile(timing))
        throw Error("Choose valid time planning allowances.");
      if (s.active && !s.active.timeConfig)
        s.active.timeConfig = {
          timing: timeProfile(s.training),
          equipment: copy(s.training.equipment),
          anchors: copy(s.active.anchors),
          increment: s.active.increment,
          continuation: false,
        };
      s.training.timing = timing;
    }
    if (type === "equipment") {
      if (s.active)
        throw Error("Finish the active session before changing setup.");
      s.training.split = f.get("split") === "split";
      s.training.increment = f.num("increment");
      for (const k of [
        "incline",
        "lateral",
        "row",
        "shrug",
        "leg_curl",
        "calf",
        "leg_ext",
        "crunch",
        "triceps",
      ]) {
        const v = f.get(k) === "default" ? "" : f.get(k);
        if ((s.training.equipment[k] || "") !== v)
          s.training.setup[k] = (s.training.setup[k] || 0) + 1;
        s.training.equipment[k] = v;
      }
    }
    if (type === "technique") {
      if (s.active)
        throw Error("Finish the active session before changing technique.");
      for (const k of ["snatch", "clean", "jerk"])
        s.training.technique[k] = f.get(k);
      for (const k of [
        "reduceA",
        "reduceJerk",
        "lowerDose",
        "omitLastLower",
        "omitPull",
      ])
        s.training[k] = f.has(k);
      s.reviews.push({
        at: Date.now(),
        type: "Technique / interference",
        notes: f.get("reason"),
        training: copy(s.training),
      });
    }
    if (type === "mobility") {
      if (f.all("mobility").length > 2)
        throw Error("Choose at most two restrictions.");
      if (
        f.num("seconds") > s.training.mobilitySeconds &&
        f.num("days") > s.training.mobilityDays
      )
        throw Error(
          "Increase duration OR add a fourth day, one change at a time.",
        );
      if (
        (f.num("seconds") > s.training.mobilitySeconds ||
          f.num("days") > s.training.mobilityDays) &&
        !f.has("observed")
      )
        throw Error(
          "Confirm two weeks without position improvement before increasing mobility.",
        );
      s.training.mobility = f.all("mobility");
      s.training.mobilitySeconds = f.num("seconds");
      s.training.mobilityDays = f.num("days");
    }
    if (type === "anchor") {
      if (!f.has("demonstrated")) throw Error("Use a demonstrated lift only.");
      if (s.active)
        throw Error("Finish the active session before changing its reference.");
      const previousLoad = s.training.anchors[f.get("lift")];
      s.training.anchors[f.get("lift")] = f.num("load");
      if (f.get("lift") === "jerk") s.training.rackLoad = null;
      s.reviews.push({
        at: Date.now(),
        type: "Demonstrated reference",
        lift: f.get("lift"),
        load: f.num("load"),
        previousLoad,
        date: f.get("date"),
        effort: f.num("effort"),
        notes: f.get("evidence"),
      });
    }
    if (type === "optional-change")
      applyGuidedChange(s, {
        kind: f.get("kind"),
        confirmed: f.has("confirmed"),
        fullCycle: f.has("fullCycle"),
        reason: f.get("reason"),
      });
    if (type === "change")
      applyChange(s, {
        kind: f.get("kind"),
        exercise: f.get("exercise"),
        day: f.get("day"),
        reason: f.get("reason"),
        load: f.num("load"),
        baselineLoad: f.num("baselineLoad"),
        ready: f.has("ready"),
        stable: f.has("stable"),
        adapted: f.has("adapted"),
        fourPrimary: f.has("fourPrimary"),
        fullCycle: f.has("fullCycle"),
      });
    if (type === "trial")
      reviewTrial(s, f.get("id"), f.get("decision"), f.get("reason"));
    if (type === "followup") {
      const r = s.records.find((r) => r.id === form.dataset.id);
      r.followup = {
        normal: f.has("normal") && f.get("positions") === "normal",
        positions: f.get("positions"),
        loadDrop: f.has("loadDrop"),
        notes: f.get("notes"),
        at: Date.now(),
      };
    }
    if (type === "position") {
      if (s.active) throw Error("Finish the active session first.");
      if (!f.has("confirmed")) throw Error("Confirm the reviewed position.");
      s.reviews.push({
        at: Date.now(),
        type: "Starting position",
        notes: f.get("reason"),
        previous: copy(s.training),
      });
      Object.assign(s.training, {
        cycle: f.num("cycle"),
        week: f.num("week"),
        entry: f.num("entry"),
        gate: f.get("gate"),
        recovery: "normal",
        assessment: "none",
      });
      s.weekStart = f.get("date");
      s.dates = {};
      s.weekId = uid();
      s.completed = false;
      if ([12, 13].includes(s.training.week) || s.training.entry < 3)
        s.training.trials.forEach((t) => (t.paused = true));
    }
    if (type === "reduce-optional") {
      const k = f.get("kind"),
        t = s.training;
      if (s.active) throw Error("Finish the active session first.");
      if (k === "athletics_undo") {
        const last = s.reviews.findLast(
          (r) =>
            r.afterAthletics &&
            JSON.stringify(r.afterAthletics) === JSON.stringify(t.athletics),
        );
        if (!last?.beforeAthletics)
          throw Error(
            "The previous athletic dose is unavailable. Choose a specific reduction.",
          );
        t.athletics = copy(last.beforeAthletics);
      }
      if (k === "athletics") t.athletics.enabled = false;
      if (k === "secondary") t.athletics.secondary = 0;
      if (k === "athletic_step")
        t.athletics.stage = Math.max(0, t.athletics.stage - 1);
      if (k === "cardio") t.cardio.enabled = false;
      if (k === "cardio_step")
        t.cardio.minutes = Math.max(
          40,
          t.cardio.minutes - (t.cardio.minutes <= 60 ? 5 : 10),
        );
      if (k === "rack") t.rackLoad = null;
      if (k.startsWith("heavy_")) {
        const id = k.slice(6),
          extra = id === "snatch" ? "extraSnatch" : "extraCj";
        if (t.heavy[extra]) t.heavy[extra]--;
        else t.heavy[id] = t.heavy[id] > 92 ? 92 : t.heavy[id] > 88 ? 88 : 0;
      }
      t.workloadChangedAt = Date.now();
      s.reviews.push({
        at: Date.now(),
        type: "Reverse interfering addition",
        notes: f.get("reason"),
        kind: k,
      });
    }
  }, "Saved on this device.");
  close();
  if (type === "optional-change") {
    selected = f.get("kind").startsWith("cardio")
      ? programDays(state.training).find((day) =>
          dayPlan(state.training, day).sessions.some(
            (se) => se.kind === "cardio",
          ),
        ) || selected
      : secondaryKind(f.get("kind"))
        ? secondaryAthleticSlot(state.training)
        : primaryAthleticSlot(state.training);
    nav("week");
    toast(
      "Added to your week. The workout, preparation and timers are on its day tab.",
    );
  }
  if (["start-without", "rescue", "switch-workout"].includes(type))
    nav("workout");
  else if (["finish", "end-early"].includes(type)) {
    wakeLock?.release();
    nav("history");
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  refreshAlerts(true);
  if (b.dataset.nav) return nav(b.dataset.nav);
  if (b.dataset.action)
    Promise.resolve(action(b)).catch((e) => toast(e.message));
});
document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  refreshAlerts(true);
  try {
    handleForm(form);
  } catch (err) {
    const box = form.querySelector(".form-error");
    if (box) {
      box.textContent = err.message;
      box.scrollIntoView({ block: "nearest" });
    } else toast(err.message);
  }
});
document.addEventListener("change", async (e) => {
  if (
    e.target.name === "setNumber" &&
    e.target.form?.dataset.form === "correct-olympic"
  ) {
    const form = e.target.form,
      r = state.records.find((r) => r.id === form.elements.record.value),
      row = r.session.rows.find((row) => row.key === form.elements.key.value),
      group = failureSets(r.sets.filter((x) => x.key === row.key))[
        Number(e.target.value) - 1
      ];
    form.querySelector(".correction-fields").innerHTML = olympicReportFields(
      row,
      validReps(group),
      group[0].weight,
      reportedFinish(group.at(-1)),
      group.at(-1).fault || "",
    );
  }
  if (e.target.name === "guide-page") {
    guidePage = Number(e.target.value);
    render();
  }
  if (e.target.id === "import" && e.target.files[0]) {
    try {
      const file = e.target.files[0];
      if (file.size > 30 * 1024 * 1024)
        throw Error("Backup is too large (maximum 30 MB).");
      const imported = importData(JSON.parse(await file.text()));
      modal(
        "Restore this backup",
        `<p>Validated: ${imported.records.length} sessions, cycle ${imported.training.cycle}, week ${imported.training.week}. The current journal will be archived inside the restored state.</p>${btn("Restore validated backup", "confirm-import", "", "primary button")}`,
      );
      const button = $("dialog").querySelector(
        '[data-action="confirm-import"]',
      );
      button.addEventListener(
        "click",
        () => {
          try {
            if (state) imported.archives.push(copy(state));
            const stored = localStorage.getItem(KEY);
            let version = state?.version || 0;
            try {
              version = JSON.parse(stored)?.version || version;
            } catch {}
            imported.version = version;
            state = saveStore(localStorage, imported, version);
            storageError = "";
            close();
            nav(state.active ? "workout" : "history");
            toast("Backup restored.");
          } catch (e) {
            toast(e.message);
          }
        },
        { once: true },
      );
    } catch (err) {
      toast(err.message);
    }
  }
});
document.addEventListener("input", (e) => {
  if (e.target.name === "guide-search" && pages) {
    const q = e.target.value.trim().toLowerCase();
    $("search-results").innerHTML = q
      ? pages
          .filter((p) => p.text.toLowerCase().includes(q))
          .map((p) =>
            btn(
              `Page ${p.page} · ${guideTitles[p.page - 1] || "References"}`,
              "source",
              `data-page="${p.page}"`,
              "quiet",
            ),
          )
          .join("") || "<p>No matches.</p>"
      : "";
  }
});
function refreshAlerts(gesture = false, resuming = false) {
  timerAlerts.sync(currentAlarm(state), { gesture, resuming });
  pushAlerts.sync(timerAlerts.target);
  for (const node of document.querySelectorAll("[data-push-state]"))
    node.textContent = pushAlerts.status;
  const target = timerAlerts.target,
    box = $("alarm-status"),
    blocked = ["blocked", "interrupted"].includes(timerAlerts.status),
    due = target && target.deadline <= Date.now();
  box.hidden = !target || !(blocked || due || timerAlerts.testTarget);
  $("alarm-message").textContent = blocked
    ? "Alarm audio needs a tap to resume. Keep the app open until sound is working."
    : due
      ? `${target.label} · timer finished. Record the actual work; the alarm does not complete a set.`
      : `${timerAlerts.testTarget ? "Test alarm in 10 seconds. " : ""}${pushAlerts.status}`;
  box.querySelector('[data-action="alarm-resume"]').hidden = !blocked;
  box.querySelector('[data-action="alarm-dismiss"]').textContent = due
    ? "Silence alarm"
    : "Cancel alarm";
  for (const node of document.querySelectorAll("[data-alarm-state]"))
    node.textContent = !timerAlerts.preferences.enabled
      ? "Alarm sound is off on this device."
      : blocked
        ? "Sound needs a tap: use Resume alarm audio."
        : target && timerAlerts.status === "playing"
          ? "Alarm is sounding. Tap Silence alarm to stop it."
          : `Alarm sound is on. ${target ? "Countdown armed; sound starts at zero. " : ""}${pushAlerts.status}`;
}
function tick() {
  if (!state) return;
  refreshAlerts();
  if (state.active?.pacing && $("pace-clock")) {
    const w = state.active,
      p = w.pacing,
      display = paceDisplay(w);
    $("pace-clock").textContent = countdownText(display.seconds);
    $("pace-label").textContent = display.label;
    $("pace-budget").textContent = countdownText(display.info.budgetRemaining);
    $("pace-forecast").textContent =
      `${time(display.info.remaining)} of planned steps left · projected finish ${new Date(display.info.finishAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    if ($("pace-next"))
      $("pace-next").disabled =
        paceElapsed(p.timer) < paceMinimum(w, display.info.stage);
  }
  const prep = state.active?.preparationTimer;
  const aerobic = state.active?.aerobicRun;
  if (aerobic && $("aerobic-clock")) {
    const moving = preparationElapsed(aerobic),
      target = nextRow(state.active).minutes * 60;
    $("aerobic-clock").textContent = countdownText(target - moving);
    $("aerobic-target").textContent =
      moving >= target
        ? "Target reached. Stop and confirm actual moving minutes."
        : `${time(target - moving)} to the planned target.`;
  }
  if (prep && $("preparation-clock"))
    $("preparation-clock").textContent = countdownText(
      Number($("preparation-clock").dataset.target) - preparationElapsed(prep),
    );
  const run = state.active?.mobilityRun,
    row = state.active && nextRow(state.active);
  if (run && row?.kind === "mobility" && $("mobility-clock")) {
    const remaining = Math.ceil(
      mobilitySteps(row)[run.index].seconds -
        (Date.now() - run.stepStartedAt) / 1000,
    );
    $("mobility-clock").textContent = time(remaining);
    $("mobility-next").disabled = remaining > 0;
  }
  const remaining = Math.ceil((state.restEnd - Date.now()) / 1000);
  const w = state.active,
    paced = w?.pacing && (paceStage(w) || w.pacing.breakRun);
  const buttons = $("timer").querySelectorAll("button");
  $("timer").hidden = paced ? false : !(remaining > 0);
  $("timer").setAttribute(
    "aria-label",
    paced ? "Session countdown" : "Rest timer",
  );
  $("timer").querySelector("small").textContent = paced
    ? paceDisplay(w).label
    : "REST · TAKE LONGER IF NEEDED";
  $("timer-count").textContent = paced
    ? countdownText(paceDisplay(w).seconds)
    : time(remaining);
  buttons[0].dataset.action = paced ? "pace-add" : "rest-add";
  buttons[0].textContent = paced ? "+1 min" : "+30 s";
  buttons[0].hidden = !!(
    paced &&
    (w.pacing.workEndedAt ||
      w.pacing.breakRun ||
      paceStage(w)?.role === "mobility")
  );
  const skippableRest =
    paced &&
    !w.pacing.breakRun &&
    !w.pacing.workEndedAt &&
    ["ramp-rest", "rest", "recovery"].includes(paceStage(w)?.role);
  buttons[1].dataset.action = skippableRest
    ? "pace-skip"
    : paced
      ? "pace-show"
      : "rest-end";
  buttons[1].textContent = skippableRest
    ? "Skip rest"
    : paced
      ? "Timer"
      : "Done";
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshAlerts(false, true);
    if (state?.active && (!wakeLock || wakeLock.released))
      navigator.wakeLock
        ?.request("screen")
        .then((lock) => {
          wakeLock = lock;
        })
        .catch(() => {});
    tick();
  }
});
window.addEventListener("pageshow", () => refreshAlerts(false, true));
window.addEventListener("storage", (e) => {
  if (e.key === KEY)
    toast(
      "This journal changed in another tab. Reload before editing to avoid overwriting it.",
    );
});
$("app-build").textContent = `APP ${APP_BUILD} · COMPLETE SESSION TIMING`;
if ("serviceWorker" in navigator) {
  let updateRegistration,
    reloadForUpdate = false,
    lastUpdateCheck = 0,
    hadController = !!navigator.serviceWorker.controller;
  const announceUpdate = () => {
    if (updateRegistration?.waiting && navigator.serviceWorker.controller)
      $("app-update").hidden = false;
  };
  $("apply-update").addEventListener("click", () => {
    const saved = loadStore(localStorage);
    if (state?.active || saved.state?.active) {
      toast("Finish the active workout before loading the app update.");
      return;
    }
    if (!saved.state) {
      toast(
        "The saved journal needs attention before updating. Export or recover it in Settings.",
      );
      return;
    }
    if (updateRegistration?.waiting) {
      reloadForUpdate = true;
      updateRegistration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
    } else location.reload();
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadForUpdate) location.reload();
    else if (hadController) $("app-update").hidden = false;
    hadController = true;
  });
  const checkUpdate = async (explicit = false) => {
    if (!updateRegistration) return;
    if (!explicit && Date.now() - lastUpdateCheck < 60000) return;
    lastUpdateCheck = Date.now();
    try {
      await updateRegistration.update();
      announceUpdate();
      if (explicit)
        toast(
          updateRegistration.waiting || updateRegistration.installing
            ? "Downloading or preparing an app update. Use the update banner when it is ready."
            : `App ${APP_BUILD} is current. Saved workouts and settings are unchanged.`,
        );
    } catch {
      if (explicit)
        toast(
          "Cannot reach the app server. Your saved offline version remains available; check again when connected.",
        );
    }
  };
  $("check-update").addEventListener("click", () => checkUpdate(true));
  window.addEventListener("online", () => checkUpdate());
  window.addEventListener("focus", () => checkUpdate());
  navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((registration) => {
      updateRegistration = registration;
      announceUpdate();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") announceUpdate();
        });
      });
      if (registration.installing)
        registration.installing.addEventListener("statechange", announceUpdate);
      checkUpdate();
    })
    .catch(() =>
      toast(
        "Offline installation is unavailable; the online journal still works.",
      ),
    );
} else $("check-update").hidden = true;
plannerIntegration = installPlannerIntegration({
  getState: () => state,
  applyState: (next) => {
    state = saveStore(localStorage, next, state.version);
    storageError = "";
    if (state.active && view !== "settings") view = "workout";
    render();
  },
  changedView: () => {
    const latest = loadStore(localStorage);
    if (latest.state && latest.state.version !== state?.version) {
      state = latest.state;
      render();
    }
  },
  message: toast,
});
render();
