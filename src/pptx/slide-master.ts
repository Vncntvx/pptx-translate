import { PptxArchive, TranslationUnit, TranslationSource, TextRun, CliConfig } from '../types.js';
import { DOMParser } from '@xmldom/xmldom';
import {
  NS_A, NS_P,
  PPTX_FILE_PATTERNS,
} from '../utils/xml-namespaces.js';

let unitIdCounter = 0;

export function resetMasterLayoutCounter(): void {
  unitIdCounter = 0;
}

export function extractMasterLayoutText(
  archive: PptxArchive,
  config: CliConfig,
): TranslationUnit[] {
  if (!config.includeMasterLayout) return [];

  const units: TranslationUnit[] = [];

  // Extract from slideMaster files
  for (const [filename] of archive.xmlFiles) {
    if (PPTX_FILE_PATTERNS.slideMasters.test(filename)) {
      extractFromMasterOrLayout(filename, archive, units, TranslationSource.SlideMaster);
    }
    if (PPTX_FILE_PATTERNS.slideLayouts.test(filename)) {
      extractFromMasterOrLayout(filename, archive, units, TranslationSource.SlideLayout);
    }
  }

  return units;
}

function extractFromMasterOrLayout(
  file: string,
  archive: PptxArchive,
  units: TranslationUnit[],
  source: TranslationSource,
): void {
  const xml = archive.xmlFiles.get(file);
  if (!xml) return;

  const doc = parseXml(xml, file);

  // Navigate to shape tree via cSld
  const root = doc.documentElement;
  const cSld = findChild(root, NS_P, 'cSld') || root;
  const spTree = findChild(cSld, NS_P, 'spTree');
  if (!spTree) return;

  processShapeTree(spTree, file, source, units);
}

function processShapeTree(
  spTree: Element,
  file: string,
  source: TranslationSource,
  units: TranslationUnit[],
  prefix?: string,
): void {
  for (let i = 0; i < spTree.childNodes.length; i++) {
    const child = spTree.childNodes[i] as Element;
    if (child.nodeType !== 1) continue;

    const ns = child.namespaceURI || '';
    const ln = child.localName || '';

    if ((ns === NS_P && ln === 'sp') || (ns === NS_A && ln === 'sp')) {
      processShape(child, file, source, units, prefix, i);
    } else if (ns === NS_P && ln === 'grpSp') {
      const groupPrefix = `${prefix || source}/group${i}`;
      processShapeTree(child, file, source, units, groupPrefix);
    }
  }
}

function processShape(
  sp: Element,
  file: string,
  source: TranslationSource,
  units: TranslationUnit[],
  prefix: string | undefined,
  shapeIdx: number,
): void {
  const location = `${prefix || source}/shape${shapeIdx}`;

  // Skip placeholder shapes with auto-generated content
  const placeholderType = getPlaceholderType(sp);
  if (placeholderType === 'sldNum' || placeholderType === 'dt' || placeholderType === 'ftr' || placeholderType === 'hdr') {
    // Still extract these, but with explicit location context
  }

  const txBody = findChild(sp, NS_P, 'txBody') || findChild(sp, NS_A, 'txBody');
  if (!txBody) return;

  // Check for table
  const table = findChild(txBody, NS_A, 'tbl');
  if (table) {
    extractFromTable(table, file, source, units, location);
    return;
  }

  extractFromTextBody(txBody, file, source, units, location);
}

function extractFromTextBody(
  txBody: Element,
  file: string,
  source: TranslationSource,
  units: TranslationUnit[],
  locationPrefix: string,
): void {
  const paragraphs = getChildren(txBody, NS_A, 'p');
  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    const runs = extractRuns(para);

    const sourceText = runs.length > 0
      ? runs.map(r => r.text).join('')
      : getDirectText(para);

    if (!sourceText || !sourceText.trim()) continue;

    const markedText = runs.length > 0
      ? runs.map((r, i) => `[[R${i}]]${r.text}[[/R${i}]]`).join('')
      : sourceText;

    units.push({
      id: `unit-${unitIdCounter++}`,
      location: `${locationPrefix}/p${pIdx}`,
      source,
      runs,
      sourceText,
      markedText,
      xmlFilePath: file,
      xmlNodePath: `${locationPrefix}/p${pIdx}`,
    });
  }
}

function extractFromTable(
  tbl: Element,
  file: string,
  source: TranslationSource,
  units: TranslationUnit[],
  locationPrefix: string,
): void {
  const rows = getChildren(tbl, NS_A, 'tr');
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const cells = getChildren(rows[rIdx], NS_A, 'tc');
    for (let cIdx = 0; cIdx < cells.length; cIdx++) {
      const cell = cells[cIdx];
      const txBody = findChild(cell, NS_A, 'txBody');
      if (!txBody) continue;

      extractFromTextBody(txBody, file, source, units,
        `${locationPrefix}/table/r${rIdx}/c${cIdx}`);
    }
  }
}

function extractRuns(para: Element): TextRun[] {
  const runs: TextRun[] = [];
  const runElements = getChildren(para, NS_A, 'r');

  for (let i = 0; i < runElements.length; i++) {
    const runEl = runElements[i];
    const tEl = findChild(runEl, NS_A, 't');
    const text = tEl?.textContent || '';
    const format = extractRunFormat(runEl);

    runs.push({ index: i, text, format, xmlElement: tEl || undefined });
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
  if (latin) format.fontFamily = latin.getAttribute('typeface') || undefined;

  const solidFill = findChild(rPr, NS_A, 'solidFill');
  if (solidFill) {
    const srgbClr = findChild(solidFill, NS_A, 'srgbClr');
    if (srgbClr) format.color = srgbClr.getAttribute('val') || undefined;
  }

  return format;
}

function getPlaceholderType(sp: Element): string | undefined {
  const ph = findDescendant(sp, NS_P, 'ph');
  return ph?.getAttribute('type') || undefined;
}

function getDirectText(element: Element): string {
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
    throw new Error(`Failed to parse XML: ${filename}`);
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

function findDescendant(parent: Element, ns: string, localName: string): Element | null {
  const elements = parent.getElementsByTagNameNS(ns, localName);
  return elements.length > 0 ? elements[0] : null;
}

function getChildren(parent: Element, ns: string, localName: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i] as Element;
    if (child.nodeType !== 1) continue;
    if (child.namespaceURI === ns && child.localName === localName) {
      result.push(child);
    }
  }
  return result;
}