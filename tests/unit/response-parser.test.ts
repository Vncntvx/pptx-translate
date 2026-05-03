import { describe, it, expect } from 'vitest';
import { parseJsonArray } from '../../src/translation/response-parser.js';

describe('parseJsonArray', () => {
  it('should parse a valid JSON array', () => {
    const result = parseJsonArray('["hello", "world"]', 2);
    expect(result).toEqual(['hello', 'world']);
  });

  it('should extract array from markdown-wrapped content', () => {
    const content = '```json\n["hello", "world"]\n```';
    const result = parseJsonArray(content, 2);
    expect(result).toEqual(['hello', 'world']);
  });

  it('should extract from dict wrapper', () => {
    const content = '{"translations": ["hello", "world"]}';
    const result = parseJsonArray(content, 2);
    expect(result).toEqual(['hello', 'world']);
  });

  it('should try other dict keys', () => {
    const content = '{"data": ["hello", "world"]}';
    const result = parseJsonArray(content, 2);
    expect(result).toEqual(['hello', 'world']);
  });

  it('should throw on length mismatch', () => {
    expect(() => parseJsonArray('["hello"]', 2)).toThrow();
  });

  it('should throw on completely invalid content', () => {
    expect(() => parseJsonArray('not json at all', 1)).toThrow();
  });

  it('should convert non-string items to strings', () => {
    const content = '["hello", 42]';
    const result = parseJsonArray(content, 2);
    expect(result).toEqual(['hello', '42']);
  });

  it('should handle CJK text in array', () => {
    const content = '["你好", "世界"]';
    const result = parseJsonArray(content, 2);
    expect(result).toEqual(['你好', '世界']);
  });
});