# ppttr

Translate PowerPoint presentations while preserving layout, formatting, and structure.

ppttr directly manipulates OpenXML inside PPTX files using a two-pass pipeline: structured extraction with run-marker translation in Pass 1, and XML-level fallback coverage in Pass 2. This ensures maximum text coverage (shapes, tables, group shapes, charts, SmartArt, notes, slide masters, layouts) without breaking formatting.

## Features

- Format preservation: bold, italic, fonts, colors, run structure, and layout stay intact
- Full coverage: slides, tables, group shapes, charts, SmartArt, notes, slide masters/layouts
- Two-pass engine: structured extraction + XML fallback for zero missed text
- Multi-provider: SiliconFlow, OpenAI, DeepSeek, OpenRouter, or any OpenAI-compatible API
- Deduplication: identical texts only translated once per run
- Validation report: JSON report with per-unit status, completeness check, format warnings
- Dual entry: `bun run src/cli.ts` for Node.js, `ppttr` for Python

## Quick Start

```bash
bun install
bun run build

# Node.js entry
bun run src/cli.ts input.pptx -l en

# Python entrygigit 
ppttr input.pptx -l en
```

## Configuration

Create a `.env` file in the project root:

```env
# Select provider: siliconflow, openai, deepseek, openrouter, custom
PROVIDER=siliconflow

# SiliconFlow
SILICONFLOW_API_KEY=sk-xxx

# OpenAI
# PROVIDER=openai
# OPENAI_API_KEY=sk-xxx

# DeepSeek
# PROVIDER=deepseek
# DEEPSEEK_API_KEY=sk-xxx

# OpenRouter
# PROVIDER=openrouter
# OPENROUTER_API_KEY=sk-or-xxx

# Custom (any OpenAI-compatible endpoint)
# PROVIDER=custom
# CUSTOM_BASE_URL=https://your-api.example.com/v1
# CUSTOM_API_KEY=your-key
# CUSTOM_MODEL=your-model
```

Provider defaults:

| Provider | Base URL | Model | RPM | TPM |
|----------|----------|-------|-----|-----|
| siliconflow | api.siliconflow.cn/v1 | deepseek-ai/DeepSeek-V3.2 | 1000 | 100000 |
| openai | api.openai.com/v1 | gpt-4o | 500 | 300000 |
| deepseek | api.deepseek.com/v1 | deepseek-chat | 60 | 100000 |
| openrouter | openrouter.ai/api/v1 | openai/gpt-4o | 100 | 200000 |

## CLI Options

```
ppttr <input> -l <lang> [options]

Required:
  -l <lang>                   Target language (en, zh, ja, de, fr, etc.)

Provider:
  --provider <name>            API provider (default: siliconflow)
  --api-key <key>              API key (overrides env)
  --model <model>              Model name (overrides provider default)
  --base-url <url>             API base URL (overrides provider default)
  --rpm <count>                Rate limit: requests/min
  --tpm <count>                Rate limit: tokens/min

Translation:
  --source-lang <lang>         Source language (default: auto)
  --batch-size <count>         Texts per API request (default: 20)
  --batch-max-chars <chars>    Max chars per API request (default: 12000)
  --max-workers <count>        Concurrent API workers (default: 8)
  --lang-detect <strategy>     Language detection: cjk or all (default: all)

Scope:
  --include-notes              Translate speaker notes
  --include-master-layout      Translate slideMaster/slideLayout text

Output:
  -o <path>                    Output PPTX path
  --report <path>              JSON translation report path
  --verbose                    Show each translation with source and target text

Advanced:
  --timeout <seconds>          HTTP timeout (default: 120)
  --retries <count>            Retry attempts (default: 3)
  --retry-delay <seconds>      Base retry delay (default: 1.5)
```

## Examples

```bash
ppttr presentation.pptx -l en
ppttr presentation.pptx -l zh
ppttr slides.pptx -l ja --include-notes --verbose
ppttr input.pptx -l fr -o output.pptx --report report.json
ppttr input.pptx -l de --provider openai

bun run src/cli.ts input.pptx -l en
```

## Architecture

```
PPTX Input
  [1] JSZip Unpack
  [2] Pass 1: Structured Extraction
  [3] Pre-translation Snapshot
  [4] Batch Translation (dedup + cache + chunk + rate limit + retry)
  [5] Writeback (marker or weighted distribution fallback)
  [6] Pass 2: XML Fallback (uncovered text nodes)
  [7] Validation + Format Check
  [8] JSZip Repack
  [9] JSON Report
  PPTX Output
```

## Development

```bash
bun install
bun test
bun run build
bun run src/cli.ts input.pptx -l en
```

## Project Structure

```
src/
  cli.ts                   CLI + provider resolution
  main.ts                  Pipeline orchestration
  types.ts                  Type definitions
  pptx/
    unpack.ts              JSZip PPTX unpacking
    repack.ts              JSZip PPTX repacking
    extractor.ts           Pass 1 structured text extraction
    writer.ts              Pass 1 structured writeback
    xml-fallback.ts        Pass 2 XML-level fallback
    chart-deep.ts          Chart axis/legend/series/category extraction
    smart-art.ts           SmartArt diagram extraction
    slide-master.ts        SlideMaster/Layout extraction
    relationships.ts       PPTX .rels file parsing
  translation/
    service.ts             Translation orchestrator
    provider.ts            Multi-provider configuration resolver
    prompt-builder.ts      LLM prompt construction
    response-parser.ts     JSON array parsing with fallbacks
    marker.ts              Run marker build/parse
    batch-chunker.ts       Batch splitting by count and chars
    cache.ts               Deduplication cache
    rate-limiter.ts        Dual token-bucket RPM+TPM limiter
  run-preservation/
    distribute.ts          Weighted text distribution across runs
    format-guard.ts        Format attribute comparison
    overflow.ts            Font-size overflow detection
  validation/
    completeness.ts        Translation completeness check
    report-generator.ts    JSON report generation
    diff-checker.ts        XML diff comparison
  utils/
    lang-detect.ts         Language detection (CJK/all)
    xml-namespaces.ts      OpenXML namespace constants
    text-utils.ts          Text padding and utilities

tests/
  unit/                     114 unit tests
  integration/              Unpack-repack, extractor, writeback

wrapper.py                  Python CLI facade (uv entry point)
pyproject.toml              Python packaging (zero deps, stdlib only)
```

## License

MIT