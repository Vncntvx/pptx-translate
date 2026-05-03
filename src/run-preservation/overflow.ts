import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { NS_A } from '../utils/xml-namespaces.js';
import { FormatWarning } from '../types.js';

export interface OverflowCheckResult {
  needsAdjustment: boolean;
  originalSize: number;
  suggestedSize: number;
  location: string;
  xmlFilePath: string;
  xmlElementPath: string;
}

export function checkOverflow(
  originalText: string,
  translatedText: string,
  originalFontSize: number,
): OverflowCheckResult | null {
  if (!originalFontSize || originalFontSize === 0) return null;

  const ratio = translatedText.length / Math.max(1, originalText.length);
  if (ratio <= 1.3) return null;

  // Suggest proportional reduction, but never below 60% of original
  const suggestedSize = Math.max(
    Math.floor(originalFontSize * (1 / ratio) * 0.95),
    Math.floor(originalFontSize * 0.6),
  );

  return {
    needsAdjustment: true,
    originalSize: originalFontSize,
    suggestedSize,
    location: '',
    xmlFilePath: '',
    xmlElementPath: '',
  };
}

export function applyOverflowAdjustment(
  archive: Map<string, string>,
  filePath: string,
  warnings: OverflowCheckResult[],
): FormatWarning[] {
  if (warnings.length === 0) return [];

  const xmlContent = archive.get(filePath);
  if (!xmlContent) return [];

  const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
  const formatWarnings: FormatWarning[] = [];
  let modified = false;

  for (const warning of warnings) {
    if (!warning.needsAdjustment || warning.xmlFilePath !== filePath) continue;

    // Find all a:rPr elements with fontSize that need adjustment
    const rPrElements = doc.getElementsByTagNameNS(NS_A, 'rPr');
    for (let i = 0; i < rPrElements.length; i++) {
      const rPr = rPrElements[i];
      const currentSz = rPr.getAttribute('sz');
      if (currentSz && parseInt(currentSz, 10) === warning.originalSize) {
        rPr.setAttribute('sz', String(warning.suggestedSize));
        modified = true;
        formatWarnings.push({
          location: warning.location,
          type: 'font-size-overflow',
          detail: `fontSize adjusted from ${warning.originalSize} to ${warning.suggestedSize} (text expanded ${translatedToOriginalRatio(warning)})`,
        });
      }
    }
  }

  if (modified) {
    const serializer = new XMLSerializer();
    archive.set(filePath, serializer.serializeToString(doc));
  }

  return formatWarnings;
}

function translatedToOriginalRatio(warning: OverflowCheckResult): string {
  const ratio = warning.suggestedSize / warning.originalSize;
  return `${((1 / ratio) * 100).toFixed(0)}%`;
}

export function collectOverflowChecks(
  units: import('../types.js').TranslationUnit[],
  results: import('../types.js').TranslationResult[],
): OverflowCheckResult[] {
  const checks: OverflowCheckResult[] = [];

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const result = results[i];
    if (!result || !result.translatedText) continue;

    // Check if any run has a fontSize that might overflow
    for (const run of unit.runs) {
      if (!run.format.fontSize) continue;

      const check = checkOverflow(unit.sourceText, result.translatedText, run.format.fontSize);
      if (check) {
        check.location = unit.location;
        check.xmlFilePath = unit.xmlFilePath;
        check.xmlElementPath = unit.xmlNodePath;
        checks.push(check);
      }
    }
  }

  return checks;
}