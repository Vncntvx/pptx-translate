import { PptxArchive, TranslationUnit, TranslationResult, TextRun } from '../types.js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { parseMarkedText } from '../translation/marker.js';
import { distributeTextToRuns } from '../run-preservation/distribute.js';
import { preservePadding } from '../utils/text-utils.js';
import { NS_A } from '../utils/xml-namespaces.js';

const xmlSerializer = new XMLSerializer();

export function writebackTranslations(
  archive: PptxArchive,
  units: TranslationUnit[],
  results: TranslationResult[],
): void {
  // Group units by XML file
  const byFile = new Map<string, { unit: TranslationUnit; result: TranslationResult }[]>();

  for (let i = 0; i < units.length; i++) {
    if (!results[i]) continue;
    const filePath = units[i].xmlFilePath;
    if (!byFile.has(filePath)) byFile.set(filePath, []);
    byFile.get(filePath)!.push({ unit: units[i], result: results[i] });
  }

  // Process each XML file
  for (const [filePath, entries] of byFile) {
    const xmlContent = archive.xmlFiles.get(filePath);
    if (!xmlContent) continue;

    const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
    let modified = false;

    // Build map of paragraph text to paragraph elements
    const allParagraphs = doc.getElementsByTagNameNS(NS_A, 'p');
    const textToPara = new Map<string, Element[]>();

    for (let i = 0; i < allParagraphs.length; i++) {
      const pEl = allParagraphs[i];
      const text = collectParagraphText(pEl);
      if (!textToPara.has(text)) textToPara.set(text, []);
      textToPara.get(text)!.push(pEl);
    }

    // Track which paragraphs we've already written
    const writtenParagraphs = new Set<Element>();

    for (const { unit, result } of entries) {
      if (result.translatedText === '' && !result.usedFallback) continue;

      const paraElement = findParagraph(textToPara, unit, writtenParagraphs);
      if (!paraElement) continue;

      const didModify = writebackParagraph(paraElement, unit, result);
      if (didModify) {
        modified = true;
        writtenParagraphs.add(paraElement);
      }
    }

    if (modified) {
      const updatedXml = xmlSerializer.serializeToString(doc);
      archive.xmlFiles.set(filePath, updatedXml);
    }
  }
}

function collectParagraphText(pEl: Element): string {
  const tElements = pEl.getElementsByTagNameNS(NS_A, 't');
  let text = '';
  for (let i = 0; i < tElements.length; i++) {
    text += tElements[i].textContent || '';
  }
  return text;
}

function findParagraph(
  textToPara: Map<string, Element[]>,
  unit: TranslationUnit,
  writtenParagraphs: Set<Element>,
): Element | null {
  const candidates = textToPara.get(unit.sourceText);
  if (!candidates || candidates.length === 0) return null;

  // Find an unwritten candidate
  for (const candidate of candidates) {
    if (!writtenParagraphs.has(candidate)) return candidate;
  }

  // All candidates already written
  return candidates[0];
}

function writebackParagraph(
  paraElement: Element,
  unit: TranslationUnit,
  result: TranslationResult,
): boolean {
  if (unit.runs.length > 0) {
    return writebackRunWithMarkers(paraElement, unit, result);
  } else {
    return writebackDirect(paraElement, result.translatedText);
  }
}

function writebackRunWithMarkers(
  paraElement: Element,
  unit: TranslationUnit,
  result: TranslationResult,
): boolean {
  const rElements = paraElement.getElementsByTagNameNS(NS_A, 'r');
  const runCount = unit.runs.length;

  if (result.markerParsed !== null && rElements.length === runCount) {
    // Markers preserved and run count matches
    for (let i = 0; i < runCount; i++) {
      const tEls = rElements[i].getElementsByTagNameNS(NS_A, 't');
      if (tEls.length > 0) {
        setTextContent(tEls[0], result.markerParsed[i]);
      }
    }
    return true;
  }

  // Markers lost or run mismatch, distribute proportionally
  if (rElements.length > 0) {
    const fallbackText = result.usedFallback
      ? result.translatedText
      : preservePadding(unit.sourceText, result.translatedText);

    const xmlRuns: TextRun[] = [];
    for (let i = 0; i < rElements.length; i++) {
      const tEls = rElements[i].getElementsByTagNameNS(NS_A, 't');
      const text = tEls.length > 0 ? (tEls[0].textContent || '') : '';
      xmlRuns.push({ index: i, text, format: {} });
    }

    distributeTextToRuns(xmlRuns, fallbackText);

    for (let i = 0; i < rElements.length; i++) {
      const tEls = rElements[i].getElementsByTagNameNS(NS_A, 't');
      if (tEls.length > 0) {
        setTextContent(tEls[0], xmlRuns[i].text);
      }
    }
    return true;
  }

  // No a:r elements, write directly to a:t
  return writebackDirect(paraElement, result.translatedText);
}

function writebackDirect(paraElement: Element, translatedText: string): boolean {
  const tElements = paraElement.getElementsByTagNameNS(NS_A, 't');
  if (tElements.length === 0) return false;

  // Put all text in first a:t, clear the rest
  setTextContent(tElements[0], translatedText);
  for (let i = 1; i < tElements.length; i++) {
    setTextContent(tElements[i], '');
  }
  return true;
}

function setTextContent(element: Element, text: string): void {
  // Clear all child nodes and set new text
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  element.appendChild(element.ownerDocument!.createTextNode(text));
}