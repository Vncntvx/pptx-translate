import { describe, it, expect } from 'vitest';
import { unpackPptx } from '../../src/pptx/unpack.js';
import { extractTranslationUnits } from '../../src/pptx/extractor.js';
import { extractChartDeepText } from '../../src/pptx/chart-deep.js';
import { CliConfig, TranslationSource } from '../../src/types.js';

const chartConfig: CliConfig = {
  inputPath: 'tests/fixtures/chart.pptx',
  sourceLang: 'zh',
  targetLang: 'en',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  batchSize: 20,
  batchMaxChars: 8000,
  maxWorkers: 5,
  rpm: 60,
  tpm: 100000,
  includeNotes: false,
  includeMasterLayout: false,
  langDetect: 'cjk' as any,
  verbose: false,
};

describe('Chart deep extraction', () => {
  it('should extract chart title from chart PPTX', async () => {
    const archive = await unpackPptx('tests/fixtures/chart.pptx');
    const units = await extractTranslationUnits(archive, chartConfig);

    // Should find chart title
    const titleUnits = units.filter(u => u.source === TranslationSource.ChartTitle);
    expect(titleUnits.length).toBeGreaterThan(0);
    expect(titleUnits.some(u => u.sourceText.includes('季度销售报告'))).toBe(true);
  });

  it('should extract series names from chart', async () => {
    const archive = await unpackPptx('tests/fixtures/chart.pptx');
    const units = await extractTranslationUnits(archive, chartConfig);

    const seriesUnits = units.filter(u => u.source === TranslationSource.ChartSeriesName);
    expect(seriesUnits.length).toBeGreaterThan(0);
    expect(seriesUnits.some(u => u.sourceText === '销售额')).toBe(true);
    expect(seriesUnits.some(u => u.sourceText === '收入')).toBe(true);
  });

  it('should extract category names from chart', async () => {
    const archive = await unpackPptx('tests/fixtures/chart.pptx');
    const units = await extractTranslationUnits(archive, chartConfig);

    const catUnits = units.filter(u => u.source === TranslationSource.ChartAxis);
    expect(catUnits.length).toBeGreaterThan(0);
    expect(catUnits.some(u => u.sourceText === '第一季度')).toBe(true);
  });

  it('should handle direct chart-deep extraction', async () => {
    const archive = await unpackPptx('tests/fixtures/chart.pptx');
    const chartFile = 'ppt/charts/chart1.xml';
    const units = extractChartDeepText(archive, chartFile, 0);

    // Should extract series names and category names
    expect(units.length).toBeGreaterThan(0);

    // Series names
    const seriesUnits = units.filter(u => u.source === TranslationSource.ChartSeriesName);
    expect(seriesUnits.length).toBe(2);

    // Category names
    const catUnits = units.filter(u => u.source === TranslationSource.ChartAxis);
    expect(catUnits.length).toBeGreaterThan(0);
  });

  it('should skip pure numeric values in strCache', async () => {
    const archive = await unpackPptx('tests/fixtures/chart.pptx');
    const chartFile = 'ppt/charts/chart1.xml';
    const units = extractChartDeepText(archive, chartFile, 0);

    // No numeric series values should be extracted as translation units
    const numericUnits = units.filter(u => /^[\d.,]+$/.test(u.sourceText.trim()));
    expect(numericUnits.length).toBe(0);
  });
});