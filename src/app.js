import { installPlannerIntegration } from "./planner-integration.js";
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
const APP_BUILD = "7.14";
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
if (state)
  selected =
    DAYS.find(
      (d) =>
        dayPlan(state.training, d).sessions.some((s) => s.id === "main") &&
        !weekRecords(state).some((r) => r.day === d && r.session.id === "main"),
    ) || "monday";
const btn = (text, action, extra = "", cls = "button") =>
  `<button class="${cls}" data-action="${action}" ${extra}>${esc(text)}</button>`;
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
  lastFocus = document.activeElement;
  $("dialog").innerHTML =
    `<div class="dialog-head"><h2 id="dialog-title">${esc(heading)}</h2>${btn("Close", "close", "", "quiet")}</div>${body}`;
  $("dialog").showModal();
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
      unchecked: "Check in before training",
    };
  return `<section class="readiness-strip"><div><span class="status-dot ${r.level}"></span><strong>${labels[r.level]}</strong><p>${r.level === "unchecked" ? "Use today’s positions, coordination and familiar warm-ups." : `${r.local ? "Local " + r.local + " issue · " : ""}${r.event.replaceAll("_", " ")}${sportEvent(r) !== "normal" ? " · " + sportEvent(r).replaceAll("_", " ") : ""} · ${dateLabel(r.date)}`}</p></div>${btn(r.level === "unchecked" ? "Check readiness" : "Update readiness", "readiness", "", "button")}</section>`;
}
function weekView() {
  const t = state.training,
    phase = phaseFor(t),
    p = planFor(state, selected, scheduledDate(state, selected) <= localDate()),
    year = (t.cycle - 1) * 13 + t.week,
    timing = estimateDay(p, t);
  const plans = DAYS.map((d) => dayPlan(t, d)),
    failureSets = plans
      .flatMap((p) => p.sessions)
      .flatMap((s) => s.rows)
      .filter((e) => e.kind === "failure")
      .reduce((n, e) => n + e.sets, 0);
  return (
    title(
      `THE TRAINING JOURNAL / WEEK ${year} OF 52`,
      state.completed
        ? "A year of work."
        : "Build the lifts. Keep the quality.",
      `Cycle ${t.cycle} · Week ${t.week}/13 · ${PHASE_NAMES[phase.phase]}${t.entry < 3 ? " · Entry dose " + t.entry : ""}`,
    ) +
    (storageError ? notice(storageError, "warning") : "") +
    (state.completed
      ? notice(
          "The prescribed 52 weeks are complete. Your logs, reviews and source remain available.",
        )
      : "") +
    (state.active
      ? `<div class="resume-banner"><span>Session in progress · ${esc(state.active.session.title)}</span>${btn("Resume workout", "resume", "", "primary button")}</div>`
      : "") +
    `<div class="overview"><article><small>PRIORITY</small><strong>01 <span>Weightlifting</span></strong><p>Then hypertrophy, athleticism, longevity.</p></article><article><small>PLANNED THIS WEEK</small><strong>${failureSets} <span>failure sets</span></strong><p>Separate from quality-limited Olympic work.</p></article><article><small>BENCH CONTINUITY</small><strong>${["bench_low", "bench_moderate"].filter((k) => consumedBench(state, k)).length}<span> / 2 exposures</span></strong><p>Low 3–5 · moderate 6–8 · ≥48 actual hours.</p></article></div>` +
    readinessCard() +
    `<section class="week-section"><div class="section-label"><h2>The week ahead</h2><span>Phase first. Readiness second.</span></div><div class="week-days">${DAYS.map((d) => `<button data-action="day" data-day="${d}" class="day ${selected === d ? "selected" : ""}" aria-pressed="${selected === d}"><small>${calendarWeekday(d, true)}</small><strong>${{ monday: "A", tuesday: "B", thursday: "C", friday: "D" }[d] || "—"}</strong><span>${dateLabel(scheduledDate(state, d))}</span>${resolved(d, "main") ? '<i aria-label="Resolved">✓</i>' : ""}</button>`).join("")}</div></section>` +
    `<section class="day-content"><div class="section-label"><div><div class="eyebrow">${calendarWeekday(selected)} / ${dateLabel(scheduledDate(state, selected))}</div><h2>${selected === "wednesday" || selected === "sunday" ? "Recovery & readiness" : PHASE_NAMES[p.phase]}</h2></div>${btn("Move this day", "defer", `data-day="${selected}"`, "quiet")}</div>${p.notes.map((s) => notice(s)).join("")}${dayTime(timing)}${p.sessions.map((s, i) => preview(s, p, timing.sessions[i])).join("")}${!p.sessions.length ? '<div class="empty-card"><span>↘</span><h3>Space to recover.</h3><p>Off or targeted mobility. Optional easy walking; no missed-volume debt.</p></div>' : ""}${mobilityCard(p, timing)}</section>` +
    `<div class="week-actions">${btn("Weekly review", "review", "", "primary button")}${btn("Rescue a bench slot", "rescue")}${t.athletics.enabled ? btn(`Relocate athletics to C · ${calendarWeekday("thursday")}`, "relocate", "", "quiet") : ""}</div>` +
    `${monitoring(state)
      .map((s) => notice(s, "warning"))
      .join(
        "",
      )}<p class="fine-print">Day letters stay with the session when dates move; tabs show the actual weekday. To rotate the whole week, select the unresolved A slot and use Move this day. The next week continues from the shifted rhythm. A–B–rest–C–D–rest–rest; no more than two consecutive Olympic days in the normal sequence. ${sourceLink(23)}</p>`
  );
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
  return `<details class="timing-details"><summary>How this time is planned</summary><p>${t.rows.length && t.rows.every((r) => r.station === "mobility") ? "Includes both sides, setup, between-hold rests and five slow active reps." : `Fixed time targets, including ${esc(t.profile.traffic)} gym traffic. Rests follow this prescription; allow more whenever readiness needs it. Exercise allowances include preparation and transitions.`}</p>${timeParts(t.overhead, { arrival: "Arrival, belongings & equipment check", general: "General / field warm-up", transition: "Transition to athletics", breaks: "Water, restroom & miscellaneous breaks", departure: "Final log, unloading & packing up" })}${t.rows.map((r) => `<details class="exercise-timing"><summary>${esc(r.name)} · ${minutesText(r.seconds)}</summary>${timeParts(r.parts, r.station === "mobility" ? { ...TIME_LABELS, setup: "Drill setup & side changes", rest: "Rest between holds", work: "Holds & five active reps" } : TIME_LABELS)}</details>`).join("")}<p class="fine-print">Loading, station changes, waiting and logging use recovery time where possible; only the extra time is added. Warm-up rests include plate changes. Rep speed is a planning assumption. Adjust setup, traffic and break allowances in Settings; these are not program doses. The displayed targets and countdown steps use the same seconds. Long interruptions, travel to/from training and optional unscheduled walks are outside this estimate. After more than 15 minutes idle, allow the prescribed re-warm-up. No additional cooldown is prescribed.</p></details>`;
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
function mobilityPreview(s, p, timing) {
  const done = resolved(p.day, s.id);
  return `<article class="session-card mobility-card"><div class="session-head"><div><span class="pill">TARGETED MOBILITY</span><h3>${esc(s.title)}</h3></div><div class="duration">${s.skipped ? "—" : minutesText(timing.seconds)}<small>included in day total</small></div></div><p>${esc(s.note)}</p>${s.skipped ? notice(s.reason) : ""}${s.rows.map((e) => `<div class="mobility-row">${!s.skipped ? `<strong>${minutesText(timing.rows.find((r) => r.key === e.key).seconds)} per restriction</strong>` : ""}<p>${esc(e.note)}</p></div>`).join("")}<p class="fine-print">Includes holds on both sides, 15-second rests, five slow active reps, setup and side changes.</p><div class="session-bottom">${!done && !s.skipped ? btn("Start session →", "start", `data-day="${p.day}" data-id="${s.id}" ${state.active ? "disabled" : ""}`, "primary button") : ""}${!done ? btn("Omit", "omit-session", `data-day="${p.day}" data-id="${s.id}"`, "quiet") : btn("View log", "record", `data-id="${done.id}"`, "quiet")}</div>${!s.skipped ? timingDetails(timing) : ""}${sourceLink(22)}</article>`;
}
function preview(s, p, timing) {
  if (s.kind === "mobility") return mobilityPreview(s, p, timing);
  const done = resolved(p.day, s.id),
    summary = s.rows.reduce(
      (n, e) => n + (e.kind === "failure" ? e.sets : 0),
      0,
    );
  return `<article class="session-card"><div class="session-head"><div><span class="pill">${esc(done ? done.status : s.kind === "lifting" ? "PRIORITY SESSION" : s.kind === "athletic" ? "QUALITY / OPTIONAL" : "EASY / OPTIONAL")}</span><h3>${esc(s.title)}</h3></div><div class="duration">${s.skipped ? "—" : minutesText(timing.seconds)}<small>planned total</small></div></div>${s.note ? `<p class="muted">${esc(s.note)}</p>` : ""}${s.skipped ? notice(s.reason) : ""}<div class="exercise-table">${s.rows.map((e, i) => `<div><span class="row-index">${String(i + 1).padStart(2, "0")}</span><span>${esc(e.name)}</span><strong>${esc(describe(e))}${!s.skipped ? `<small class="exercise-duration">${minutesText(timing.rows[i].seconds)} including prep & rest</small>` : ""}</strong></div>`).join("")}</div><div class="session-bottom"><span>${summary ? `${summary} conventional work sets · strict-form failure` : s.kind === "cardio" ? "Count actual moving minutes. Full-sentence talk test." : "Short sets. Secure positions. No failure."}</span><div>${!done && !s.skipped ? btn("Start session →", "start", `data-day="${p.day}" data-id="${s.id}" ${state.active ? "disabled" : ""}`, "button primary") : ""}${!done ? btn("Omit", "omit-session", `data-day="${p.day}" data-id="${s.id}"`, "quiet") : btn("View log", "record", `data-id="${done.id}"`, "quiet")}</div></div><details><summary>Warm-up & execution</summary><p>${esc(s.warmup)}</p>${s.rows.map((e) => `<p><b>${esc(e.name)}</b><br>${esc(e.note)} ${sourceLink(e.page || 7)}<br><span class="muted">${esc(e.warmup || "")} Rest ${time(e.rest || 0)}.</span></p>`).join("")}</details>${!s.skipped ? timingDetails(timing) : ""}</article>`;
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
          ? "Confirm general preparation"
          : stage.role === "prepare-check"
            ? "Confirm exercise preparation"
            : stage.role === "mobility" && stage.step === 7
              ? "Active reps complete · save timed drill"
              : "Continue timer",
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
    if (["ramp", "waiting", "break-pool"].includes(stage.role))
      controls += btn(
        stage.role === "ramp"
          ? "Ramp not needed at this load"
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
  return `<section class="pace-card" aria-label="Guided session countdown"><div class="eyebrow">GUIDED COUNTDOWN${stage?.exercise ? ` / ${esc(stage.exercise)}` : ""}</div><h2 id="pace-label">${esc(display.label)}</h2><div class="pace-clock"><strong id="pace-clock" role="timer">${countdownText(display.seconds)}</strong>${p.timer?.pausedAt !== null && p.timer && !p.workEndedAt ? "<span>Paused</span>" : ""}</div><p id="pace-forecast">${time(display.info.remaining)} of planned steps left · projected finish ${new Date(display.info.finishAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p><p class="fine-print">Session target <span id="pace-budget">${countdownText(display.info.budgetRemaining)}</span> remaining. ${time(Math.max(0, (p.plan.find((s) => s.role === "break-pool")?.seconds || 0) - p.breakUsed))} of miscellaneous allowance unused. Pausing a step does not hide elapsed session time.</p><div class="pace-actions">${controls}${btn(p.sound ? "Timer sound on" : "Enable timer sound", "pace-sound", "", "quiet")}</div><p class="fine-print">Zero is a cue, not a completed set. Finish at the prescribed reps, quality limit or strict-form failure; record the real outcome. Take longer recovery when needed. Loading and logging share rest time. Confirm each preparation step; skip only unnecessary ramps or unused waiting/break time.</p><details><summary>Remaining countdown steps</summary><ol class="pace-plan">${p.plan
    .filter((step) => !p.completed.some((x) => x.id === step.id))
    .map(
      (step) =>
        `<li>${esc(step.exercise ? step.exercise + " · " : "")}${esc(step.label)} <strong>${time(paceSeconds(w, step))}</strong></li>`,
    )
    .join("")}</ol></details></section>`;
}
function workoutView() {
  const w = state.active;
  if (!w)
    return (
      title(
        "TRAIN WITH INTENT",
        "Ready when you are.",
        "Choose the next session and check today’s readiness.",
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
    `<div class="progress-line"><span style="width:${(done / w.session.rows.length) * 100}%"></span></div><p class="muted">${done} of ${w.session.rows.length} ${w.session.kind === "mobility" ? "mobility drills" : "exercises"} resolved. ${w.session.kind === "mobility" ? "Complete the scheduled holds, rests and active reps, or record an early stop." : "Log actual outcomes, including misses and safety stops."}</p><p class="session-budget">Starting session budget: <strong>${minutesText(originalTiming.seconds)}</strong> · includes prep, rest and breaks; fixed targets.</p>${pacingCard(w)}${timingDetails(originalTiming)}`;
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
    if (e.kind === "failure" && status.logs.at(-1)?.reps < e.repRange[0])
      proposed = status.logs.at(-1).weight * 0.925;
    if (proposed)
      proposed = Math.floor((proposed + 1e-8) / w.increment) * w.increment;
    const prepared = w.preparations.includes(e.key);
    body += `<section class="focus-card"><div class="focus-meta"><span class="pill">${e.kind === "failure" ? "STRICT-FORM FAILURE" : e.kind === "quality" ? "OLYMPIC QUALITY" : e.kind === "speed" ? "ATHLETIC QUALITY" : "EASY AEROBICS"}</span><span>${status.count} / ${status.planned} ${e.kind === "quality" ? "attempts" : "sets"}</span></div><h2>${esc(e.name)}</h2><p class="prescription">${esc(describe(e))}</p><p class="exercise-duration">Full exercise allowance: ${minutesText(currentTiming.rows.find((r) => r.key === e.key).seconds)} including prep & rest.</p>${
      range
        ? `<div class="suggested-load"><strong>${range
            .map(fmt)
            .filter((v, i, a) => i === 0 || v !== a[0])
            .join(
              "–",
            )}<small> lb</small></strong><span>Rounded down · secure positions and effort cap govern.</span></div>`
        : ""
    }${status.reason ? notice(status.reason, "warning") : ""}<p>${esc(e.note)} ${sourceLink(e.page || 7)}</p>${suggestion ? notice(suggestion.text) : ""}<details ${prepared ? "" : "open"}><summary>Prepare this exercise · rest ${time(e.rest || 0)}</summary><p>${esc(e.warmup || "Full preparation and smooth rehearsals first.")}</p><p>All retained conventional work sets use strict-form failure. A rep-window error is logged honestly; no extra failure test to fix it.</p>${
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
      body += `<form data-form="set"><div class="input-grid">`;
      if (["quality", "failure"].includes(e.kind))
        body += input(
          "Actual load · lb",
          "weight",
          proposed,
          "number",
          'min="0.1" max="2000" step="any" inputmode="decimal" required',
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
            "Endpoint",
            "endpoint",
            {
              failure: "Strict-form failure · 0 RIR",
              tech: "TECH · position ended set",
              pain: "Pain · stop session",
              stop: "Other unsafe symptoms · stop",
            },
            "failure",
          ) +
          check("An unsuccessful concentric attempt occurred", "failed");
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
              A: "A · secure, repeatable",
              B: "B · acceptable, small correction",
              C: "C · material fault",
            },
            "A",
          ) +
          input(
            "Technical effort · 1–10, not RIR",
            "effort",
            Math.min(e.effort, 7),
            "number",
            'min="1" max="10" step="0.5" required',
          ) +
          input(
            "Recurring fault / one cue",
            "fault",
            "",
            "text",
            'placeholder="e.g. forward dip"',
          ) +
          check(
            "This was an actual preparation attempt above 90% SN/CJ; it counts in this attempt budget",
            "preparation",
          ) +
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
    body += `<div class="focus-actions">${btn("Omit this exercise", "omit-row", `data-key="${e.key}"`, "quiet")}${e.test && !e.benchmark ? btn("Use ≤85% benchmark", "benchmark", "", "quiet") : ""}${e.kind === "quality" ? btn("Reduced work still poor", "easy-return", "", "quiet") : ""}</div></section>`;
  } else
    body += `<section class="empty-card"><span>✓</span><h2>Work accounted for.</h2><p>${w.session.kind === "mobility" ? "Save the completed holds, rests, active reps and position recheck." : "Save the session, then check the response at your next priority workout."}</p>${btn("Finish session", "finish", "", "primary button")}</section>`;
  body += `${preparationLog(w)}${partialMobilityLog(w)}${partialAerobicLog(w)}<section class="session-ledger"><h2>Session log</h2>${w.session.rows
    .map((e) => {
      const r = rowStatus(w, e);
      return `<details ${r.logs.length ? "open" : ""}><summary>${esc(e.name)} <span>${r.count}/${r.planned}${r.done ? " · resolved" : ""}</span></summary>${r.logs.length ? `<ol>${r.logs.map((x) => `<li>${setText(x)}${x.overCap ? " · outside prescription" : ""}</li>`).join("")}</ol>` : '<p class="muted">No sets logged.</p>'}${r.reason ? `<p>${esc(r.reason)}</p>` : ""}</details>`;
    })
    .join(
      "",
    )}${w.sets.length ? btn("Undo most recent entry", "undo", "", "quiet") : ""}</section><div class="week-actions">${btn("End session early", "end-early", "", "quiet")}</div>`;
  return body;
}
function setText(x) {
  if (x.exerciseId === "aerobic")
    return `${fmt(x.minutes)} min moving · ${x.shortened ? "shortened bout" : "recorded"}${x.timingMethod === "timed-confirmed" ? ` · ${time(x.timedSeconds)} unpaused / ${time(x.pausedSeconds)} paused; actual minutes confirmed` : " · actual minutes confirmed"}`;
  if (x.exerciseId === "mobility")
    return `${x.holds} × ${x.holdSeconds} s holds · ${x.activeReps} active reps · ${time(x.elapsedSeconds)} elapsed`;
  return `${x.weight ? fmt(x.weight) + " lb · " : ""}${esc(x.reps ?? x.minutes)} ${x.exerciseId === "aerobic" ? "min" : x.reps === "1+1" ? "pair" : "reps"} · ${esc(x.endpoint || x.outcome || x.quality || "recorded")}${x.grade ? " · " + x.grade + " / effort " + x.effort : ""}${x.fault ? " · " + esc(x.fault) : ""}${x.failed ? " · unsuccessful attempt" : ""}${x.preparation ? " · preparation attempt, included in heavy dose" : ""}${x.reviewFlag ? " · " + esc(x.reviewFlag) : ""}${x.seconds ? " · " + fmt(x.seconds) + " s" : ""}${x.heights?.length ? " · heights " + x.heights.map(fmt).join(", ") + " · mean " + fmt(x.heights.reduce((n, h) => n + h, 0) / x.heights.length) : ""}`;
}
function historyView() {
  const totals = monitoringTotals(state);
  const sets = state.records.flatMap((r) => r.sets),
    failureCount = sets.filter((s) => s.endpoint === "failure").length,
    ol = sets.filter((s) => s.grade),
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
                `<button data-action="record" data-id="${r.id}"><span class="record-date">${dateLabel(r.date)}<small>C${r.cycle} · W${r.week}</small></span><span><strong>${esc(r.session.title)}</strong><small>${r.sets.length} entries · ${r.status} · ${r.followup ? `next session ${r.followup.normal ? "normal" : "needs review"}` : "follow-up pending"}</small></span><span>↗</span></button>`,
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
function guideView() {
  const page = pages?.[guidePage - 1];
  return (
    title(
      "THE SOURCE OF TRUTH",
      "The complete program.",
      "Revision 6 · 13 September 2026 · Exact rules are reasoned inference unless the source labels them otherwise.",
    ) +
    `<div class="guide-grid"><section class="panel"><h2>Four priorities, in order.</h2><ol class="priority-list"><li>Olympic weightlifting performance</li><li>Hypertrophy · upper chest, side delts, traps</li><li>Athleticism</li><li>Longevity</li></ol><p>Every conventional work set reaches strict-form failure. Olympic lifts, preparation, athletics and mobility remain quality-limited.</p><a class="button" href="program/revision-6.pdf" target="_blank" rel="noopener">Open original PDF ↗</a></section><section class="panel"><h2>Keep the endpoint honest.</h2><p>Stable machines: another complete concentric cannot be achieved with prescribed form. Free weights: last complete valid rep, no further valid rep in reserve. TECH, pain and unsafe stops are separate outcomes.</p><p>Rep ranges select the load. They do not replace the endpoint. No forced reps, drop sets, rest-pause extensions or assisted negatives.</p>${sourceLink(2)}</section></div><section class="panel source-panel"><div class="section-label"><h2>Read the source</h2><span>43 pages · available offline</span></div><div class="source-controls">${select("Program page", "guide-page", Object.fromEntries(Array.from({ length: 43 }, (_, i) => [i + 1, `${i + 1}. ${guideTitles[i] || "Peer-reviewed references"}`])), guidePage)}${input("Find a word or phrase", "guide-search", "", "search", 'placeholder="e.g. two exposures"')}</div>${page ? `<pre class="source-text" tabindex="0">${esc(page.text)}</pre>` : "<p>Loading the locally bundled source…</p>"}<div id="search-results"></div></section>`
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
    `<section class="panel"><h2>Schedule & equipment</h2><form data-form="equipment"><div class="input-grid">${select("Visits on B/D", "split", { single: "Single visit", split: "Split after incline + laterals (≥3 h)" }, t.split ? "split" : "single")}${select("Smallest barbell increment · lb", "increment", { 2.5: "2.5 lb", 5: "5 lb" }, t.increment)}${select("Incline press", "incline", { default: "Machine · 30–45°", smith: "Smith · safeties", db: "Dumbbells · safe endpoint" }, t.equipment.incline || "default")}${select("Lateral raise", "lateral", { default: "Cable", db: "Dumbbell" }, t.equipment.lateral || "default")}${select("Supported row", "row", { default: "Chest-supported row", machine: "Supported machine row" }, t.equipment.row || "default")}${select("Leg curl", "leg_curl", { default: "Seated leg curl", lying: "Lying leg curl" }, t.equipment.leg_curl || "default")}${select("Calves", "calf", { default: "Standing, knees extended", press: "Supported knee-extended press", seated: "Seated · individualized fallback" }, t.equipment.calf || "default")}${select("Leg extension", "leg_ext", { default: "Supported reclined · ~40° hip flexion", upright: "Upright · equipment fallback" }, t.equipment.leg_ext || "default")}${select("Abdominals", "crunch", { default: "Machine crunch", cable: "Cable crunch" }, t.equipment.crunch || "default")}${select("Triceps", "triceps", { default: "Overhead cable extension", pressdown: "Pressdown · intolerance/interference" }, t.equipment.triceps || "default")}</div><p class="muted">Substitutions retain sets, reps and endpoint. Bench requires a flat barbell, safeties and competent spotting. No glute isolation.</p><p class="form-error" role="alert"></p>${submit("Save schedule & equipment")}</form></section>` +
    `<section class="panel"><h2>Time planning</h2><p>These allowances set the displayed times and guided countdowns. Training doses stay the same; extra recovery extends the prescribed rest.</p><form data-form="timing"><div class="input-grid">${select("Gym traffic · wait per station", "traffic", { quiet: "Quiet · 30 seconds", moderate: "Moderate · 2 minutes", busy: "Busy · 4 minutes" }, timing.traffic)}${input("Water, restroom & misc. · min per visit", "breakMinutes", timing.breakMinutes, "number", 'min="0" max="60" required')}${input("Typical plate / stack change · seconds", "plateSeconds", timing.plateSeconds, "number", 'min="0" max="300" required')}${input("Typical station move & setup · seconds", "stationSeconds", timing.stationSeconds, "number", 'min="0" max="600" required')}${input("Extra recovery allowance · seconds per work-set rest", "extraRestSeconds", timing.extraRestSeconds, "number", 'min="0" max="300" required')}${select("Athletics timing", "athleticsVisit", { separate: "Separate visit · allow ≥3 hours", same: "Same visit · 5-minute transition" }, timing.athleticsVisit)}</div>${check("Cable lateral raises performed one arm at a time (time both sides)", "unilateralCable", timing.unilateralCable)}<p class="muted">Setup and loading use your selected times. Countdown targets include prescribed rest plus your extra recovery allowance. One-arm timing does not apply when dumbbells are selected. Cardio shares the preceding visit when present. Arrival and departure are included; commuting is additional. A long interruption can require extra preparation. Active sessions keep their starting assumptions.</p><p class="form-error" role="alert"></p>${submit("Save time planning")}</form></section>` +
    `<section class="panel"><h2>Technical references</h2><p>SN ${t.anchors.snatch} lb · CJ ${t.anchors.cj} lb · CL ${t.anchors.clean || "unassessed"} · RJ ${t.anchors.jerk || "unassessed"}. Power clean never loads full CJ.</p>${btn("Record a demonstrated reference", "anchor")}${sourceLink(27)}</section>` +
    `<section class="panel"><h2>Technique & interference</h2><form data-form="technique"><div class="input-grid">${["snatch", "clean", "jerk"].map((k) => select(pretty(k), k, k === "jerk" ? { none: "Ordinary prescription", stance: "Light split stance/recovery", dip: "Light pause-dip regression" } : { none: "Ordinary prescription", receive: "Unsafe receiving · technique-bar rehearsal", return: "Secure return · 4 singles at 40–60%", turnover: "High-hang turnover replacement", balance: "First two sets knee-pause" }, t.technique[k])).join("")}</div>${check("Reduce A snatch doubles to 4 × 2: repeated B-session cost", "reduceA", t.reduceA)}${check("One fewer C jerk set for two exposures; suspend C assistance", "reduceJerk", t.reduceJerk)}${check("Lower-block fatigue: curls/calves 1; omit extensions/crunch", "lowerDose", t.lowerDose)}${check("Omit week-11 D affected lower work for slow recovery", "omitLastLower", t.omitLastLower)}${check("Omit provisional C pulls after target/cost review", "omitPull", t.omitPull)}${textarea("Observed issue / target and return review", "reason", "", "required")}<p class="form-error" role="alert"></p>${submit("Save technical prescription")}</form>${sourceLink(16)}${sourceLink(34)}</section>` +
    `<section class="panel"><h2>Optional work & controlled trials</h2><p>Athletics: ${t.athletics.enabled ? `stage ${t.athletics.stage}, ${t.athletics.secondary ? "two slots" : "one slot"}` : "not introduced"}. Aerobics: ${t.cardio.enabled ? t.cardio.minutes + " min/week" : "not introduced"}.</p>${btn("Review one program change", "change", "", "primary button")}${btn("Reduce or suspend optional work", "reduce-optional", "", "quiet")}${t.trials.map((trial) => `<div class="trial-row"><div><strong>${esc(trial.kind.replaceAll("_", " "))} · ${calendarWeekday(trial.day)}</strong><p>${esc(trial.reason)}</p><small>${trialExposures(state, trial).length} comparable exposures · ${trial.paused ? "paused" : trial.status} · review ${trial.reviewAt || "2 / 4 / 8"}</small></div>${btn("Review", "trial", `data-id="${trial.id}"`)}</div>`).join("")}</section>` +
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
  return `<section class="review-checklist"><h3>Normal Friday review</h3><ul><li>Compare like-load Olympic quality and first-set failure performance. Review >5% load loss at comparable quality, <90% good Olympic reps, altered positions, or >20% first-set rep loss twice.</li><li>If later failure sets lose ≥2 reps twice, consider two exposures using the preferred split before adding volume.</li><li>Decide: hold, one trial addition, reversal, or a reduced week.</li></ul>${pivot ? `<h3>Pivot review</h3><ul><li>Valid total or technical benchmark.</li><li>Lift videos.</li><li>Squat/bench rep performance.</li><li>Standardized physique photos and circumferences.</li><li>Optional CMJ/short-run trend from eligible athletic sessions.</li></ul>` : ""}${sourceLink(26)}</section>`;
}
function openReview() {
  const t = state.training;
  formModal(
    "Weekly comparison & decision",
    "review",
    `${reviewChecklist(t.week === 13)}<p>Compare like-load Olympic quality, first failure sets and next-session positions. Resolve priority-1 needs first. If unclear: reverse health-only additions, then athletics, then recent/local hypertrophy.</p>${monitoring(
      state,
    )
      .map((s) => notice(s, "warning"))
      .join(
        "",
      )}${t.cycle === 1 ? notice("First successful cycle: schedule a trap trial toward 4 direct sets. After entry + two stable green weeks, explicitly consider one useful squat support set; no plateau required.") : ""}${[4, 8].includes(t.week) ? notice("Checkpoint: repeat the preceding successful loads/sets. At the first green checkpoint, record a target for C pulls; if none, trial omission for two C exposures.") : ""}${t.week === 13 ? notice("Pivot: review demonstrated lifts, videos, squat/bench reps, standardized physique photos/circumferences, and existing jump/run trends. Change one input at a time.") : ""}${select("Week decision", "action", { hold: "Hold / repeat this phase week", advance: "Advance after resolving the week" }, "hold")}${select("Recovery dose", "recovery", { normal: "Normal / return toward normal", targeted: "Targeted reduction", reset: "Full fatigue reset" }, t.recovery === "restore" ? "normal" : t.recovery)}${check("This was a green week; subsequent practice and local warm-ups stayed normal", "green")}${check("Build gate: two normal weeks, ≥90% acceptable Olympic reps, no recurring receiving limitation", "buildReady", t.gate !== "F")}${check("Realization gate: 80–85% singles are secure", "realizationReady", t.gate === "R")}${t.recovery === "restore" ? check("Gradual restoration has reached the prior tolerated dose with normal subsequent practice", "restored") : ""}${textarea("Like-load comparisons, dose decision, squat/trap/pull review; pivot measurements and video references", "notes", "", "required")}${sourceLink(30)}`,
    "Save weekly review",
  );
}
function openChange() {
  formModal(
    "One reviewed change",
    "change",
    select("Program change", "kind", CHANGE_OPTIONS, "set") +
      `<div class="input-grid">${select("Existing exercise / relevant squat", "exercise", { incline: "Incline", lateral: "Lateral raise", shrug: "Shrug", row: "Row", pulldown: "Pulldown", rear_delt: "Rear delt", curl: "Curl", triceps: "Triceps", leg_curl: "Leg curl", calf: "Calf", leg_ext: "Leg extension", crunch: "Crunch", front_squat: "Front squat", back_squat: "Back squat" }, "shrug")}${select("Day for an added set", "day", { tuesday: `B · ${calendarWeekday("tuesday")}`, friday: `D · ${calendarWeekday("friday")}` }, "friday")}${input("Previous secure rack working load (rack progression only)", "baselineLoad", "", "number", 'min="1" step="any"')}${input("New rack or pause-jerk trial load (+2.5–5 lb only)", "load", "", "number", 'min="1" step="any"')}</div>` +
      notice(
        "Use pages 15, 21–22, 27–29 and 31–34 for eligibility. Assessments need two secure Olympic weeks + safe release. Assistance needs ≥3 comparable observations. Primary athletics progresses after two good exposures per step; second slot after four productive primary exposures. Heavy trials replace one attempt in one lift, at 90–92%, with the final D gate earned first.",
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
            .join("")}</ol>${r.omissions
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
  if (a === "change") return openChange();
  if (a === "record") return openRecord(id);
  if (a === "delete-session") {
    const r = state.records.find((r) => r.id === id);
    if (!r) throw Error("This saved session no longer exists.");
    return modal(
      "Delete this session?",
      `<h3>${esc(r.session.title)}</h3><p>${stamp(r.startedAt)} · Cycle ${r.cycle}, week ${r.week} · ${r.sets.length} saved entries</p><p>Delete this session’s entries, warm-ups, timers, notes and follow-up. It will no longer count toward history or progression.${r.weekId === state.weekId ? " Its slot in this week will be available to start again, subject to the usual schedule and readiness checks." : " Your current program week will stay unchanged."}</p><p>This cannot be undone in the app. Existing exported backups are unchanged.</p><div class="actions">${btn("Keep session", "record", `data-id="${id}"`)}${btn("Delete session permanently", "confirm-delete-session", `data-id="${id}"`, "button danger")}</div>`,
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
    try {
      transact((s) => startSession(s, day, id));
      nav("workout");
      try {
        wakeLock = await navigator.wakeLock?.request("screen");
      } catch {}
    } catch (e) {
      if (e.message.includes("You can start"))
        formModal(
          "Bench spacing",
          "start-without",
          `<p>${esc(e.message)}</p><input name="day" type="hidden" value="${day}"><input name="id" type="hidden" value="${id}">`,
          "Start with bench deferred",
        );
      else throw e;
    }
    return;
  }
  if (a === "defer")
    return formModal(
      "Move the whole session day",
      "defer",
      `<input type="hidden" name="day" value="${day}">${input("Next ready date", "date", scheduledDate(state, day), "date", "required")}${textarea("Reason / event", "reason", "", "required")}<p>Roll later unresolved dates by the same interval. Completed sessions stay fixed. B/D carry their blocks and bench.</p>`,
      "Move & roll later dates",
    );
  if (a === "omit-session")
    return formModal(
      "Omit this session",
      "omit-session",
      `<input type="hidden" name="day" value="${day}"><input type="hidden" name="id" value="${id}">${textarea("Reason; omitted blocks are dropped, bench can be rescued separately", "reason", "", "required")}`,
      "Record omission",
    );
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
        `<p>Nearest ready day, ≥48 actual hours between sessions. Keep bench after priority lifting and away from a vulnerable next session. Friday can become low-rep with Sunday moderate; shift the next Tuesday when needed. Only bench is rescued.</p>${notice(benchWindow(state).last ? "Last bench: " + stamp(benchWindow(state).last) + ". Earliest next: " + stamp(benchWindow(state).eligibleAt) : "No previous bench timestamp recorded.")}${check("Today’s priority work is complete; relocation will not compromise the next priority session", "placement")}${sourceLink(20)}`,
      "Start eligible bench",
    );
  if (a === "relocate") {
    transact((s) => {
      if (s.active)
        throw Error("Finish the active session before relocating athletics.");
      if (s.training.week === 11 || s.training.week === 12)
        throw Error(
          "Week 11 athletics stays with A only; week 12 has no athletics.",
        );
      if (
        weekRecords(s).some(
          (r) => r.session.id === "athletics" && r.sets.length,
        )
      )
        throw Error("Primary module already performed this week.");
      s.athleticDay = "thursday";
    }, "Primary athletics moved to C; no extra module.");
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
    primeTimerSound();
    return transact((s) => {
      s.active.pacing.sound = !s.active.pacing.sound;
    });
  }
  if (a === "pace-start") {
    if (state.active.pacing.sound) primeTimerSound();
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
      `<p>For established training or a long-interruption restart. Logs remain intact. Use the entry ramp again after a long interruption.</p><div class="input-grid">${input("Cycle", "cycle", state.training.cycle, "number", 'min="1" max="4" step="1" required')}${input("Cycle week", "week", state.training.week, "number", 'min="1" max="13" step="1" required')}${select("Entry tolerance dose", "entry", { 1: "Entry 1", 2: "Entry 2", 3: "Established base" }, state.training.entry)}${select("Demonstrated phase gate", "gate", { F: "Foundation", B: "Build · two secure normal weeks", R: "Realization · secure 80–85% singles" }, state.training.gate)}${input("Date of this week’s A / Monday slot", "date", state.weekStart, "date", "required")}</div>${textarea("Training history and reason for this starting position", "reason", "", "required")}${check("Position and phase gate are supported by my actual training; no compression to meet dates", "confirmed")}`,
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
    if (type === "start-without")
      startSession(s, f.get("day"), f.get("id"), Date.now(), {
        deferBench: true,
      });
    if (type === "defer") {
      deferDay(s, f.get("day"), f.get("date"));
      s.events.push({
        at: Date.now(),
        type: "Whole-session deferral",
        day: f.get("day"),
        date: f.get("date"),
        notes: f.get("reason"),
      });
    }
    if (type === "omit-session")
      omissionRecord(s, f.get("day"), f.get("id"), f.get("reason"));
    if (type === "rescue") {
      if (!f.has("placement"))
        throw Error("Confirm priority placement before bench relocation.");
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
      s.reviews.push({
        at: Date.now(),
        type: "Reverse interfering addition",
        notes: f.get("reason"),
        kind: k,
      });
    }
  }, "Saved on this device.");
  close();
  if (["start-without", "rescue"].includes(type)) nav("workout");
  else if (["finish", "end-early"].includes(type)) {
    wakeLock?.release();
    nav("history");
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.nav) return nav(b.dataset.nav);
  if (b.dataset.action)
    Promise.resolve(action(b)).catch((e) => toast(e.message));
});
document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
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
let timerAudio, lastTimerCue;
function primeTimerSound() {
  try {
    timerAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    timerAudio.resume();
  } catch {
    toast("Timer sound is unavailable here; the countdown remains visible.");
  }
}
function tick() {
  if (!state) return;
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
    const cue = `${w.id}:${p.currentId}:${p.timer?.startedAt}:${p.additions[p.currentId] || 0}:${p.breakRun?.startedAt || ""}`;
    if (
      (p.timer || p.breakRun) &&
      display.seconds <= 0 &&
      lastTimerCue !== cue
    ) {
      lastTimerCue = cue;
      if (p.sound && timerAudio?.state === "running") {
        const tone = timerAudio.createOscillator(),
          gain = timerAudio.createGain();
        tone.frequency.value = 660;
        gain.gain.value = 0.15;
        tone.connect(gain);
        gain.connect(timerAudio.destination);
        tone.start();
        tone.stop(timerAudio.currentTime + 0.25);
        navigator.vibrate?.(150);
      }
    }
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
  buttons[1].dataset.action = paced ? "pace-show" : "rest-end";
  buttons[1].textContent = paced ? "Timer" : "Done";
}
setInterval(tick, 1000);
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
