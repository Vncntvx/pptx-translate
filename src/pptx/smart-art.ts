import { PptxArchive, TranslationUnit, TranslationSource, TextRun } from '../types.js';
import { DOMParser } from '@xmldom/xmldom';
import {
  NS_A, NS_DGM,
  PPTX_FILE_PATTERNS,
} from '../utils/xml-namespaces.js';

let unitIdCounter = 0;

export function resetSmartArtCounter(): void {
  unitIdCounter = 0;
}

export function extractSmartArtText(
  archive: PptxArchive,
  dataFile: string,
  slideIdx: number,
): TranslationUnit[] {
  const units: TranslationUnit[] = [];
  const dataXml = archive.xmlFiles.get(dataFile);
  if (!dataXml) return units;

  const doc = parseXml(dataXml, dataFile);

  // SmartArt data model stores text in pt elements
  const ptElements = doc.getElementsByTagNameNS(NS_DGM, 'pt');

  for (let i = 0; i < ptElements.length; i++) {
    const pt = ptElements[i];
    const modelId = pt.getAttribute('modelId') || `pt${i}`;
    const type = pt.getAttribute('type') || '';

    // Skip connection and presentation nodes
    if (type === 'conn' || type === 'pres') continue;

    // Each pt may contain text in multiple ways:
    // 1. Direct a:t elements inside the pt
    // 2. a:t inside a:p inside a:rich (DrawingML rich text)
    // 3. dgm:prSet may contain layout info but not text

    // Approach: extract all a:p paragraphs from the pt element
    const pElements = pt.getElementsByTagNameNS(NS_A, 'p');
    for (let pIdx = 0; pIdx < pElements.length; pIdx++) {
      const para = pElements[pIdx];

      // Check paragraph belongs directly to this pt (not nested)
      if (!isDirectParagraph(para, pt)) continue;

      const runs = extractRunsFromParagraph(para);
      const sourceText = runs.length > 0
        ? runs.map(r => r.text).join('')
        : getDirectAText(para);

      if (!sourceText || !sourceText.trim()) continue;

      const markedText = runs.length > 0
        ? runs.map((r, i) => `[[R${i}]]${r.text}[[/R${i}]]`).join('')
        : sourceText;

      units.push({
        id: `unit-${unitIdCounter++}`,
        location: `slide${slideIdx}/diagram/pt-${modelId}/p${pIdx}`,
        source: TranslationSource.SmartArt,
        runs,
        sourceText,
        markedText,
        xmlFilePath: dataFile,
        xmlNodePath: `pt-${modelId}/p${pIdx}`,
        context: { slideNumber: slideIdx + 1, shapeType: 'smart-art' },
      });
    }

    // Also check standalone a:t elements not inside a:p
    const standaloneTElements = pt.getElementsByTagNameNS(NS_A, 't');
    for (let tIdx = 0; tIdx < standaloneTElements.length; tIdx++) {
      const tEl = standaloneTElements[tIdx];
      const text = tEl.textContent || '';
      if (!text || !text.trim()) continue;

      // Check if this a:t is inside an a:p we've processed
      if (isInsideParagraph(tEl)) continue;

      units.push({
        id: `unit-${unitIdCounter++}`,
        location: `slide${slideIdx}/diagram/pt-${modelId}/t${tIdx}`,
        source: TranslationSource.SmartArt,
        runs: [{
          index: 0,
          text,
          format: {},
          xmlElement: tEl,
        }],
        sourceText: text,
        markedText: `[[R0]]${text}[[/R0]]`,
        xmlFilePath: dataFile,
        xmlNodePath: `pt-${modelId}/t${tIdx}`,
        context: { slideNumber: slideIdx + 1, shapeType: 'smart-art' },
      });
    }
  }

  return units;
}

function isDirectParagraph(para: Element, pt: Element): boolean {
  // Check that the paragraph is a direct child of an element that is a direct child of pt
  // (i.e., not inside a nested pt)
  let parent = para.parentNode as Element;
  while (parent && parent !== pt) {
    if (parent.localName === 'pt' && parent.namespaceURI === NS_DGM) {
      // Paragraph is inside a nested pt
    }
    parent = parent.parentNode as Element;
  }
  return parent === pt;
}

function isInsideParagraph(tEl: Element): boolean {
  let parent = tEl.parentNode as Element;
  while (parent) {
    if (parent.localName === 'p' && parent.namespaceURI === NS_A) {
      return true;
    }
    parent = parent.parentNode as Element;
  }
  return false;
}

function extractRunsFromParagraph(para: Element): TextRun[] {
  const runs: TextRun[] = [];
  const runElements = para.getElementsByTagNameNS(NS_A, 'r');

  for (let i = 0; i < runElements.length; i++) {
    const runEl = runElements[i];
    const tEl = findChild(runEl, NS_A, 't');
    const text = tEl?.textContent || '';
    if (!text || !text.trim()) continue;

    runs.push({
      index: i,
      text,
      format: extractRunFormat(runEl),
      xmlElement: tEl || undefined,
    });
  }

  return runs;
}

function extractRunFormat(runEl: Element): import('../types.js').RunFormat {
  const rPr = findChild(runEl, NS_A, 'rPr');
  if (!rPr) return {};

  const format: import('../types.js').RunFormat = {};
  const bAttr = rPr.getAttribute('b');
  if (bAttr) format.bold = bAttr !== '0';
  const iAttr = rPr.getAttribute('i');
  if (iAttr) format.italic = iAttr !== '0';
  const szAttr = rPr.getAttribute('sz');
  if (szAttr) format.fontSize = parseInt(szAttr, 10);

  const latin = findChild(rPr, NS_A, 'latin');
  if (latin) {
    const typeface = latin.getAttribute('typeface');
    if (typeface) format.fontFamily = typeface;
  }

  const solidFill = findChild(rPr, NS_A, 'solidFill');
  if (solidFill) {
    const srgbClr = findChild(solidFill, NS_A, 'srgbClr');
    if (srgbClr) {
      const val = srgbClr.getAttribute('val');
      if (val) format.color = val;
    }
  }

  return format;
}

function getDirectAText(element: Element): string {
  const tElements = element.getElementsByTagNameNS(NS_A, 't');
  let text = '';
  for (let i = 0; i < tElements.length; i++) {
    text += tElements[i].textContent || '';
  }
  return text;
}

// XML utility
function parseXml(xml: string, filename: string): Document {
  try {
    return new DOMParser().parseFromString(xml, 'text/xml');
  } catch {
    throw new Error(`Failed to parse diagram XML: ${filename}`);
  }
}

function findChild(parent: Element, ns: string, localName: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i] as Element;
    if (child.nodeType !== 1) continue;
    if (child.namespaceURI === ns && child.localName === localName) {
      return child;
    }
  }
  return null;
}