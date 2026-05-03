import { describe, it, expect } from 'vitest';
import { compareRunFormats, compareRunFormatArrays } from '../../src/run-preservation/format-guard.js';
import { RunFormat } from '../../src/types.js';

describe('format-guard', () => {
  describe('compareRunFormats', () => {
    it('should return null for identical formats', () => {
      const fmt: RunFormat = { bold: true, fontSize: 1200, fontFamily: 'Arial' };
      const result = compareRunFormats(fmt, fmt, 'test');
      expect(result).toBeNull();
    });

    it('should detect bold mismatch', () => {
      const orig: RunFormat = { bold: true };
      const trans: RunFormat = { bold: false };
      const result = compareRunFormats(orig, trans, 'slide0/shape0/run0');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('attribute-mismatch');
      expect(result!.detail).toContain('bold');
    });

    it('should detect italic mismatch', () => {
      const orig: RunFormat = { italic: true };
      const trans: RunFormat = { italic: false };
      const result = compareRunFormats(orig, trans, 'test');
      expect(result!.detail).toContain('italic');
    });

    it('should detect significant fontSize change (>20%)', () => {
      const orig: RunFormat = { fontSize: 1200 };
      const trans: RunFormat = { fontSize: 800 };
      const result = compareRunFormats(orig, trans, 'test');
      expect(result!.detail).toContain('fontSize');
    });

    it('should not flag minor fontSize change (<20%)', () => {
      const orig: RunFormat = { fontSize: 1200 };
      const trans: RunFormat = { fontSize: 1100 };
      const result = compareRunFormats(orig, trans, 'test');
      expect(result).toBeNull();
    });

    it('should detect color mismatch', () => {
      const orig: RunFormat = { color: 'FF0000' };
      const trans: RunFormat = { color: '000000' };
      const result = compareRunFormats(orig, trans, 'test');
      expect(result!.detail).toContain('color');
    });

    it('should detect missing attributes as mismatches', () => {
      const orig: RunFormat = { bold: true, fontFamily: 'Arial', color: 'FF0000' };
      const trans: RunFormat = { bold: true };
      const result = compareRunFormats(orig, trans, 'test');
      expect(result!.detail).toContain('fontFamily');
      expect(result!.detail).toContain('color');
    });

    it('should return null for empty formats', () => {
      const result = compareRunFormats({}, {}, 'test');
      expect(result).toBeNull();
    });
  });

  describe('compareRunFormatArrays', () => {
    it('should detect run count mismatch', () => {
      const orig: RunFormat[] = [{ bold: true }, { italic: true }];
      const trans: RunFormat[] = [{ bold: true }];
      const warnings = compareRunFormatArrays(orig, trans, 'slide0/shape0');
      expect(warnings.some(w => w.type === 'run-structure-loss')).toBe(true);
    });

    it('should return empty for matching formats', () => {
      const fmts: RunFormat[] = [{ bold: true, fontSize: 1200 }];
      const warnings = compareRunFormatArrays(fmts, fmts, 'test');
      expect(warnings.length).toBe(0);
    });

    it('should compare all run pairs', () => {
      const orig: RunFormat[] = [{ bold: true }, { italic: true, color: 'FF0000' }];
      const trans: RunFormat[] = [{ bold: false }, { italic: true }];
      const warnings = compareRunFormatArrays(orig, trans, 'test');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.detail.includes('bold'))).toBe(true);
      expect(warnings.some(w => w.detail.includes('color'))).toBe(true);
    });
  });
});