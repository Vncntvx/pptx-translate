import { TextRun } from '../types.js';

export function distributeTextToRuns(runs: TextRun[], text: string): void {
  if (runs.length === 0) return;
  if (runs.length === 1) {
    runs[0].text = text;
    return;
  }

  const weights = runs.map(r => r.text.length);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) {
    weights.fill(1);
  }
  const adjustedTotal = totalWeight === 0 ? weights.length : totalWeight;

  const textLen = text.length;
  const lengths = weights.map(w => Math.floor((textLen * w) / adjustedTotal));
  let assigned = lengths.reduce((a, b) => a + b, 0);

  // Distribute remainder to runs with largest fractional parts
  if (assigned < textLen) {
    const fractions = weights.map((w, i) => ({
      fraction: (textLen * w) / adjustedTotal - lengths[i],
      index: i,
    }));
    fractions.sort((a, b) => b.fraction - a.fraction);
    for (let k = 0; k < textLen - assigned; k++) {
      lengths[fractions[k].index] += 1;
    }
  }

  let cursor = 0;
  for (let i = 0; i < runs.length; i++) {
    runs[i].text = text.substring(cursor, cursor + lengths[i]);
    cursor += lengths[i];
  }

  // Safety: any remaining chars go to last run
  if (cursor < textLen) {
    runs[runs.length - 1].text += text.substring(cursor);
  }
}