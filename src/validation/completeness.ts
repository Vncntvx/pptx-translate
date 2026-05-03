import { TranslationUnit, TranslationResult, PreTranslationSnapshot, ValidationReport, FormatWarning } from '../types.js';

export function buildPreTranslationSnapshot(units: TranslationUnit[]): PreTranslationSnapshot {
  return {
    units: units.map(u => ({
      id: u.id,
      sourceText: u.sourceText,
      sourceHash: simpleHash(u.sourceText),
      location: u.location,
    })),
    xmlNodes: [],
  };
}

export function buildValidationReport(
  snapshot: PreTranslationSnapshot,
  results: TranslationResult[],
  xmlFallbackNodes: number,
): ValidationReport {
  const total = snapshot.units.length;
  const translated = results.filter(r => !r.usedFallback && r.translatedText !== '').length;
  const fallback = results.filter(r => r.usedFallback).length;
  const failed = results.filter(r => r.translatedText === '' || r.translatedText === r.unitId).length;

  const missingUnits: string[] = [];
  for (const snapUnit of snapshot.units) {
    const result = results.find(r => r.unitId === snapUnit.id);
    if (!result) {
      missingUnits.push(snapUnit.location);
    }
  }

  // Detect empty translations
  const emptyTranslations = results.filter(r => r.translatedText === '').length;

  // Detect same-as-source translations (possible failures)
  const sameAsSource = results.filter(r => {
    const snap = snapshot.units.find(s => s.id === r.unitId);
    return snap && r.translatedText === snap.sourceText && r.translatedText.trim() !== '';
  }).length;

  const formatWarnings: FormatWarning[] = [];

  return {
    totalSourceUnits: total,
    translatedUnits: translated,
    skippedUnits: 0,
    failedUnits: failed + emptyTranslations,
    fallbackUnits: fallback,
    xmlFallbackNodes,
    missingUnits,
    formatWarnings,
    summary: buildSummary(total, translated, fallback, failed, emptyTranslations, sameAsSource, missingUnits.length, xmlFallbackNodes),
  };
}

function buildSummary(
  total: number,
  translated: number,
  fallback: number,
  failed: number,
  empty: number,
  sameSource: number,
  missing: number,
  xmlNodes: number,
): string {
  const parts: string[] = [];
  parts.push(`Translated ${translated}/${total} units`);
  if (fallback > 0) parts.push(`${fallback} marker fallbacks`);
  if (failed > 0) parts.push(`${failed} failures`);
  if (empty > 0) parts.push(`${empty} empty translations`);
  if (sameSource > 0) parts.push(`${sameSource} unchanged (possible failures)`);
  if (missing > 0) parts.push(`${missing} missing units`);
  parts.push(`${xmlNodes} XML fallback nodes`);
  return parts.join(', ');
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return hash.toString(36);
}