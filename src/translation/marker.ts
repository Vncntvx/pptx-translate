import { TextRun } from '../types.js';

export function buildMarkedText(runs: TextRun[]): string {
  return runs.map((run, i) => `[[R${i}]]${run.text}[[/R${i}]]`).join('');
}

export function parseMarkedText(text: string, runCount: number): string[] | null {
  if (runCount === 0) return null;

  const results: string[] = [];

  for (let i = 0; i < runCount; i++) {
    const open = `[[R${i}]]`;
    const close = `[[/R${i}]]`;
    const openIdx = text.indexOf(open);
    if (openIdx === -1) return null;

    const afterOpen = openIdx + open.length;
    const closeIdx = text.indexOf(close, afterOpen);
    if (closeIdx === -1) return null;

    results.push(text.substring(afterOpen, closeIdx));

    // For the next iteration, the remaining text starts after this close tag
    // But we search the full text to ensure markers are in order
  }

  // Verify markers appear in correct sequential order
  let pos = 0;
  for (let i = 0; i < runCount; i++) {
    const open = `[[R${i}]]`;
    const openPos = text.indexOf(open, pos);
    if (openPos < pos) return null; // marker appeared before expected position
    const close = `[[/R${i}]]`;
    const closePos = text.indexOf(close, openPos + open.length);
    pos = closePos + close.length;
  }

  return results;
}