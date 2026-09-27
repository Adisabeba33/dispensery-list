/**
 * The lab's numbers as one string, so the same batch can be found on two
 * shelves.
 *
 * A menu copies its panel from the batch's certificate, so one batch in two
 * shops carries the same figures, while two batches — even of one strain from
 * one grower — are tested apart and come out different. Agreement is only
 * evidence when there is enough of it: THC and at least four quantified
 * compounds, to the hundredth. With fewer, unrelated jars agree by chance.
 * A shop that prints one decimal where another prints two will not match;
 * a missed match is cheaper than a false one.
 */
export const LAB_PANEL_MIN_COMPOUNDS = 4;

const figure = (n) => String(Math.round(n * 100) / 100);

export const labPanelKeyOf = (thcPercent, profile) => {
  if (typeof thcPercent !== 'number' || thcPercent <= 0 || !Array.isArray(profile)) return null;
  const byName = new Map();
  for (const t of profile) {
    // OTHER is a bucket, not a compound: two different unknowns would agree.
    if (!t || t.name === 'OTHER' || typeof t.percent !== 'number' || t.percent <= 0) continue;
    byName.set(t.name, Math.max(byName.get(t.name) ?? 0, t.percent));
  }
  if (byName.size < LAB_PANEL_MIN_COMPOUNDS) return null;
  const compounds = [...byName].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, v]) => `${name}:${figure(v)}`);
  return [`THC:${figure(thcPercent)}`, ...compounds].join('|');
};
