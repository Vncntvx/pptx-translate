import { CliConfig, PreTranslationSnapshot, TranslationResult, ValidationReport, TranslationReport, TranslationUnitReport, TranslationSource } from '../types.js';

export function generateReport(
  config: CliConfig,
  snapshot: PreTranslationSnapshot,
  results: TranslationResult[],
  validationReport: ValidationReport,
  xmlResult: { nodesTranslated: number; filesModified: string[] },
  durationMs: number,
  outputPath: string,
): TranslationReport {
  // Build per-unit detail report
  const unitDetails: TranslationUnitReport[] = [];

  for (const result of results) {
    const snapUnit = snapshot.units.find(s => s.id === result.unitId);
    const status = determineStatus(result);
    unitDetails.push({
      id: result.unitId,
      location: snapUnit?.location || '',
      source: 'slide-body' as TranslationSource,
      sourceText: snapUnit?.sourceText || '',
      translatedText: result.translatedText,
      status,
      markerPreserved: result.markerParsed !== null,
      fallbackReason: result.fallbackReason,
    });
  }

  return {
    ...validationReport,
    unitDetails,
    timestamp: new Date().toISOString(),
    inputPath: config.inputPath,
    outputPath,
    sourceLang: config.sourceLang,
    targetLang: config.targetLang,
    model: config.model,
    totalApiCalls: results.reduce((sum, r) => sum + r.apiCallCount, 0),
    totalTokensEstimated: 0,
    durationMs,
  };
}

function determineStatus(result: TranslationResult): 'success' | 'fallback' | 'failed' | 'skipped' {
  if (result.translatedText === '') return 'failed';
  if (result.usedFallback) return 'fallback';
  return 'success';
}