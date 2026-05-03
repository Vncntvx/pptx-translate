import { CliConfig, TranslationUnit, TranslationResult, BatchChunk } from '../types.js';
import { BatchChunker } from './batch-chunker.js';
import { TranslationCache } from './cache.js';
import { DualRateLimiter } from './rate-limiter.js';
import { parseMarkedText } from './marker.js';
import { buildBatchPrompt, buildSinglePrompt, ChatPayload } from './prompt-builder.js';
import { parseJsonArray } from './response-parser.js';
import pLimitFn from 'p-limit';
const pLimit = pLimitFn.default || pLimitFn;

export class TranslationService {
  private config: CliConfig;
  private rateLimiter: DualRateLimiter;
  private cache: TranslationCache;
  private chunker: BatchChunker;
  private limit: ReturnType<typeof pLimit>;
  private apiCallCount = 0;
  private verbose: boolean;
  private totalSourceTexts = 0;
  private totalMissingTexts = 0;

  constructor(config: CliConfig) {
    this.config = config;
    this.rateLimiter = new DualRateLimiter(config.rpm, config.tpm);
    this.cache = new TranslationCache();
    this.chunker = new BatchChunker(config.batchSize, config.batchMaxChars);
    this.limit = pLimit(config.maxWorkers);
    this.verbose = config.verbose;
  }

  async translateBatch(units: TranslationUnit[]): Promise<TranslationResult[]> {
    if (units.length === 0) return [];

    // Build payloads (marked text for multi-run, source text for single/zero-run)
    const payloads = units.map(u => u.runs.length > 0 ? u.markedText : u.sourceText);
    this.totalSourceTexts = payloads.length;

    // Deduplicate and cache lookup
    const { missingTexts } = this.cache.deduplicate(payloads);
    this.totalMissingTexts = missingTexts.length;

    // Translate missing texts
    if (missingTexts.length > 0) {
      const chunks = this.chunker.buildChunks(missingTexts);

      // Translate chunks concurrently with rate limiting
      const chunkPromises = chunks.map(chunk =>
        this.limit(() => this.translateChunk(chunk))
      );

      const chunkResults = await Promise.all(chunkPromises);

      // Store translations in cache
      for (let ci = 0; ci < chunkResults.length; ci++) {
        const texts = chunks[ci].texts;
        const translations = chunkResults[ci];
        for (let i = 0; i < texts.length; i++) {
          if (translations[i] !== undefined && translations[i] !== null) {
            this.cache.set(texts[i], translations[i]);
          }
        }
      }
    }

    // Build full result array from cache
    const translatedPayloads: string[] = [];
    for (const payload of payloads) {
      const cached = this.cache.get(payload);
      translatedPayloads.push(cached !== undefined ? cached : payload);
    }

    // Map back to TranslationResult per unit
    const results: TranslationResult[] = [];
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const translated = translatedPayloads[i];
      const hasMarkers = unit.runs.length > 0;
      const markerParsed = hasMarkers ? parseMarkedText(translated, unit.runs.length) : null;
      const usedFallback = hasMarkers && markerParsed === null;

      // For marker-preserved translations, extract clean text from parsed markers
      let finalTranslatedText = translated;
      if (markerParsed !== null) {
        // Marker parsed successfully
        finalTranslatedText = markerParsed.join('');
      } else if (usedFallback) {
        // Marker lost, strip leftover markers
        finalTranslatedText = translated.replace(/\[\[R\d+\]\]/g, '').replace(/\[\[\/R\d+\]\]/g, '');
      }

      results.push({
        unitId: unit.id,
        translatedText: finalTranslatedText,
        markerParsed,
        usedFallback,
        fallbackReason: usedFallback ? 'marker-lost' : undefined,
        apiCallCount: 0,
      });

      if (this.verbose) {
        const srcPreview = unit.sourceText.substring(0, 30);
        const trPreview = finalTranslatedText.substring(0, 30);
        console.log(`[${i + 1}/${units.length}] ${unit.location}: "${srcPreview}" to "${trPreview}"`);
      }
    }

