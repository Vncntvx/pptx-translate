import { describe, it, expect } from 'vitest';
import { buildMarkedText, parseMarkedText } from '../../src/translation/marker.js';
import { TextRun } from '../../src/types.js';

describe('marker', () => {
  describe('buildMarkedText', () => {
    it('should wrap each run text with indexed markers', () => {
      const runs: TextRun[] = [
        { index: 0, text: 'Hello', format: {} },
        { index: 1, text: ' World', format: {} },
      ];
      expect(buildMarkedText(runs)).toBe('[[R0]]Hello[[/R0]][[R1]] World[[/R1]]');
    });

    it('should handle single run', () => {
      const runs: TextRun[] = [
        { index: 0, text: 'Single', format: {} },
      ];
      expect(buildMarkedText(runs)).toBe('[[R0]]Single[[/R0]]');
    });

    it('should handle empty run text', () => {
      const runs: TextRun[] = [
        { index: 0, text: '', format: {} },
        { index: 1, text: 'text', format: {} },
      ];
      expect(buildMarkedText(runs)).toBe('[[R0]][[/R0]][[R1]]text[[/R1]]');
    });

    it('should handle runs with CJK text', () => {
      const runs: TextRun[] = [
        { index: 0, text: '这是', format: {} },
        { index: 1, text: '中文', format: {} },
      ];
      expect(buildMarkedText(runs)).toBe('[[R0]]这是[[/R0]][[R1]]中文[[/R1]]');
    });
  });

  describe('parseMarkedText', () => {
    it('should parse correctly marked text', () => {
      const result = parseMarkedText('[[R0]]Hello[[/R0]][[R1]] World[[/R1]]', 2);
      expect(result).toEqual(['Hello', ' World']);
    });

    it('should return null for mismatched count', () => {
      const result = parseMarkedText('[[R0]]Hello[[/R0]][[R1]] World[[/R1]]', 3);
      expect(result).toBeNull();
    });

    it('should return null for out-of-order markers', () => {
      const result = parseMarkedText('[[R1]]second[[/R1]][[R0]]first[[/R0]]', 2);
      expect(result).toBeNull();
    });

    it('should return null for missing markers', () => {
      const result = parseMarkedText('Hello World', 2);
      expect(result).toBeNull();
    });

    it('should return null for runCount 0', () => {
      expect(parseMarkedText('anything', 0)).toBeNull();
    });

    it('should parse single run correctly', () => {
      const result = parseMarkedText('[[R0]]translated[[/R0]]', 1);
      expect(result).toEqual(['translated']);
    });
  });
});