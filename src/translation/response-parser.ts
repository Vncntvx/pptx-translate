export function parseJsonArray(content: string, expectedLen: number): string[] {
  const candidates: string[] = [content.trim()];

  // Try extracting [...] substring
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    candidates.push(content.substring(start, end + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate);
      if (typeof data === 'object' && !Array.isArray(data)) {
        // Try common wrapper keys
        for (const key of ['translations', 'items', 'result', 'data']) {
          if (Array.isArray(data[key])) {
            const arr = data[key];
            if (arr.length === expectedLen) {
              return arr.map(item => typeof item === 'string' ? item : String(item));
            }
          }
        }
      }
      if (Array.isArray(data) && data.length === expectedLen) {
        return data.map(item => typeof item === 'string' ? item : String(item));
      }
    } catch {
      continue;
    }
  }

  throw new Error(`Model did not return a valid JSON array with expected length ${expectedLen}`);
}