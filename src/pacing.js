import {
  olympicFailure,
  failureSets,
  failureReached,
} from "./failure-policy.js";
import { fixedSession } from "./timeline.js";

const manualStart = (s) =>
  ["work", "work-part", "aerobic", "mobility"].includes(s.role);
export function createPacing(w, now = Date.now()) {
  const t = fixedSession(w.session, w.timeConfig, w.timeConfig);
  w.pacing = {
    version: 1,
    plannedSeconds: t.seconds[0],
    plan: t.stages,
    completed: [],
    currentId: null,
    timer: null,
    additions: {},
    breakUsed: 0,
    breakRun: null,
    workEndedAt: null,
    enabledAt: now,
    sound: true,
  };
  return w.pacing;
}
export function paceStage(w) {
  return w.pacing?.plan.find((s) => s.id === w.pacing.currentId) || null;
}
export function paceElapsed(t, now = Date.now()) {
  return t
    ? Math.max(0, ((t.pausedAt ?? now) - t.startedAt - t.pausedMs) / 1000)
    : 0;
}
export function paceSeconds(w, stage = paceStage(w)) {
  return stage
    ? Math.max(
        0,
        stage.seconds +
          (Object.hasOwn(w.pacing.additions, stage.id)
            ? w.pacing.additions[stage.id]
            : 0) -
          (stage.role === "break-pool" ? w.pacing.breakUsed : 0),
      )
    : 0;
}
export function paceMinimum(w, stage = paceStage(w)) {
  return stage?.minSeconds
    ? stage.minSeconds +
        (Object.hasOwn(w.pacing.additions, stage.id)
          ? w.pacing.additions[stage.id]
          : 0)
    : 0;
}
export function paceStatus(w, now = Date.now()) {
  const p = w.pacing,
    stage = paceStage(w);
  if (!p) return null;
  const completed = new Set(p.completed.map((s) => s.id));
  const elapsed = paceElapsed(p.timer, now);
  const current = Math.max(0, paceSeconds(w) - elapsed);
  const future = p.plan
    .filter((s) => !completed.has(s.id) && s.id !== stage?.id)
    .reduce((n, s) => n + paceSeconds(w, s), 0);
  const breakLeft = p.breakRun
    ? Math.max(0, p.breakRun.seconds - (now - p.breakRun.startedAt) / 1000)
    : 0;
  const rewarm =
    w.preparationTimer?.key === "rewarm"
      ? Math.max(0, 240 - paceElapsed(w.preparationTimer, now))
      : 0;
  let remaining = current + future + breakLeft + rewarm;
  if (p.workEndedAt) {
    remaining -= current;
    const next = p.plan[p.plan.findIndex((s) => s.id === p.currentId) + 1];
    if (next?.role === "rest")
      remaining -= Math.min(paceSeconds(w, next), (now - p.workEndedAt) / 1000);
  }
  return {
    stage,
    elapsed,
    remaining,
    phaseRemaining: paceSeconds(w) - elapsed,
    budgetRemaining: p.plannedSeconds - (now - p.enabledAt) / 1000,
    finishAt: now + remaining * 1000,
    breakLeft,
  };
}
function record(w, method, now) {
  const p = w.pacing,
    stage = paceStage(w);
  if (!stage) return;
  p.completed.push({
    id: stage.id,
    label: stage.label,
    key: stage.key || null,
    role: stage.role,
    targetSeconds: paceSeconds(w, stage),
    startedAt: p.timer?.startedAt ?? null,
    endedAt: now,
    seconds: p.timer ? paceElapsed(p.timer, now) : null,
    method,
  });
  p.currentId = null;
  p.timer = null;
  p.workEndedAt = null;
}
export function syncPacing(w, progress, now = Date.now()) {
  const p = w.pacing;
  if (!p) return;
  // The initial budget assumes the upper rep target plus one terminal attempt.
  // Actual good reps extend the queue; an early endpoint removes unused reps.
  const session = {
    ...w.session,
    rows: w.session.rows.map((e) => {
      if (!olympicFailure(e)) return e;
      const status = progress[e.key];
      const sets = failureSets(status?.logs || []);
      const repSequence = Array.from(
        { length: status?.done ? Math.max(1, sets.length) : e.sets },
        (_, i) => {
          const set = sets[i] || [];
          return failureReached(set) || status?.done
            ? Math.max(1, set.length)
            : Math.max(e.reps, set.length + 1);
        },
      );
      return { ...e, sets: repSequence.length, repSequence };
    }),
  };
  const plan = fixedSession(session, w.timeConfig, w.timeConfig).stages;
  p.plan = plan;
  let frontier = -1;
  plan.forEach((step, i) => {
    const before = w.session.rows.slice(
      0,
      w.session.rows.findIndex((e) => e.key === step.key),
    );
    if (
      (step.role === "general-check" && w.warmup) ||
      (step.role === "prepare-check" &&
        w.preparations.includes(step.key) &&
        before.every((e) => progress[e.key]?.done)) ||
      (["work", "aerobic"].includes(step.role) &&
        progress[step.key]?.count > step.attempt) ||
      (step.role === "mobility" &&
        (progress[step.key]?.done ||
          (w.mobilityRun?.key === step.key && w.mobilityRun.index > step.step)))
    )
      frontier = Math.max(frontier, i);
  });
  const done = new Set(p.completed.map((s) => s.id));
  for (const [i, stage] of plan.entries()) {
    if (done.has(stage.id)) continue;
    const omitted =
      stage.key &&
      progress[stage.key]?.done &&
      !["rest", "handling"].includes(stage.role);
    const noMoreWork =
      stage.key && w.omissions.some((o) => o.key === stage.key);
    if (i <= frontier || omitted || noMoreWork) {
      if (stage.id === p.currentId) record(w, "recorded", p.workEndedAt ?? now);
      else
        p.completed.push({
          id: stage.id,
          label: stage.label,
          key: stage.key || null,
          role: stage.role,
          targetSeconds: paceSeconds(w, stage),
          startedAt: null,
          endedAt: now,
          seconds: null,
          method: "unpaced",
        });
      done.add(stage.id);
    }
  }
  if (p.currentId && !plan.some((s) => s.id === p.currentId)) {
    p.currentId = null;
    p.timer = null;
    p.workEndedAt = null;
  }
  const current = plan.find((s) => !done.has(s.id));
  if (current?.id !== p.currentId) {
    p.currentId = current?.id || null;
    p.timer = null;
    p.workEndedAt = null;
    if (current && !manualStart(current) && !current.role.endsWith("check")) {
      const last =
        current.afterAttempt === undefined
          ? null
          : w.sets.filter((s) => s.key === current.key)[current.afterAttempt];
      p.timer = {
        startedAt: current.role === "rest" && last ? last.at : now,
        pausedAt: null,
        pausedMs: 0,
      };
    }
  }
  if (
    current?.role === "mobility" &&
    w.mobilityRun?.key === current.key &&
    w.mobilityRun.index === current.step
  )
    p.timer = {
      startedAt: w.mobilityRun.stepStartedAt,
      pausedAt: null,
      pausedMs: 0,
    };
  if (current?.role === "aerobic" && w.aerobicRun?.key === current.key)
    p.timer = {
      startedAt: w.aerobicRun.startedAt,
      pausedAt: w.aerobicRun.pausedAt,
      pausedMs: w.aerobicRun.pausedMs,
    };
}
export function startPaceStage(w, now = Date.now()) {
  if (!paceStage(w)) throw Error("No timed step remains.");
  if (w.pacing.breakRun) throw Error("Finish the break first.");
  w.pacing.timer ||= { startedAt: now, pausedAt: null, pausedMs: 0 };
}
export function pausePace(w, now = Date.now()) {
  const t = w.pacing?.timer;
  if (!t) throw Error("Start the step first.");
  if (w.pacing.workEndedAt) throw Error("Record the set result first.");
  if (t.pausedAt !== null) {
    t.pausedMs += now - t.pausedAt;
    t.pausedAt = null;
  } else t.pausedAt = now;
}
export function extendPace(w, seconds = 60) {
  const stage = paceStage(w);
  if (!stage) throw Error("No timed step remains.");
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600)
    throw Error("Choose a valid extra time allowance.");
  w.pacing.additions[stage.id] =
    (Object.hasOwn(w.pacing.additions, stage.id)
      ? w.pacing.additions[stage.id]
      : 0) + seconds;
}
export function endPaceSet(w, now = Date.now()) {
  if (paceStage(w)?.role !== "work" || !w.pacing.timer)
    throw Error("Start the set timer first.");
  if (!w.pacing.workEndedAt) {
    w.pacing.workEndedAt = now;
    w.pacing.timer.pausedAt = now;
  }
}
export function completePaceStage(w, now = Date.now(), skip = false) {
  const stage = paceStage(w);
  if (!stage) throw Error("No timed step remains.");
  if (["work", "aerobic", "mobility"].includes(stage.role))
    throw Error("Confirm actual work using the session log.");
  if (!skip && paceElapsed(w.pacing.timer, now) < paceMinimum(w, stage))
    throw Error(
      "Complete the prescribed rest before continuing; add time if needed.",
    );
  if (
    skip &&
    ![
      "ramp",
      "ramp-rest",
      "rest",
      "recovery",
      "break-pool",
      "waiting",
    ].includes(stage.role)
  )
    throw Error("This step cannot be skipped.");
  if (skip && ["rest", "recovery"].includes(stage.role)) {
    w.restOverrides ||= [];
    w.restOverrides.push({
      key: stage.key,
      afterAttempt: stage.afterAttempt ?? null,
      at: now,
      recommendedSeconds: paceMinimum(w, stage),
      actualSeconds: paceElapsed(w.pacing.timer, now),
    });
  }
  record(w, skip ? "not-needed" : "confirmed", now);
}
export function takePaceBreak(w, seconds = 120, now = Date.now()) {
  const p = w.pacing,
    stage = paceStage(w);
  if (!p || p.breakRun) throw Error("A break is already running.");
  if (
    stage &&
    ["work", "work-part", "mobility", "aerobic"].includes(stage.role) &&
    p.timer
  )
    throw Error(
      "Finish or pause and record the current work before taking a break.",
    );
  const pool = p.plan.find((s) => s.role === "break-pool");
  const left =
    pool && !p.completed.some((s) => s.id === pool.id)
      ? paceSeconds(w, pool)
      : 0;
  const reserved = Math.min(seconds, left);
  const overlap = ["rest", "recovery", "reset", "ramp-rest"].includes(
    stage?.role,
  );
  const pause = p.timer && p.timer.pausedAt === null && !overlap;
  p.breakRun = { startedAt: now, seconds, reserved, resume: !!pause };
  p.breakUsed += reserved;
  if (pause) p.timer.pausedAt = now;
}
export function finishPaceBreak(w, now = Date.now()) {
  const p = w.pacing,
    b = p?.breakRun;
  if (!b) throw Error("No break is running.");
  const elapsed = (now - b.startedAt) / 1000;
  p.breakUsed -= Math.max(0, b.reserved - elapsed);
  const pool = p.plan.find((s) => s.role === "break-pool");
  if (pool && !p.completed.some((s) => s.id === pool.id))
    p.breakUsed += Math.min(
      Math.max(0, elapsed - b.reserved),
      Math.max(0, pool.seconds - p.breakUsed),
    );
  p.completed.push({
    id: `break:${b.startedAt}`,
    label: "Water / restroom / miscellaneous break",
    key: null,
    role: "break",
    targetSeconds: b.seconds,
    startedAt: b.startedAt,
    endedAt: now,
    seconds: elapsed,
    method: "confirmed",
  });
  if (b.resume && p.timer && p.timer.pausedAt !== null) {
    p.timer.pausedMs += now - p.timer.pausedAt;
    p.timer.pausedAt = null;
  }
  p.breakRun = null;
}
export function closePacing(w, now = Date.now()) {
  const p = w.pacing;
  if (!p) return;
  if (p.breakRun) finishPaceBreak(w, now);
  if (p.timer && paceStage(w)) record(w, "interrupted", now);
  p.completed = p.completed.filter((step) => step.seconds !== null);
  p.plan = [];
  p.currentId = null;
  p.timer = null;
  p.workEndedAt = null;
}
export function validPacing(p) {
  const finite = (n) => Number.isFinite(n) && n >= 0 && n <= 1e15;
  const timer = (t) =>
    !t ||
    (finite(t.startedAt) &&
      (t.pausedAt === null ||
        (finite(t.pausedAt) && t.pausedAt >= t.startedAt)) &&
      finite(t.pausedMs));
  return (
    !!p &&
    p.version === 1 &&
    finite(p.plannedSeconds) &&
    finite(p.enabledAt) &&
    finite(p.breakUsed) &&
    Array.isArray(p.plan) &&
    p.plan.length <= 10000 &&
    p.plan.every(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.label === "string" &&
        typeof s.role === "string" &&
        finite(s.seconds) &&
        (s.minSeconds === undefined || finite(s.minSeconds)),
    ) &&
    new Set(p.plan.map((s) => s.id)).size === p.plan.length &&
    (p.currentId === null || p.plan.some((s) => s.id === p.currentId)) &&
    timer(p.timer) &&
    (p.workEndedAt === null || finite(p.workEndedAt)) &&
    p.additions &&
    typeof p.additions === "object" &&
    Object.values(p.additions).every(finite) &&
    Array.isArray(p.completed) &&
    p.completed.every(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.label === "string" &&
        typeof s.role === "string" &&
        finite(s.targetSeconds) &&
        (s.startedAt === null || finite(s.startedAt)) &&
        finite(s.endedAt) &&
        (s.startedAt === null || s.endedAt >= s.startedAt) &&
        (s.seconds === null || finite(s.seconds)) &&
        [
          "recorded",
          "unpaced",
          "confirmed",
          "not-needed",
          "interrupted",
        ].includes(s.method),
    ) &&
    (!p.breakRun ||
      (finite(p.breakRun.startedAt) &&
        finite(p.breakRun.seconds) &&
        finite(p.breakRun.reserved) &&
        typeof p.breakRun.resume === "boolean"))
  );
}
