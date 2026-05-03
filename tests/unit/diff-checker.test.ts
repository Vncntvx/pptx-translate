import { describe, it, expect } from 'vitest';
import { diffXml, diffXmlAttribute } from '../../src/validation/diff-checker.js';

describe('diff-checker', () => {
  describe('diffXml', () => {
    it('should return empty for identical XML', () => {
      const xml = '<root><child>text</child></root>';
      const diffs = diffXml(xml, xml);
      expect(diffs.length).toBe(0);
    });

    it('should detect added lines', () => {
      const orig = '<root>\n<child>text</child>\n</root>';
      const mod = '<root>\n<child>text</child>\n<new>added</new>\n</root>';
      const diffs = diffXml(orig, mod);
      expect(diffs.some(d => d.type === 'added')).toBe(true);
    });

    it('should detect removed lines', () => {
      const orig = '<root>\n<child>text</child>\n<extra>gone</extra>\n</root>';
      const mod = '<root>\n<child>text</child>\n</root>';
      const diffs = diffXml(orig, mod);
      expect(diffs.some(d => d.type === 'removed')).toBe(true);
    });

    it('should detect modified text', () => {
      const orig = '<a:t>Hello</a:t>';
      const mod = '<a:t>你好</a:t>';
      const diffs = diffXml(orig, mod);
      expect(diffs.length).toBeGreaterThan(0);
    });
  });

  describe('diffXmlAttribute', () => {
    it('should return null for identical attributes', () => {
      const el = '<a:rPr sz="1200" b="1"/>';
      const result = diffXmlAttribute(el, el, 'sz');
      expect(result).toBeNull();
    });

    it('should detect attribute value change', () => {
      const orig = '<a:rPr sz="1200"/>';
      const mod = '<a:rPr sz="800"/>';
      const result = diffXmlAttribute(orig, mod, 'sz');
      expect(result).not.toBeNull();
      expect(result!.original).toBe('1200');
      expect(result!.modified).toBe('800');
    });

    it('should detect attribute removal', () => {
      const orig = '<a:rPr sz="1200"/>';
      const mod = '<a:rPr/>';
      const result = diffXmlAttribute(orig, mod, 'sz');
      expect(result).not.toBeNull();
      expect(result!.original).toBe('1200');
      expect(result!.modified).toBeNull();
    });

    it('should detect attribute addition', () => {
      const orig = '<a:rPr/>';
      const mod = '<a:rPr sz="1200"/>';
      const result = diffXmlAttribute(orig, mod, 'sz');
      expect(result).not.toBeNull();
      expect(result!.original).toBeNull();
      expect(result!.modified).toBe('1200');
    });
  });
});