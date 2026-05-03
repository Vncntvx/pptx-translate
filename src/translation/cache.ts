export class TranslationCache {
  private store: Map<string, string> = new Map();

  get(key: string): string | undefined {
    return this.store.get(key);
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Deduplicate a list of texts: return only unique texts that aren't cached yet,
   * along with a mapping to reconstruct the full result array after translation.
   */
  deduplicate(texts: string[]): {
    missingTexts: string[];
    missingMap: Map<string, number[]>; // text to indices
  } {
    const missingMap = new Map<string, number[]>();

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!this.store.has(text)) {
        if (!missingMap.has(text)) {
          missingMap.set(text, []);
        }
        missingMap.get(text)!.push(i);
      }
    }

    const missingTexts = [...missingMap.keys()];
    return { missingTexts, missingMap };
  }

  /**
   * After translating missing texts, fill them into cache and reconstruct
   * the complete result array matching the original order.
   */
  fillResults(texts: string[], missingTexts: string[], translations: string[]): string[] {
    // Cache all new translations
    for (let i = 0; i < missingTexts.length; i++) {
      this.store.set(missingTexts[i], translations[i]);
    }

    // Build result array from cache
    const results: string[] = [];
    for (const text of texts) {
      results.push(this.store.get(text) || text);
    }
    return results;
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}