    return results;
  }

  async translateSingle(text: string): Promise<string> {
    const hasMarkers = text.includes('[[R0]]');
    const payload = buildSinglePrompt(text, this.config, hasMarkers);
    const estimatedTokens = estimateTokens([text]);

    await this.rateLimiter.acquire(estimatedTokens);
    const content = await this.requestChatCompletion(payload, estimatedTokens);
    this.apiCallCount++;

    let result = content.trim();
    // Strip markdown fences if present
    result = stripFences(result);
    return result;
  }

  private async translateChunk(chunk: BatchChunk): Promise<string[]> {
    const payload = buildBatchPrompt(chunk.texts, this.config);

    try {
      await this.rateLimiter.acquire(chunk.estimatedTokens);
      const content = await this.requestChatCompletion(payload, chunk.estimatedTokens);
      this.apiCallCount++;
      return parseJsonArray(content, chunk.texts.length);
    } catch (err) {
      // Batch parsing failed, try recursive split
      if (chunk.texts.length === 1) {
        const singleResult = await this.translateSingle(chunk.texts[0]);
        return [singleResult];
      }

      const mid = chunk.texts.length >> 1;
      const left = { texts: chunk.texts.slice(0, mid), chunkId: chunk.chunkId + '-L', estimatedTokens: estimateTokens(chunk.texts.slice(0, mid)) };
      const right = { texts: chunk.texts.slice(mid), chunkId: chunk.chunkId + '-R', estimatedTokens: estimateTokens(chunk.texts.slice(mid)) };

      const leftResult = await this.translateChunk(left);
      const rightResult = await this.translateChunk(right);
      return [...leftResult, ...rightResult];
    }
  }

  private async requestChatCompletion(payload: ChatPayload, estimatedTokens: number): Promise<string> {
    const url = normalizeEndpoint(this.config.baseUrl);
    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.timeout * 1000),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          lastError = new Error(`HTTP ${response.status}: ${response.statusText} ${body.substring(0, 200)}`);

          // Don't retry on 4xx client errors except 429 rate limit
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw lastError;
          }
        } else {
          const data = await response.json() as any;
          const content = data.choices?.[0]?.message?.content || '';
          return content;
        }
      } catch (e: any) {
        lastError = e;
      }

      if (attempt < this.config.retries) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random());
        if (this.verbose) {
          console.log(`[retry] Attempt ${attempt} failed, retrying in ${delay.toFixed(1)}s...`);
        }
        await sleep(delay);
      }
    }

    throw new Error(`Translation request failed after ${this.config.retries} attempts: ${lastError?.message}`);
  }

  getApiCallCount(): number {
    return this.apiCallCount;
  }

  getCacheStats(): { total: number; missing: number; cached: number; dedupSavings: number } {
    return {
      total: this.totalSourceTexts,
      missing: this.totalMissingTexts,
      cached: this.totalSourceTexts - this.totalMissingTexts,
      dedupSavings: this.totalSourceTexts - this.totalMissingTexts,
    };
  }
}

function normalizeEndpoint(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  // Don't double-add /chat/completions
  if (url.endsWith('/chat/completions')) return url;
  // Add /chat/completions to the base URL
  if (url.endsWith('/v1') || url.endsWith('/v1/')) {
    url = url.replace(/\/+$/, '') + '/chat/completions';
  } else {
    url += '/chat/completions';
  }
  return url;
}

function estimateTokens(texts: string[]): number {
  return texts.reduce((sum, t) => sum + Math.max(1, t.length / 2), 0) + 800;
}

function stripFences(text: string): string {
  // Remove markdown code fences
  let result = text.trim();
  if (result.startsWith('```')) {
    result = result.replace(/^```(?:json|JSON)?\s*\n?/, '');
    result = result.replace(/\n?```\s*$/, '');
  }
  return result.trim();
}

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}