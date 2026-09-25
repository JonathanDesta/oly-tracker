import { paceStage, paceSeconds } from "./pacing.js";
import { fixedSession } from "./timeline.js";
import { mobilitySteps } from "./routines.js";

export const ALERT_KEY = "oly_timer_alerts_v1";
export const ALERT_DEFAULTS = Object.freeze({ enabled: true, volume: 1 });
export function readAlertPreferences(storage) {
  try {
    const value = JSON.parse(storage.getItem(ALERT_KEY));
    return {
      enabled: typeof value?.enabled === "boolean" ? value.enabled : true,
      volume: [0.5, 0.75, 1].includes(value?.volume) ? value.volume : 1,
    };
  } catch {
    return { ...ALERT_DEFAULTS };
  }
}

// Absolute deadlines are independent of the selected app page and interval ticks.
export function currentAlarm(state) {
  const w = state?.active;
  if (!w) return null;
  const make = (id, label, startedAt, seconds, pausedMs = 0) => {
    const deadline = Math.round(startedAt + pausedMs + seconds * 1000);
    return { key: `${w.id}:${id}:${deadline}`, label, deadline };
  };
  const p = w.pacing;
  if (p?.breakRun)
    return make(
      "break",
      "Break finished",
      p.breakRun.startedAt,
      p.breakRun.seconds,
    );
  if (
    w.preparationTimer &&
    (!p ||
      w.preparationTimer.key === "rewarm" ||
      w.preparationTimer.manualCountdown)
  ) {
    const t = w.preparationTimer;
    let seconds = 240;
    if (t.key !== "rewarm") {
      const config = w.timeConfig || {
          ...state.training,
          anchors: w.anchors,
          increment: w.increment,
        },
        budget = fixedSession(w.session, config, config);
      seconds =
        t.key === "general"
          ? budget.overhead.general[0] + budget.overhead.transition[0]
          : ["setup", "waiting", "recovery", "ramp"].reduce(
              (sum, part) =>
                sum +
                (budget.rows.find((row) => row.key === t.key)?.parts[part][0] ||
                  0),
              0,
            );
    }
    return t.pausedAt === null
      ? make(
          `preparation:${t.key}`,
          "Preparation time reached",
          t.startedAt,
          seconds,
          t.pausedMs,
        )
      : null;
  }
  if (p) {
    if (p.workEndedAt) {
      const next =
        p.plan[p.plan.findIndex((step) => step.id === p.currentId) + 1];
      return next?.role === "rest"
        ? make(next.id, next.label, p.workEndedAt, paceSeconds(w, next))
        : null;
    }
    const step = paceStage(w),
      t = p.timer;
    return step && t && t.pausedAt === null && paceSeconds(w, step) > 0
      ? make(step.id, step.label, t.startedAt, paceSeconds(w, step), t.pausedMs)
      : null;
  }
  const row = w.session?.rows.find(
    (row) => row.key === (w.aerobicRun?.key || w.mobilityRun?.key),
  );
  if (w.aerobicRun && row) {
    const t = w.aerobicRun;
    return t.pausedAt === null
      ? make(
          `aerobic:${row.key}`,
          "Moving-time target reached",
          t.startedAt,
          row.minutes * 60,
          t.pausedMs,
        )
      : null;
  }
  if (w.mobilityRun && row) {
    const step = mobilitySteps(row)[w.mobilityRun.index];
    return step.seconds > 0
      ? make(
          `mobility:${row.key}:${w.mobilityRun.index}`,
          step.title,
          w.mobilityRun.stepStartedAt,
          step.seconds,
        )
      : null;
  }
  return state.restEnd > 0
    ? make("rest", "Rest finished", state.restEnd, 0)
    : null;
}

