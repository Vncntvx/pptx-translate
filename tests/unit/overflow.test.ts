import { describe, it, expect } from 'vitest';
import { checkOverflow, collectOverflowChecks } from '../../src/run-preservation/overflow.js';
import { TranslationUnit, TranslationResult, TranslationSource } from '../../src/types.js';

describe('overflow', () => {
  describe('checkOverflow', () => {
    it('should return null when text is shorter or same length', () => {
      const result = checkOverflow('Hello', '你好', 1200);
      expect(result).toBeNull();
    });

    it('should return null when text expands less than 30%', () => {
      const result = checkOverflow('Hello there friend', '你好朋友', 1200);
      expect(result).toBeNull();
    });

    it('should detect overflow when text expands more than 30%', () => {
      const result = checkOverflow('Hi', 'This is a very long translated text', 1200);
      expect(result).not.toBeNull();
      expect(result!.needsAdjustment).toBe(true);
      expect(result!.originalSize).toBe(1200);
      expect(result!.suggestedSize).toBeLessThan(1200);
    });

    it('should never suggest size below 60% of original', () => {
      const result = checkOverflow('a', 'This is an extremely long translation', 1200);
      expect(result!.suggestedSize).toBeGreaterThanOrEqual(Math.floor(1200 * 0.6));
    });

    it('should return null for zero fontSize', () => {
      const result = checkOverflow('Hi', 'Long translation', 0);
      expect(result).toBeNull();
    });
  });

  describe('collectOverflowChecks', () => {
    it('should collect overflow warnings from units with fontSize', () => {
      const units: TranslationUnit[] = [{
        id: 'u1',
        location: 'slide0/shape0/p0',
        source: TranslationSource.SlideBody,
        runs: [{ index: 0, text: '短文本', format: { fontSize: 1200 } }],
        sourceText: '短文本',
        markedText: '[[R0]]短文本[[/R0]]',
        xmlFilePath: 'ppt/slides/slide1.xml',
        xmlNodePath: 'slide0/shape0/p0',
      }];

      const results: TranslationResult[] = [{
        unitId: 'u1',
        translatedText: 'This is a much longer translated version of the text',
        markerParsed: null,
        usedFallback: false,
        apiCallCount: 1,
      }];

      const checks = collectOverflowChecks(units, results);
      expect(checks.length).toBeGreaterThan(0);
      expect(checks[0].needsAdjustment).toBe(true);
      expect(checks[0].xmlFilePath).toBe('ppt/slides/slide1.xml');
    });

    it('should skip units without fontSize', () => {
      const units: TranslationUnit[] = [{
        id: 'u2',
        location: 'slide0/shape1/p0',
        source: TranslationSource.SlideBody,
        runs: [{ index: 0, text: 'Hello', format: {} }],
        sourceText: 'Hello',
        markedText: '[[R0]]Hello[[/R0]]',
        xmlFilePath: 'ppt/slides/slide1.xml',
        xmlNodePath: 'slide0/shape1/p0',
      }];

      const results: TranslationResult[] = [{
        unitId: 'u2',
        translatedText: 'Very long translation',
        markerParsed: null,
        usedFallback: false,
        apiCallCount: 1,
      }];

      const checks = collectOverflowChecks(units, results);
      expect(checks.length).toBe(0);
    });
  });
});