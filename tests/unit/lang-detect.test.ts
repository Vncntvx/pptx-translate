import { describe, it, expect } from 'vitest';
import { containsCjk, shouldTranslateByCjk, shouldTranslateByAll, detectStrategy } from '../../src/utils/lang-detect.js';

describe('lang-detect', () => {
  describe('containsCjk', () => {
    it('should detect Chinese characters', () => {
      expect(containsCjk('你好世界')).toBe(true);
    });

    it('should detect mixed CJK and English', () => {
      expect(containsCjk('Hello 你好')).toBe(true);
    });

    it('should return false for pure English', () => {
      expect(containsCjk('Hello World')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(containsCjk('')).toBe(false);
    });
  });

  describe('shouldTranslateByCjk', () => {
    it('should translate CJK text', () => {
      expect(shouldTranslateByCjk('中文内容')).toBe(true);
    });

    it('should not translate whitespace-only', () => {
      expect(shouldTranslateByCjk('   ')).toBe(false);
    });

    it('should not translate empty text', () => {
      expect(shouldTranslateByCjk('')).toBe(false);
    });
  });

  describe('detectStrategy', () => {
    it('should return CJK strategy for cjk', () => {
      const fn = detectStrategy('cjk');
      expect(fn('你好')).toBe(true);
      expect(fn('Hello')).toBe(false);
    });

    it('should return all strategy for all', () => {
      const fn = detectStrategy('all');
      expect(fn('你好')).toBe(true);
      expect(fn('Hello')).toBe(true);
    });
  });
});