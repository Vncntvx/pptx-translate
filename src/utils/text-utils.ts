export function preservePadding(text: string, translated: string): string {
  if (!text || !text.trim()) return text;

  const left = text.length - text.trimStart().length;
  const right = text.length - text.trimEnd().length;

  const leftPadding = text.substring(0, left);
  const rightPadding = right > 0 ? text.substring(text.length - right) : '';

  return `${leftPadding}${translated}${rightPadding}`;
}

export function isOnlyWhitespace(text: string): boolean {
  return !text || !text.trim();
}

export function countVisibleChars(text: string): number {
  // Count non-whitespace characters
  return text.replace(/\s/g, '').length;
}