// One actual media track contains BOTH the delay and the repeating alert.
// The audio renderer can reach the alarm without a background JS callback.
// This is not an OS alarm: interruptions, browser termination, and device policy
// can stop media. Never advertise guaranteed locked-phone delivery.
export function alarmWave(delaySeconds, ringSeconds = 60, volume = 1) {
  if (!Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 7200)
    throw Error("Alarm delay must be between zero and two hours.");
  if (!Number.isFinite(ringSeconds) || ringSeconds <= 0 || ringSeconds > 60)
    throw Error("Alarm sound must be between zero and sixty seconds.");
  if (!Number.isFinite(volume) || volume < 0 || volume > 1)
    throw Error("Alarm volume must be between zero and one.");
  const rate = 8000,
    silence = Math.ceil(delaySeconds * rate),
    ringing = Math.ceil(ringSeconds * rate),
    count = silence + ringing,
    bytes = new Uint8Array(44 + count),
    header = new DataView(bytes.buffer);
  const text = (offset, value) =>
    [...value].forEach((char, i) => (bytes[offset + i] = char.charCodeAt(0)));
  text(0, "RIFF");
  header.setUint32(4, count + 36, true);
  text(8, "WAVEfmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, rate, true);
  header.setUint32(28, rate, true);
  header.setUint16(32, 1, true);
  header.setUint16(34, 8, true);
  text(36, "data");
  header.setUint32(40, count, true);
  bytes.fill(128, 44);
  for (let i = 0; i < ringing; i++) {
    const seconds = i / rate,
      burst = seconds % 4,
      pulse = burst % 0.7;
    if (burst >= 2.1 || pulse >= 0.45) continue;
    const envelope = Math.min(1, pulse / 0.012, (0.45 - pulse) / 0.025),
      tone =
        0.42 *
        (Math.sin(2 * Math.PI * 780 * seconds) +
          Math.sin(2 * Math.PI * 1040 * seconds));
    bytes[44 + silence + i] = Math.round(128 + 127 * tone * envelope * volume);
  }
  return bytes;
}

export class TimerAlerts {
  constructor({
    document,
    navigator,
    URL,
    Blob,
    storage,
    now = () => Date.now(),
  }) {
    Object.assign(this, { document, navigator, URL, Blob, storage, now });
    this.preferences = readAlertPreferences(storage);
    this.acknowledged = new Set();
    this.status = "idle";
    this.target = null;
    this.audio = document.createElement("audio");
    this.audio.id = "workout-alarm-audio";
    this.audio.preload = "auto";
    this.audio.setAttribute("playsinline", "");
    this.audio.setAttribute("aria-hidden", "true");
    document.body.append(this.audio);
    this.audio.addEventListener("pause", () => {
      if (this.target && !this.audio.ended && this.status === "playing")
        this.status = "interrupted";
    });
    this.audio.addEventListener("ended", () => {
      this.status = "finished";
      if (this.testTarget) this.acknowledge();
    });
    this.audio.addEventListener("error", () => {
      this.status = "blocked";
    });
  }
  save(preferences) {
    this.preferences = { ...this.preferences, ...preferences };
    this.storage.setItem(ALERT_KEY, JSON.stringify(this.preferences));
  }
  stop() {
    this.status = "idle";
    this.target = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    if (this.url) this.URL.revokeObjectURL(this.url);
    this.url = null;
  }
  acknowledge() {
    if (this.target) this.acknowledged.add(this.target.key);
    if (this.acknowledged.size > 100)
      this.acknowledged.delete(this.acknowledged.values().next().value);
    this.testTarget = null;
    this.stop();
  }
  sync(target, { gesture = false, resuming = false } = {}) {
    target = this.testTarget || target;
    if (
      !this.preferences.enabled ||
      !target ||
      this.acknowledged.has(target.key)
    ) {
      if (this.target) this.stop();
      return;
    }
    const same =
      target.key === this.target?.key &&
      this.armedVolume === this.preferences.volume;
    if (
      same &&
      !(gesture && ["blocked", "interrupted"].includes(this.status)) &&
      !resuming
    )
      return;
    // If audio was interrupted while hidden, use the wall-clock deadline on return.
    if (
      same &&
      resuming &&
      this.status === "playing" &&
      !this.audio.paused &&
      Math.abs(this.audio.currentTime - (this.now() - this.armedAt) / 1000) < 2
    )
      return;
    if (same && this.status === "finished") return;
    this.stop();
    this.target = target;
    const delay = Math.max(0, (target.deadline - this.now()) / 1000);
    if (delay > 7200) {
      this.status = "blocked";
      return;
    }
    this.url = this.URL.createObjectURL(
      new this.Blob([alarmWave(delay, 60, this.preferences.volume)], {
        type: "audio/wav",
      }),
    );
    this.audio.src = this.url;
    // iPhone controls media-element volume itself. Scale the actual samples
    // instead, so the app's quieter settings also work on that platform.
    this.audio.volume = 1;
    this.armedVolume = this.preferences.volume;
    this.armedAt = this.now();
    this.status = "starting";
    try {
      if (this.navigator.audioSession)
        this.navigator.audioSession.type = "playback";
    } catch {
      /* Optional browser capability. */
    }
    const url = this.url;
    try {
      Promise.resolve(this.audio.play())
        .then(() => {
          if (url === this.url) this.status = "playing";
        })
        .catch(() => {
          if (url === this.url) this.status = "blocked";
        });
    } catch {
      this.status = "blocked";
    }
  }
  test(delay = 0) {
    this.acknowledge();
    this.testTarget = {
      key: `test:${this.now()}`,
      label: "Test alarm",
      deadline: this.now() + delay * 1000,
    };
    this.sync(null, { gesture: true });
  }
}
