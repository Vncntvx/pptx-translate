import { CliConfig, PptxArchive, TranslationUnit, TranslationResult, PreTranslationSnapshot, ValidationReport, PipelineProgress, FormatWarning } from './types.js';
import { unpackPptx } from './pptx/unpack.js';
import { repackPptx } from './pptx/repack.js';
import { extractTranslationUnits } from './pptx/extractor.js';
import { writebackTranslations } from './pptx/writer.js';
import { translateXmlFallback } from './pptx/xml-fallback.js';
import { buildPreTranslationSnapshot, buildValidationReport } from './validation/completeness.js';
import { generateReport } from './validation/report-generator.js';
import { collectOverflowChecks } from './run-preservation/overflow.js';
import { compareRunFormatArrays } from './run-preservation/format-guard.js';
import { TranslationService } from './translation/service.js';
import { defaultOutputPath } from './cli.js';
import { existsSync } from 'node:fs';

export async function main(config: CliConfig): Promise<void> {
  if (!existsSync(config.inputPath)) {
    throw new Error(`Input file not found: ${config.inputPath}`);
  }
  if (!config.inputPath.toLowerCase().endsWith('.pptx')) {
    throw new Error('Only .pptx files are supported');
  }

  const outputPath = config.outputPath || defaultOutputPath(config.inputPath, config.targetLang);
  const startTime = Date.now();

  console.log(`Translating: ${config.inputPath}`);
  console.log(`  Source: ${config.sourceLang}, Target: ${config.targetLang}`);
  console.log(`  Model: ${config.model}`);

  // Unpack
  logProgress({ phase: 'unpack', current: 0, total: 1, message: 'Unpacking PPTX...' });
  const archive = await unpackPptx(config.inputPath);

  // Extract
  logProgress({ phase: 'extract', current: 0, total: 1, message: 'Extracting translatable text...' });
  const units = await extractTranslationUnits(archive, config);

  if (units.length === 0) {
    logProgress({ phase: 'repack', current: 0, total: 1, message: 'No translatable text found.' });
    await repackPptx(archive, outputPath);
    console.log(`No translatable text found. Saved as: ${outputPath}`);
    return;
  }

  console.log(`Found ${units.length} translatable units`);

  // Snapshot
  const snapshot = buildPreTranslationSnapshot(units);

  // Translate
  const translator = new TranslationService(config);
  logProgress({ phase: 'translate', current: 0, total: units.length, message: `Translating ${units.length} units...` });
  const results = await translator.translateBatch(units);

  const cacheStats = translator.getCacheStats();
  console.log(`Translation done: ${translator.getApiCallCount()} API calls, ${cacheStats.dedupSavings} deduplicated`);

  // Writeback
  logProgress({ phase: 'writeback', current: 0, total: results.length, message: 'Writing translations back...' });
  writebackTranslations(archive, units, results);

  // Format checks
  const overflowChecks = collectOverflowChecks(units, results);
  const formatWarnings: FormatWarning[] = [];

  for (const check of overflowChecks) {
    formatWarnings.push({
      location: check.location,
      type: 'font-size-overflow',
      detail: `fontSize ${check.originalSize} to ${check.suggestedSize} (text expanded >30%)`,
    });
  }

  // XML fallback
  logProgress({ phase: 'xml-fallback', current: 0, total: 1, message: 'XML fallback pass...' });
  const xmlResult = await translateXmlFallback(archive, translator, config);
  console.log(`XML fallback: translated ${xmlResult.nodesTranslated} text nodes`);

  // Validation
  logProgress({ phase: 'validate', current: 0, total: 1, message: 'Validating completeness...' });
  const validationReport = buildValidationReport(snapshot, results, xmlResult.nodesTranslated);
  validationReport.formatWarnings.push(...formatWarnings);

  // Repack
  logProgress({ phase: 'repack', current: 0, total: 1, message: 'Repacking PPTX...' });
  await repackPptx(archive, outputPath);

  // Report
  const durationMs = Date.now() - startTime;
  const report = generateReport(config, snapshot, results, validationReport, xmlResult, durationMs, outputPath);

  console.log(`Done. Output: ${outputPath}`);
  console.log(`  Translated: ${validationReport.translatedUnits}/${validationReport.totalSourceUnits}`);
  if (validationReport.fallbackUnits > 0) {
    console.log(`  Fallback (marker lost): ${validationReport.fallbackUnits}`);
  }
  if (validationReport.failedUnits > 0) {
    console.log(`  Failed: ${validationReport.failedUnits}`);
  }
  if (formatWarnings.length > 0) {
    console.log(`  Format warnings: ${formatWarnings.length}`);
  }
  console.log(`  XML fallback nodes: ${xmlResult.nodesTranslated}`);
  console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);

  if (config.reportPath) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(config.reportPath, JSON.stringify(report, null, 2));
    console.log(`  Report: ${config.reportPath}`);
  }
}

function logProgress(progress: PipelineProgress): void {
  if (progress.phase === 'translate') return;
  console.log(`[${progress.phase}] ${progress.message}`);
}