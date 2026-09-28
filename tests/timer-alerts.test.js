import test from "node:test";
import assert from "node:assert/strict";
import {
  readAlertPreferences,
  currentAlarm,
  alarmWave,
  TimerAlerts,
} from "../src/timer-alerts.js";
import { fresh, startSession, planFor } from "../src/training.js";
import { validate } from "../src/storage.js";

const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};
const timer = () => ({
  active: {
    id: "workout",
    pacing: {
      currentId: "rest",
      plan: [{ id: "rest", label: "Rest", role: "rest", seconds: 180 }],
      additions: {},
      breakUsed: 0,
      timer: { startedAt: 100000, pausedMs: 0, pausedAt: null },
    },
  },
});

test("alarm preferences default to loud and enabled and retain an explicit mute", () => {
  const storage = memory();
  assert.deepEqual(readAlertPreferences(storage), { enabled: true, volume: 1 });
  storage.setItem(
    "oly_timer_alerts_v1",
    JSON.stringify({ enabled: false, volume: 0.75 }),
  );
  assert.deepEqual(readAlertPreferences(storage), {
    enabled: false,
    volume: 0.75,
  });
  storage.setItem("oly_timer_alerts_v1", "corrupt");
  assert.deepEqual(readAlertPreferences(storage), { enabled: true, volume: 1 });
});
test("rest deadlines remain absolute, and pause, resume, extension and breaks rearm correctly", () => {
  const s = timer(),
    p = s.active.pacing;
  assert.equal(currentAlarm(s).deadline, 280000);
  p.timer.pausedAt = 110000;
  assert.equal(currentAlarm(s), null);
  p.timer.pausedAt = null;
  p.timer.pausedMs = 20000;
  assert.equal(currentAlarm(s).deadline, 300000);
  p.additions.rest = 60;
  assert.equal(currentAlarm(s).deadline, 360000);
  p.breakRun = { startedAt: 200000, seconds: 120 };
  assert.equal(currentAlarm(s).deadline, 320000);
  assert.match(currentAlarm(s).label, /Break/);
  s.active = null;
  assert.equal(currentAlarm(s), null);
});

