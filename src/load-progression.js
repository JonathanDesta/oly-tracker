// User-requested September 27 load rule. This supersedes the PDF's smaller
// increments and two-exposure/held-load rules for recommendations only.
export function perDumbbell(row) {
  return row.loadUnit === "per dumbbell" || /dumbbell/i.test(row.name || "");
}
export function loadRecommendation(row, sets, { complete = true } = {}) {
  const range = row.validRepRange || row.repRange,
    weight = sets.at(-1)?.weight,
    step = perDumbbell(row) ? 5 : 10,
    unit = perDumbbell(row) ? " lb per dumbbell (10 lb for the pair)" : " lb";
  if (!Number.isFinite(weight) || weight <= 0)
    return {
      weight: null,
      text: "Choose your working weight; no comparable load is recorded yet.",
    };
  complete = complete && sets.length > 0 && sets.every((s) => s.valid);
  const below = sets.some((s) => s.valid && s.reps < range[0]);
  if (below) {
    if (weight <= step)
      return {
        weight: null,
        text: `A working set was below ${range[0]} reps. A ${step}${unit} reduction would leave no positive load; choose an available lighter weight.`,
      };
    return {
      weight: weight - step,
      text: `A working set in the previous workout was below ${range[0]} reps: −${step}${unit} from its last working weight.`,
    };
  }
  if (
    complete &&
    sets.length &&
    sets.every((s) => s.valid && s.reps >= range[1])
  )
    return {
      weight: weight + step,
      text: `Every working set in the previous workout reached ${range[1]} reps or more: +${step}${unit}.`,
    };
  return {
    weight,
    text: complete
      ? `Keep the last working weight. Increase only when every working set reaches ${range[1]} reps; decrease if a completed set falls below ${range[0]}.`
      : "Keep the last working weight for reference. The previous workout did not record every prescribed set at the required endpoint; it does not earn an increase.",
  };
}
