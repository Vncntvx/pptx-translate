import { RunFormat, FormatWarning } from '../types.js';

export function compareRunFormats(
  original: RunFormat,
  translated: RunFormat,
  location: string,
): FormatWarning | null {
  const mismatches: string[] = [];

  // Bold
  if (original.bold !== undefined && original.bold !== translated.bold) {
    mismatches.push(`bold: original=${original.bold}, translated=${translated.bold}`);
  }

  // Italic
  if (original.italic !== undefined && original.italic !== translated.italic) {
    mismatches.push(`italic: original=${original.italic}, translated=${translated.italic}`);
  }

  // Font size (significant change > 20%)
  if (original.fontSize !== undefined && translated.fontSize !== undefined) {
    const ratio = translated.fontSize / original.fontSize;
    if (ratio < 0.8 || ratio > 1.2) {
      mismatches.push(`fontSize: original=${original.fontSize}, translated=${translated.fontSize}`);
    }
  }

  // Font family
  if (original.fontFamily !== undefined && original.fontFamily !== translated.fontFamily) {
    mismatches.push(`fontFamily: original=${original.fontFamily}, translated=${translated.fontFamily || '(none)'}`);
  }

  // Color
  if (original.color !== undefined && original.color !== translated.color) {
    mismatches.push(`color: original=${original.color}, translated=${translated.color || '(none)'}`);
  }

  // Underline
  if (original.underline !== undefined && original.underline !== translated.underline) {
    mismatches.push(`underline: original=${original.underline}, translated=${translated.underline}`);
  }

  // Strike
  if (original.strike !== undefined && original.strike !== translated.strike) {
    mismatches.push(`strike: original=${original.strike}, translated=${translated.strike}`);
  }

  // Check for missing attributes (format lost)
  const originalKeys = Object.keys(original) as (keyof RunFormat)[];
  const translatedKeys = Object.keys(translated) as (keyof RunFormat)[];
  const missingKeys = originalKeys.filter(k => k !== 'dirty' && translated[k] === undefined);
  if (missingKeys.length > 0 && mismatches.length === 0) {
    // Some original format attributes were lost
    mismatches.push(`lost attributes: ${missingKeys.join(', ')}`);
  }

  if (mismatches.length === 0) return null;

  return {
    location,
    type: 'attribute-mismatch',
    detail: mismatches.join('; '),
  };
}

export function compareRunFormatArrays(
  originalRuns: RunFormat[],
  translatedRuns: RunFormat[],
  location: string,
): FormatWarning[] {
  const warnings: FormatWarning[] = [];

  // Check run count
  if (originalRuns.length !== translatedRuns.length) {
    warnings.push({
      location,
      type: 'run-structure-loss',
      detail: `run count changed: original=${originalRuns.length}, translated=${translatedRuns.length}`,
    });
  }

  // Compare format attributes for each run
  const maxRuns = Math.max(originalRuns.length, translatedRuns.length);
  for (let i = 0; i < maxRuns; i++) {
    const orig = originalRuns[i] || {};
    const trans = translatedRuns[i] || {};
    const warning = compareRunFormats(orig, trans, `${location}/run${i}`);
    if (warning) warnings.push(warning);
  }

  return warnings;
}