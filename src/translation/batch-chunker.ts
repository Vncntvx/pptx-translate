import { BatchChunk } from '../types.js';

export class BatchChunker {
  private batchSize: number;
  private batchMaxChars: number;

  constructor(batchSize: number, batchMaxChars: number) {
    this.batchSize = Math.max(1, batchSize);
    this.batchMaxChars = Math.max(1, batchMaxChars);
  }

  buildChunks(texts: string[]): BatchChunk[] {
    const chunks: BatchChunk[] = [];
    let current: string[] = [];
    let currentChars = 0;
    let chunkIdx = 0;

    for (const text of texts) {
      const textLen = Math.max(1, text.length);
      if (current.length > 0 && (current.length >= this.batchSize || currentChars + textLen > this.batchMaxChars)) {
        chunks.push({
          texts: current,
          chunkId: `chunk-${chunkIdx++}`,
          estimatedTokens: estimateTokens(current),
        });
        current = [];
        currentChars = 0;
      }
      current.push(text);
      currentChars += textLen;
    }

    if (current.length > 0) {
      chunks.push({
        texts: current,
        chunkId: `chunk-${chunkIdx++}`,
        estimatedTokens: estimateTokens(current),
      });
    }

    return chunks;
  }
}

function estimateTokens(texts: string[]): number {
  return texts.reduce((sum, t) => sum + Math.max(1, t.length / 2), 0) + 800;
}