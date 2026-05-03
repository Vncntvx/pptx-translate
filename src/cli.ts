import { Command } from 'commander';
import { CliConfig, LangDetectStrategy } from './types.js';
import { main } from './main.js';
import { resolveProviderConfig } from './translation/provider.js';

export function parseCliConfig(): CliConfig {
  const program = new Command();

  program
    .name('ppttr')
    .description('Translate PPTX text while preserving layout and formatting')
    .version('0.2.0')
    .argument('<input>', 'Input .pptx file path')
    .option('-o, --output <path>', 'Output .pptx file path')
    .option('-l, --lang <lang>', 'Target language (required)')
    .option('--source-lang <lang>', 'Source language', process.env.TRANSLATE_SOURCE_LANG || 'auto')
    .option('--provider <name>', 'API provider (env: PROVIDER)', process.env.PROVIDER || 'siliconflow')
    .option('--base-url <url>', 'API base URL (overrides provider preset)')
    .option('--api-key <key>', 'API key (overrides env)')
    .option('--model <model>', 'Model name (overrides provider preset)')
    .option('--timeout <seconds>', 'HTTP timeout', '120')
    .option('--retries <count>', 'Retry attempts per request', '3')
    .option('--retry-delay <seconds>', 'Base retry delay', '1.5')
    .option('--batch-size <count>', 'Texts per API request', process.env.TRANSLATE_BATCH_SIZE || '20')
    .option('--batch-max-chars <chars>', 'Max chars per API request', process.env.TRANSLATE_BATCH_MAX_CHARS || '12000')
    .option('--max-workers <count>', 'Concurrent API workers', process.env.TRANSLATE_MAX_WORKERS || '8')
    .option('--rpm <count>', 'Rate limit: requests/min (overrides provider preset)')
    .option('--tpm <count>', 'Rate limit: tokens/min (overrides provider preset)')
    .option('--include-notes', 'Translate speaker notes')
    .option('--include-master-layout', 'Translate slideMaster/slideLayout text')
    .option('--lang-detect <strategy>', 'Language detection strategy (cjk|all)', 'all')
    .option('--verbose', 'Print each translation location')
    .option('--report <path>', 'Translation report output path');

  program.parse();

  const opts = program.opts();
  const args = program.processedArgs;

  if (!opts.lang) {
    console.error('Error: --lang is required');
    process.exit(1);
  }

  // Resolve provider config from env, then apply CLI overrides
  const providerConfig = resolveProviderConfig(process.env as Record<string, string | undefined>);

  const baseUrl = opts.baseUrl || providerConfig.baseUrl;
  const apiKey = opts.apiKey || providerConfig.apiKey;
  const model = opts.model || providerConfig.model;
  const rpm = opts.rpm ? parseInt(opts.rpm, 10) : providerConfig.rpm;
  const tpm = opts.tpm ? parseInt(opts.tpm, 10) : providerConfig.tpm;

  if (!apiKey) {
    console.error('Error: API key is required. Set it in .env or pass --api-key');
    process.exit(1);
  }

  const langDetect = opts.langDetect === 'cjk' ? LangDetectStrategy.Cjk : LangDetectStrategy.All;

  return {
    inputPath: args[0],
    outputPath: opts.output,
    sourceLang: opts.sourceLang,
    targetLang: opts.lang,
    baseUrl,
    apiKey,
    model,
    timeout: parseInt(opts.timeout, 10),
    retries: parseInt(opts.retries, 10),
    retryDelay: parseFloat(opts.retryDelay),
    batchSize: parseInt(opts.batchSize, 10),
    batchMaxChars: parseInt(opts.batchMaxChars, 10),
    maxWorkers: parseInt(opts.maxWorkers, 10),
    rpm,
    tpm,
    includeNotes: opts.includeNotes ?? false,
    includeMasterLayout: opts.includeMasterLayout ?? false,
    langDetect,
    verbose: opts.verbose ?? false,
    reportPath: opts.report,
  };
}

export function defaultOutputPath(inputPath: string, targetLang: string): string {
  const lastDot = inputPath.lastIndexOf('.');
  const lastSlash = Math.max(inputPath.lastIndexOf('/'), inputPath.lastIndexOf('\\'));
  const stem = lastDot > lastSlash ? inputPath.substring(0, lastDot) : inputPath;
  const ext = lastDot > lastSlash ? inputPath.substring(lastDot) : '.pptx';
  return `${stem}.${targetLang}${ext}`;
}

if (import.meta.main) {
  const config = parseCliConfig();
  main(config).catch(err => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}