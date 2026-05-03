import { describe, it, expect } from 'vitest';
import { unpackPptx } from '../../src/pptx/unpack.js';
import { repackPptx } from '../../src/pptx/repack.js';
import { extractTranslationUnits } from '../../src/pptx/extractor.js';
import { writebackTranslations } from '../../src/pptx/writer.js';
import { TranslationResult, TranslationSource, CliConfig, LangDetectStrategy } from '../../src/types.js';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures');
const SAMPLE_PATH = '/Volumes/Work/Project/pptTranslate/学术论文写作/test.pptx';

const defaultConfig: CliConfig = {
  inputPath: '',
  targetLang: 'en',
  sourceLang: 'auto',
  baseUrl: '',
  apiKey: 'test',
  model: 'test',
  timeout: 120,
  retries: 3,
  retryDelay: 1.5,
  batchSize: 20,
  batchMaxChars: 12000,
  maxWorkers: 8,
  rpm: 1000,
  tpm: 100000,
  includeNotes: false,
  includeMasterLayout: false,
  langDetect: LangDetectStrategy.Cjk,
  verbose: false,
};

function createMockResults(units: { id: string; source: TranslationSource; runs: { text: string }[]; sourceText: string }[]): TranslationResult[] {
  return units.map(unit => {
    if (unit.runs.length > 0) {
      // Mock: translate each run by prefixing with "[T]"
      const parsed = unit.runs.map(r => `[T]${r.text}`);
      return {
        unitId: unit.id,
        translatedText: parsed.join(''),
        markerParsed: parsed,
        usedFallback: false,
        apiCallCount: 1,
      };
    } else {
      return {
        unitId: unit.id,
        translatedText: `[T]${unit.sourceText}`,
        markerParsed: null,
        usedFallback: false,
        apiCallCount: 1,
      };
    }
  });
}

describe('writeback', () => {
  it('should write mock translations back and produce valid PPTX', async () => {
    if (!existsSync(SAMPLE_PATH)) return;

    const archive = await unpackPptx(SAMPLE_PATH);
    const units = await extractTranslationUnits(archive, defaultConfig);
    expect(units.length).toBeGreaterThan(0);

    const results = createMockResults(units);
    writebackTranslations(archive, units, results);

    // Repack
    const outputPath = join(FIXTURES_DIR, 'writeback-test.pptx');
    await repackPptx(archive, outputPath);
    expect(existsSync(outputPath)).toBe(true);

    // Re-unpack and verify translations are present
    const reUnpacked = await unpackPptx(outputPath);

    // Check that some slide XML contains "[T]" marker
    let foundTranslation = false;
    for (const [filename, content] of reUnpacked.xmlFiles) {
      if (filename.includes('slide') && content.includes('[T]')) {
        foundTranslation = true;
        break;
      }
    }
    expect(foundTranslation).toBe(true);

    // Verify XML files count preserved
    const originalXmlCount = archive.xmlFiles.size;
    expect(reUnpacked.xmlFiles.size).toBe(originalXmlCount);

    // Clean up
    unlinkSync(outputPath);
  });

  it('should preserve XML structure after writeback', async () => {
    if (!existsSync(SAMPLE_PATH)) return;

    const archive = await unpackPptx(SAMPLE_PATH);
    const units = await extractTranslationUnits(archive, defaultConfig);

    // Only translate slide-body units for this test
    const slideUnits = units.filter(u => u.source === TranslationSource.SlideBody);
    const slideResults = createMockResults(slideUnits);

    writebackTranslations(archive, slideUnits, slideResults);

    // Verify XML is still parseable
    const slide1Xml = archive.xmlFiles.get('ppt/slides/slide1.xml');
    expect(slide1Xml).toBeTruthy();

    // Verify a:p and a:r structure still exists
    const { DOMParser } = await import('@xmldom/xmldom');
    const doc = new DOMParser().parseFromString(slide1Xml!, 'text/xml');
    const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

    const pElements = doc.getElementsByTagNameNS(NS_A, 'p');
    expect(pElements.length).toBeGreaterThan(0);

    const rElements = doc.getElementsByTagNameNS(NS_A, 'r');
    expect(rElements.length).toBeGreaterThan(0);
  });
});