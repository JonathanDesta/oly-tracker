import { DAYS } from "./catalog.js";

// Persisted day keys identify Revision 6 program slots, not civil weekdays.
// Keeping them stable preserves exercise history and frozen workout records.
export const SLOT_LETTERS = {
  monday: "A",
  tuesday: "B",
  thursday: "C",
  friday: "D",
};
export const WEEKDAY_ORDER = [
  "tuesday",
  "thursday",
  "wednesday",
  "monday",
  "friday",
  "saturday",
  "sunday",
];
export const weekdaySchedule = (config) => config.schedule === "weekday";
export const programDays = (config) =>
  weekdaySchedule(config) && config.week !== 12 ? WEEKDAY_ORDER : DAYS;
export const slotOffset = (config, slot) => programDays(config).indexOf(slot);
export const slotLabel = (config, slot) =>
  `${SLOT_LETTERS[slot] ? SLOT_LETTERS[slot] + " · " : ""}${DAYS[slotOffset(config, slot)]}`;
export const primaryAthleticSlot = (config) =>
  weekdaySchedule(config) ? "thursday" : "monday";
export const secondaryAthleticSlot = (config) =>
  weekdaySchedule(config) ? "monday" : "thursday";
export const scheduleName = (config) =>
  config.week === 12
    ? config.workSetPolicy === "all-failure"
      ? "Taper · Monday work, Friday failure benchmark, bench afterward"
      : "Test week · Monday bench, Friday test, bench afterward"
    : weekdaySchedule(config)
      ? "Weekday plan · Mon B / Tue C / Thu A / Fri D"
      : "Source plan · Mon A / Tue B / Thu C / Fri D";

export function setSchedule(config, schedule, now = Date.now()) {
  config.schedule = schedule;
  delete config.nextSchedule;
  config.athletics.day = primaryAthleticSlot(config);
  if (schedule === "weekday") {
    config.split = false;
    config.timing.athleticsVisit = "same";
    config.scheduleTrial = { startedAt: now, weeks: [] };
  } else delete config.scheduleTrial;
}
export const scheduleTrialPending = (config) =>
  weekdaySchedule(config) && (config.scheduleTrial?.weeks.length ?? 2) < 2;

export function migrateSchedule(state) {
  const t = state.training;
  if (t.schedule !== undefined) return state;
  const started =
    state.active ||
    state.records.some((r) => r.weekId === state.weekId) ||
    Object.keys(state.dates).length ||
    state.benchReservations.some((b) => b.weekId === state.weekId);
  if (started || state.completed) {
    t.schedule = "source";
    if (!state.completed) t.nextSchedule = "weekday";
  } else
    setSchedule(
      t,
      "weekday",
      state.updatedAt || Date.parse(state.weekStart + "T12:00:00Z"),
    );
  return state;
}
