import { describe, it, expect } from 'vitest';
import { BatchChunker } from '../../src/translation/batch-chunker.js';

describe('BatchChunker', () => {
  it('should create single chunk for small input', () => {
    const chunker = new BatchChunker(20, 12000);
    const chunks = chunker.buildChunks(['short text']);
    expect(chunks.length).toBe(1);
    expect(chunks[0].texts).toEqual(['short text']);
  });

  it('should split by batch size', () => {
    const chunker = new BatchChunker(3, 100000);
    const texts = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const chunks = chunker.buildChunks(texts);
    expect(chunks.length).toBe(3); // 3+3+1
    expect(chunks[0].texts.length).toBe(3);
    expect(chunks[1].texts.length).toBe(3);
    expect(chunks[2].texts.length).toBe(1);
  });

  it('should split by character limit', () => {
    const chunker = new BatchChunker(100, 15);
    const texts = ['short', 'medium text here', 'tiny'];
    const chunks = chunker.buildChunks(texts);
    // "medium text here" alone exceeds 15 chars
    expect(chunks.length).toBe(3);
  });

  it('should handle empty input', () => {
    const chunker = new BatchChunker(20, 12000);
    const chunks = chunker.buildChunks([]);
    expect(chunks.length).toBe(0);
  });

  it('should estimate tokens in chunks', () => {
    const chunker = new BatchChunker(20, 12000);
    const chunks = chunker.buildChunks(['hello world', 'test']);
    expect(chunks[0].estimatedTokens).toBeGreaterThan(0);
  });
});