test("guided warm-up steps retain individual alarms while the overall preparation is recorded", () => {
  const s = timer();
  s.active.preparationTimer = {
    key: "general",
    startedAt: 90000,
    pausedAt: null,
    pausedMs: 0,
  };
  assert.equal(currentAlarm(s).deadline, 280000);
  s.active.preparationTimer.key = "rewarm";
  assert.equal(currentAlarm(s).deadline, 330000);
  s.active.preparationTimer.pausedAt = 100000;
  assert.equal(currentAlarm(s), null);
});
test("recovery while recording a result and its subsequent rest share one alarm", () => {
  const s = timer(),
    p = s.active.pacing;
  p.plan.unshift({ id: "work", role: "work", label: "Set", seconds: 30 });
  p.currentId = "work";
  p.workEndedAt = 100000;
  const alarm = currentAlarm(s);
  p.currentId = "rest";
  p.workEndedAt = null;
  assert.deepEqual(currentAlarm(s), alarm);
  p.currentId = "work";
  p.timer = null;
  assert.equal(currentAlarm(s), null, "an unstarted work set has no alarm");
});
test("audio file contains the complete delay plus a loud, unclipped repeating alarm", () => {
  const bytes = alarmWave(10),
    header = new DataView(bytes.buffer),
    rate = header.getUint32(24, true),
    audio = bytes.subarray(44);
  assert.equal(rate, 8000);
  assert.equal(audio.length / rate, 70);
  assert(audio.subarray(0, 10 * rate).every((sample) => sample === 128));
  for (const offset of [10, 14, 18, 66]) {
    const burst = audio.subarray(offset * rate, (offset + 0.4) * rate);
    assert(Math.max(...burst) > 220);
    assert(Math.min(...burst) < 36);
    assert(burst.every((sample) => sample > 0 && sample < 255));
  }
  assert(
    audio.subarray(13 * rate, 14 * rate).every((sample) => sample === 128),
  );
  assert.throws(() => alarmWave(7201));
  const quieter = alarmWave(0, 1, 0.5).subarray(44);
  assert(Math.max(...quieter) < 184);
  assert(Math.min(...quieter) > 72);
});
function controller() {
  let now = 0;
  const sources = [],
    navigator = { audioSession: {} },
    document = { visibilityState: "visible" };
  class AudioContext {
    state = "running";
    destination = {};
    resume() {
      this.state = "running";
      return Promise.resolve();
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      const source = {
        started: false,
        stopped: false,
        connect() {},
        disconnect() {},
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(source);
      return source;
    }
  }
  const alerts = new TimerAlerts({
    document,
    navigator,
    storage: memory(),
    now: () => now,
    AudioContext,
  });
  return {
    alerts,
    document,
    navigator,
    sources,
    setTime: (value) => (now = value),
  };
}
test("countdowns play no silent track, use mixable audio, and sound only at the absolute deadline", () => {
  const c = controller(),
    target = { key: "a", label: "Rest", deadline: 10000 };
  c.alerts.sync(target, { gesture: true });
  assert.equal(c.navigator.audioSession.type, "ambient");
  assert.equal(c.alerts.status, "armed");
  assert.equal(c.sources.length, 0);
  c.setTime(10000);
  c.alerts.sync(target);
  assert.equal(c.alerts.status, "playing");
  assert.equal(c.sources.length, 1);
  c.alerts.sync(target);
  assert.equal(c.sources.length, 1);
  c.alerts.acknowledge();
  assert(c.sources[0].stopped);
  c.alerts.sync(target);
  assert.equal(c.alerts.target, null);
});
test("foreground sound can recover after a tap; hidden pages rely on push, not Web Audio", () => {
  const c = controller(),
    target = { key: "a", label: "Rest", deadline: 10000 };
  c.alerts.sync(target);
  c.setTime(12000);
  c.alerts.sync(target);
  assert.equal(c.alerts.status, "blocked");
  c.alerts.sync(target, { gesture: true });
  assert.equal(c.alerts.status, "playing");
  c.alerts.sync(null);
  assert(c.sources[0].stopped);
  c.document.visibilityState = "hidden";
  const next = { ...target, key: "b" };
  c.alerts.sync(next);
  assert.equal(c.sources.length, 1);
  c.document.visibilityState = "visible";
  c.alerts.sync(next, { resuming: true });
  assert.equal(c.sources.length, 2);
  assert.equal(c.alerts.armedAt, 12000);
  c.alerts.save({ enabled: false });
  c.alerts.sync(next);
  assert.equal(c.alerts.target, null);
});
test("the dumbbell-row preference migrates once and preserves active prescriptions and dose", () => {
  const s = fresh("2026-09-21", "weekday", "all-failure");
  assert.equal(s.training.equipment.row, "db");
  const row = planFor(s, "thursday")
    .sessions.flatMap((s) => s.rows)
    .find((e) => e.id === "row");
  assert.match(row.name, /dumbbell row/);
  assert.equal(row.loadUnit, "per dumbbell");
  assert.deepEqual(row.repRange, [8, 12]);
  assert.equal(row.rest, 180);
  s.readiness = {
    date: "2026-09-21",
    level: "green",
    event: "normal",
    local: "",
  };
  startSession(s, "tuesday", "main", Date.parse("2026-09-21T12:00:00-05:00"));
  const active = structuredClone(s.active);
  delete s.training.rowEquipmentRevision;
  s.training.equipment.row = "machine";
  const updated = validate(s);
  assert.equal(updated.training.equipment.row, "db");
  assert.deepEqual(updated.active, active);
  updated.training.equipment.row = "machine";
  assert.equal(
    validate(updated).training.equipment.row,
    "machine",
    "later explicit choices remain available",
  );
});
