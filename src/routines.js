// Executable preparation and mobility use the frozen session prescription.
export function mobilitySteps(e) {
  return [
    { title: "Left side · hold 1", seconds: e.holdSeconds },
    { title: "Rest / change sides", seconds: 15 },
    { title: "Right side · hold 1", seconds: e.holdSeconds },
    { title: "Rest / change sides", seconds: 15 },
    { title: "Left side · hold 2", seconds: e.holdSeconds },
    { title: "Rest / change sides", seconds: 15 },
    { title: "Right side · hold 2", seconds: e.holdSeconds },
    { title: "Five slow active reps; recheck the position", seconds: 0 },
  ];
}
export function validMobilityTrace(e, steps, count = 8) {
  const prescribed = mobilitySteps(e);
  return (
    Array.isArray(steps) &&
    steps.length === count &&
    steps.every(
      (step, i) =>
        step &&
        step.title === prescribed[i].title &&
        step.seconds === prescribed[i].seconds &&
        Number.isFinite(step.startedAt) &&
        Number.isFinite(step.endedAt) &&
        step.startedAt >= 0 &&
        step.endedAt >= step.startedAt + step.seconds * 1000 &&
        (!i || step.startedAt >= steps[i - 1].endedAt),
    )
  );
}
export function preparationElapsed(timer, now = Date.now()) {
  return Math.max(
    0,
    ((timer.pausedAt || now) - timer.startedAt - (timer.pausedMs || 0)) / 1000,
  );
}
export function startPreparation(s, key = "general", now = Date.now()) {
  const w = s.active;
  if (
    !w ||
    (!["general", "rewarm"].includes(key) &&
      !w.session.rows.some((e) => e.key === key))
  )
    throw Error("No matching preparation in this session.");
  if (w.preparationTimer && w.preparationTimer.key !== key)
    throw Error("Finish the current preparation first.");
  w.preparationTimer ||= { key, startedAt: now, pausedAt: null, pausedMs: 0 };
}
export function pausePreparation(s, now = Date.now()) {
  const t = s.active?.preparationTimer;
  if (!t) throw Error("Start preparation first.");
  if (t.pausedAt) {
    t.pausedMs += now - t.pausedAt;
    t.pausedAt = null;
  } else t.pausedAt = now;
}
export function finishPreparation(s, key = "general", now = Date.now()) {
  const w = s.active,
    timer = w?.preparationTimer;
  if (!w) throw Error("No active session.");
  if (timer && timer.key !== key)
    throw Error("Finish the current preparation first.");
  const name =
    key === "general"
      ? "General / field warm-up"
      : key === "rewarm"
        ? "Re-warm after interruption"
        : w.session.rows.find((e) => e.key === key)?.name;
  if (!name) throw Error("Preparation is not in this session.");
  w.preparationLog ||= [];
  w.preparationLog.push({
    key,
    name,
    startedAt: timer?.startedAt ?? null,
    endedAt: now,
    seconds: timer ? preparationElapsed(timer, now) : null,
    method: timer ? "timed" : "confirmed",
  });
  w.preparationTimer = null;
  if (key === "general") w.warmup = true;
  else if (key !== "rewarm" && !w.preparations.includes(key))
    w.preparations.push(key);
}
export function interruptPreparation(s, now = Date.now()) {
  const w = s.active,
    timer = w?.preparationTimer;
  if (!timer) return;
  w.preparationLog ||= [];
  w.preparationLog.push({
    key: timer.key,
    name:
      timer.key === "general"
        ? "General / field warm-up"
        : timer.key === "rewarm"
          ? "Re-warm after interruption"
          : w.session.rows.find((e) => e.key === timer.key).name,
    startedAt: timer.startedAt,
    endedAt: now,
    seconds: preparationElapsed(timer, now),
    method: "interrupted",
  });
  w.preparationTimer = null;
}
