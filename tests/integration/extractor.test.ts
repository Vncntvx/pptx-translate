import { describe, it, expect } from 'vitest';
import { extractTranslationUnits } from '../../src/pptx/extractor.js';
import { unpackPptx } from '../../src/pptx/unpack.js';
import { existsSync } from 'node:fs';
import { CliConfig, LangDetectStrategy } from '../../src/types.js';

const SAMPLE_PATH = '/Volumes/Work/Project/pptTranslate/学术论文写作/test.pptx';

const defaultConfig: CliConfig = {
  inputPath: '',
  targetLang: 'en',
  sourceLang: 'auto',
  baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
  apiKey: 'test-key',
  model: 'test-model',
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

describe('extractor', () => {
  it('should extract translatable units from a real PPTX', async () => {
    const samplePath = SAMPLE_PATH;
    if (!existsSync(samplePath)) return;

    const archive = await unpackPptx(samplePath);
    const units = await extractTranslationUnits(archive, defaultConfig);

    // Should find text units
    expect(units.length).toBeGreaterThan(0);

    // Each unit should have required fields
    for (const unit of units) {
      expect(unit.id).toBeTruthy();
      expect(unit.location).toBeTruthy();
      expect(unit.sourceText).toBeTruthy();
      expect(unit.xmlFilePath).toBeTruthy();
    }
  });

  it('should extract units with run formatting', async () => {
    const samplePath = SAMPLE_PATH;
    if (!existsSync(samplePath)) return;

    const archive = await unpackPptx(samplePath);
    const units = await extractTranslationUnits(archive, defaultConfig);

    // At least some units should have runs with formatting
    const unitsWithRuns = units.filter(u => u.runs.length > 0);
    expect(unitsWithRuns.length).toBeGreaterThan(0);

    // Check run structure
    for (const unit of unitsWithRuns) {
      expect(unit.markedText).toContain('[[R0]]');
      expect(unit.sourceText).toBe(unit.runs.map(r => r.text).join(''));
    }
  });

  it('should extract from tables', async () => {
    const samplePath = SAMPLE_PATH;
    if (!existsSync(samplePath)) return;

    const archive = await unpackPptx(samplePath);
    const units = await extractTranslationUnits(archive, defaultConfig);

    // Check if any table cells were found
    const tableUnits = units.filter(u => u.source === 'table-cell');
    // Note: this PPTX may or may not have tables, so we don't assert count > 0
    // But if table units exist, they should have valid structure
    for (const tu of tableUnits) {
      expect(tu.location).toContain('table');
    }
  });

  it('should extract notes when includeNotes=true', async () => {
    const samplePath = SAMPLE_PATH;
    if (!existsSync(samplePath)) return;

    const archive = await unpackPptx(samplePath);
    const configWithNotes = { ...defaultConfig, includeNotes: true };
    const units = await extractTranslationUnits(archive, configWithNotes);

    const notesUnits = units.filter(u => u.source === 'notes');
    // If notes exist, they should be properly extracted
    for (const nu of notesUnits) {
      expect(nu.location).toContain('notes');
    }
  });

  it('should correctly concatenate sourceText from runs', async () => {
    const samplePath = SAMPLE_PATH;
    if (!existsSync(samplePath)) return;

    const archive = await unpackPptx(samplePath);
    const units = await extractTranslationUnits(archive, defaultConfig);

    const unitsWithRuns = units.filter(u => u.runs.length > 0);
    for (const unit of unitsWithRuns) {
      const concatenated = unit.runs.map(r => r.text).join('');
      expect(unit.sourceText).toBe(concatenated);
    }
  });
});