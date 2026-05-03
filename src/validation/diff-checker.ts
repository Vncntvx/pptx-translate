export interface XmlDiff {
  path: string;
  type: 'added' | 'removed' | 'modified';
  detail: string;
}

export function diffXml(original: string, modified: string): XmlDiff[] {
  if (original === modified) return [];

  const diffs: XmlDiff[] = [];

  // Line-by-line comparison
  const origLines = original.split('\n');
  const modLines = modified.split('\n');

  const maxLen = Math.max(origLines.length, modLines.length);

  // Simple approach: find lines that differ, group into added/removed/modified
  const origSet = new Map<string, number>();
  for (const line of origLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    origSet.set(trimmed, (origSet.get(trimmed) || 0) + 1);
  }

  const modSet = new Map<string, number>();
  for (const line of modLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    modSet.set(trimmed, (modSet.get(trimmed) || 0) + 1);
  }

  // Lines that appear more times in modified = added
  for (const [line, count] of modSet) {
    const origCount = origSet.get(line) || 0;
    if (count > origCount) {
      diffs.push({
        path: '',
        type: 'added',
        detail: line.substring(0, 200),
      });
    }
  }

  // Lines that appear fewer times in modified = removed
  for (const [line, count] of origSet) {
    const modCount = modSet.get(line) || 0;
    if (count > modCount) {
      diffs.push({
        path: '',
        type: 'removed',
        detail: line.substring(0, 200),
      });
    }
  }

  return diffs;
}

export function diffXmlAttribute(
  originalElement: string,
  modifiedElement: string,
  attributeName: string,
): { original: string | null; modified: string | null } | null {
  const origMatch = originalElement.match(new RegExp(`${attributeName}="([^"]*)"`, 'i'));
  const modMatch = modifiedElement.match(new RegExp(`${attributeName}="([^"]*)"`, 'i'));

  const origVal = origMatch?.[1] ?? null;
  const modVal = modMatch?.[1] ?? null;

  if (origVal === modVal) return null;

  return { original: origVal, modified: modVal };
}