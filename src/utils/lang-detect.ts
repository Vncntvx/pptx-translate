const CJK_RANGE = /[一-鿿㐀-䶿]/;

export function containsCjk(text: string): boolean {
  return CJK_RANGE.test(text);
}

export function shouldTranslateByCjk(text: string): boolean {
  if (!text || !text.trim()) return false;
  return containsCjk(text);
}

export function shouldTranslateByAll(text: string): boolean {
  if (!text || !text.trim()) return false;
  // Translate any text containing letters (Latin, CJK, Cyrillic, Arabic, etc.)
  // Skip pure numbers, punctuation, whitespace
  const hasLetters = /[a-zA-ZÀ-ɏ一-鿿㐀-䶿Ѐ-ӿЀ-ӿ؀-ۿĀ-ſ]/.test(text);
  // Also skip very short strings that are likely just formatting artifacts
  if (text.trim().length <= 1 && !/[a-zA-Z一-鿿]/.test(text)) return false;
  return hasLetters;
}

export function detectStrategy(strategy: 'cjk' | 'all'): (text: string) => boolean {
  return strategy === 'all' ? shouldTranslateByAll : shouldTranslateByCjk;
}