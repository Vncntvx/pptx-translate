import { describe, it, expect } from 'vitest';
import { TranslationCache } from '../../src/translation/cache.js';

describe('TranslationCache', () => {
  it('should store and retrieve translations', () => {
    const cache = new TranslationCache();
    cache.set('hello', '你好');
    expect(cache.get('hello')).toBe('你好');
  });

  it('should deduplicate texts correctly', () => {
    const cache = new TranslationCache();
    cache.set('cached', '已翻译');

    const texts = ['cached', 'new1', 'cached', 'new2'];
    const { missingTexts, missingMap } = cache.deduplicate(texts);

    // Only 'new1' and 'new2' are missing
    expect(missingTexts).toEqual(['new1', 'new2']);
    expect(missingMap.get('new1')).toEqual([1]);
    expect(missingMap.get('new2')).toEqual([3]);
  });

  it('should fill results maintaining original order', () => {
    const cache = new TranslationCache();
    cache.set('cached', '已翻译');

    const texts = ['cached', 'new1', 'cached', 'new2'];
    const { missingTexts, missingMap } = cache.deduplicate(texts);

    // Translate missing texts
    const translations = ['新1', '新2'];
    const results = cache.fillResults(texts, missingTexts, translations);

    expect(results).toEqual(['已翻译', '新1', '已翻译', '新2']);
  });

  it('should handle empty texts', () => {
    const cache = new TranslationCache();
    const { missingTexts } = cache.deduplicate([]);
    expect(missingTexts).toEqual([]);
  });

  it('should clear cache', () => {
    const cache = new TranslationCache();
    cache.set('test', '测试');
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});