import { PptxArchive, TranslationUnit, TranslationSource, TextRun, RunFormat, TranslationContext, CliConfig } from '../types.js';
import { parseRelationships, getSlideOrder } from './relationships.js';
import { extractChartDeepText, resetChartDeepCounter } from './chart-deep.js';
import { extractSmartArtText, resetSmartArtCounter } from './smart-art.js';
import { extractMasterLayoutText, resetMasterLayoutCounter } from './slide-master.js';
import {
  NS_A, NS_P, NS_R, NS_C,
  TAG_A_T, TAG_A_R, TAG_A_RPR, TAG_A_P, TAG_A_PPR,
  TAG_A_BODYPR, TAG_A_TBL, TAG_A_TR, TAG_A_TC, TAG_A_TXBODY,
  TAG_A_SOLIDFILL, TAG_A_SRGBCLR, TAG_A_LATIN, TAG_A_EA,
  TAG_P_SP, TAG_P_GRPSP, TAG_P_TXBODY, TAG_P_NVSPPR,
  TAG_P_PH, TAG_P_GRAPHICFRAME,
  TAG_C_TITLE, TAG_C_TX,
  PPTX_FILE_PATTERNS,
} from '../utils/xml-namespaces.js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

let unitIdCounter = 0;

export async function extractTranslationUnits(
  archive: PptxArchive,
  config: CliConfig,
): Promise<TranslationUnit[]> {
  const units: TranslationUnit[] = [];
  unitIdCounter = 0;

  const relationships = parseRelationships(archive);
  const slideOrder = getSlideOrder(archive);
  unitIdCounter = 0;
  resetChartDeepCounter();
  resetSmartArtCounter();
  resetMasterLayoutCounter();

  // Pass 1: Extract from slides
  for (let slideIdx = 0; slideIdx < slideOrder.length; slideIdx++) {
    const slideFile = slideOrder[slideIdx];
    const slideXml = archive.xmlFiles.get(slideFile);
    if (!slideXml) continue;

    const doc = parseXml(slideXml, slideFile);

    // Extract from slide body shapes
    extractFromSlideShapes(doc, slideFile, slideIdx, archive, relationships, units);

    // Extract from charts referenced by this slide
    const chartFiles = relationships.slideToChart.get(slideFile) || [];
    for (const chartFile of chartFiles) {
      extractFromChart(chartFile, slideIdx, archive, units);
      // Deep chart extraction: axis, legends, data labels, series
      const deepUnits = extractChartDeepText(archive, chartFile, slideIdx);
      units.push(...deepUnits);
    }

    // Extract from diagrams referenced by this slide
    const diagramFiles = relationships.slideToDiagram.get(slideFile) || [];
    for (const diagFile of diagramFiles) {
      if (diagFile.includes('data')) {
        const smartUnits = extractSmartArtText(archive, diagFile, slideIdx);
        units.push(...smartUnits);
      }
    }

    // Extract from notes (optional)
    if (config.includeNotes) {
      const notesFile = relationships.slideToNotes.get(slideFile);
      if (notesFile) {
        extractFromNotes(notesFile, slideIdx, archive, units);
      }
    }
  }

  // Extract from slideMaster and slideLayout (optional)
  const masterUnits = extractMasterLayoutText(archive, config);
  units.push(...masterUnits);

  return units;
}

// Slide body extraction

function extractFromSlideShapes(
  doc: Document,
  slideFile: string,
  slideIdx: number,
  archive: PptxArchive,
  relationships: PptxRelationships,
  units: TranslationUnit[],
): void {
  // Navigate to spTree via cSld
  const sld = doc.getElementsByTagNameNS(NS_P, 'sld')[0]
    || doc.getElementsByTagNameNS(NS_P, 'cSld')[0]
    || doc.documentElement;

  // spTree is inside cSld, which is inside sld
  const cSld = findFirstChild(sld, NS_P, 'cSld') || sld;
  const spTree = findFirstChild(cSld, NS_P, 'spTree');
  if (!spTree) return;

  processShapeTree(spTree, slideFile, slideIdx, units);
}

function processShapeTree(
  parent: Element,
  slideFile: string,
  slideIdx: number,
  units: TranslationUnit[],
  locationPrefix?: string,
): void {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i] as Element;
    if (child.nodeType !== 1) continue; // skip text nodes

    const ns = child.namespaceURI || '';
    const ln = child.localName || '';

    if ((ns === NS_P && ln === 'sp') || (ns === NS_A && ln === 'sp')) {
      processShape(child, slideFile, slideIdx, units, locationPrefix, i);
    } else if (ns === NS_P && ln === 'grpSp') {
      processGroupShape(child, slideFile, slideIdx, units, locationPrefix, i);
    } else if (ns === NS_P && ln === 'graphicFrame') {
      // graphicFrame contains charts, handled via relationships
    }
  }
}

function processShape(
  sp: Element,
  slideFile: string,
  slideIdx: number,
  units: TranslationUnit[],
  groupPrefix: string | undefined,
  shapeIdx: number,
): void {
  const shapeName = getShapeName(sp);
  const placeholderType = getPlaceholderType(sp);
  const location = `${groupPrefix || `slide${slideIdx}`}/shape${shapeIdx}`;

  // Check for table
  const txBody = findFirstChild(sp, NS_P, 'txBody') || findFirstChild(sp, NS_A, 'txBody');
  if (!txBody) return;

  // Check for table
  const table = findFirstChild(txBody, NS_A, 'tbl');
  if (table) {
    extractFromTable(table, slideFile, slideIdx, units, location);
    return;
  }

  // Regular text frame extraction
  extractFromTextBody(txBody, slideFile, slideIdx, units, location, TranslationSource.SlideBody, {
    slideNumber: slideIdx + 1,
    shapeName,
    shapeType: 'sp',
    placeholderType,
  });
}

function processGroupShape(
  grpSp: Element,
  slideFile: string,
  slideIdx: number,
  units: TranslationUnit[],
  groupPrefix: string | undefined,
  groupIdx: number,
): void {
  const location = `${groupPrefix || `slide${slideIdx}`}/group${groupIdx}`;
  processShapeTree(grpSp, slideFile, slideIdx, units, location);
}

// Text body extraction

function extractFromTextBody(
  txBody: Element,
  slideFile: string,
  slideIdx: number,
  units: TranslationUnit[],
  locationPrefix: string,
  source: TranslationSource,
  context?: TranslationContext,
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
      xmlFilePath: slideFile,
      xmlNodePath: `${locationPrefix}/p${pIdx}`,
      context,
    });
  }
}

function extractRuns(para: Element): TextRun[] {
  const runs: TextRun[] = [];
  const runElements = getChildren(para, NS_A, 'r');

  for (let i = 0; i < runElements.length; i++) {
    const runEl = runElements[i];
    const tEl = findFirstChild(runEl, NS_A, 't');
    const text = tEl?.textContent || '';
    const format = extractRunFormat(runEl);

    runs.push({
      index: i,
      text,
      format,
      xmlElement: tEl || undefined,
    });
  }

  return runs;
}

function extractRunFormat(runEl: Element): RunFormat {
  const rPr = findFirstChild(runEl, NS_A, 'rPr');
  if (!rPr) return {};

  const format: RunFormat = {};

  // Bold
  const bAttr = rPr.getAttribute('b');
  if (bAttr) format.bold = bAttr !== '0';

  // Italic
  const iAttr = rPr.getAttribute('i');
  if (iAttr) format.italic = iAttr !== '0';

  // Underline
  const uAttr = rPr.getAttribute('u');
  if (uAttr && uAttr !== 'none') format.underline = true;

  // Font size (in hundredths of a point, e.g. 1200 = 12pt)
  const szAttr = rPr.getAttribute('sz');
  if (szAttr) format.fontSize = parseInt(szAttr, 10);

  // Strike
  const strikeAttr = rPr.getAttribute('strike');
  if (strikeAttr && strikeAttr !== 'noStrike') format.strike = true;

  // Baseline (for superscript/subscript)
  const baselineAttr = rPr.getAttribute('baseline');
  if (baselineAttr) format.baseline = parseInt(baselineAttr, 10);

  // Language
  const langAttr = rPr.getAttribute('lang');
  if (langAttr) format.lang = langAttr;

  // Dirty
  const dirtyAttr = rPr.getAttribute('dirty');
  if (dirtyAttr) format.dirty = dirtyAttr !== '0';

  // Font family
  const latin = findFirstChild(rPr, NS_A, 'latin');
  if (latin) {
    const typeface = latin.getAttribute('typeface');
    if (typeface) format.fontFamily = typeface;
  }

  const ea = findFirstChild(rPr, NS_A, 'ea');
  if (ea) {
    const typeface = ea.getAttribute('typeface');
    if (typeface && !format.fontFamily) format.fontFamily = typeface;
  }

  // Color
  const solidFill = findFirstChild(rPr, NS_A, 'solidFill');
  if (solidFill) {
    const srgbClr = findFirstChild(solidFill, NS_A, 'srgbClr');
    if (srgbClr) {
      const val = srgbClr.getAttribute('val');
      if (val) format.color = val;
    }
  }

  return format;
}

// Table extraction

function extractFromTable(
  tbl: Element,
  slideFile: string,
  slideIdx: number,
  units: TranslationUnit[],
  locationPrefix: string,
): void {
  const rows = getChildren(tbl, NS_A, 'tr');
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const cells = getChildren(rows[rIdx], NS_A, 'tc');
    for (let cIdx = 0; cIdx < cells.length; cIdx++) {
      const cell = cells[cIdx];
      const txBody = findFirstChild(cell, NS_A, 'txBody');
      if (!txBody) continue;

      extractFromTextBody(
        txBody, slideFile, slideIdx, units,
        `${locationPrefix}/table/r${rIdx}/c${cIdx}`,
        TranslationSource.TableCell,
        { slideNumber: slideIdx + 1, shapeType: 'table' },
      );
    }
  }
}

// Chart extraction

function extractFromChart(
  chartFile: string,
  slideIdx: number,
  archive: PptxArchive,
  units: TranslationUnit[],
): void {
  const chartXml = archive.xmlFiles.get(chartFile);
  if (!chartXml) return;

  const doc = parseXml(chartXml, chartFile);
  const chart = findFirstChild(doc.documentElement, NS_C, 'chart')
    || doc.documentElement;

  // Chart title
  const title = findDescendant(chart, NS_C, 'title');
  if (title) {
    const tx = findDescendant(title, NS_C, 'tx');
    if (tx) {
      // c:rich may be in NS_A or NS_C namespace
      const rich = findDescendant(tx, NS_A, 'rich') || findDescendant(tx, NS_C, 'rich');
      const bodyContent = rich || tx;
      extractFromTextBody(
        bodyContent, chartFile, slideIdx, units,
        `slide${slideIdx}/chart-title`,
        TranslationSource.ChartTitle,
        { slideNumber: slideIdx + 1, shapeType: 'chart-title' },
      );
    }
  }
}


// Notes extraction

function extractFromNotes(
  notesFile: string,
  slideIdx: number,
  archive: PptxArchive,
  units: TranslationUnit[],
): void {
  const notesXml = archive.xmlFiles.get(notesFile);
  if (!notesXml) return;

  const doc = parseXml(notesXml, notesFile);

  // Notes slides have similar structure to slides
  const notesBody = doc.getElementsByTagNameNS(NS_P, 'notes')[0]
    || doc.documentElement;

  const spTree = findFirstChild(notesBody, NS_P, 'cSld');
  if (spTree) {
    // Find the notes text shape
    const spElements = spTree.getElementsByTagNameNS(NS_P, 'sp');
    for (let i = 0; i < spElements.length; i++) {
      const sp = spElements[i];
      const ph = findDescendant(sp, NS_P, 'ph');
      // Skip slide image placeholder
      const phType = ph?.getAttribute('type');
      if (phType === 'sldImg') continue;

      const txBody = findFirstChild(sp, NS_P, 'txBody') || findFirstChild(sp, NS_A, 'txBody');
      if (!txBody) continue;

      extractFromTextBody(
        txBody, notesFile, slideIdx, units,
        `slide${slideIdx}/notes`,
        TranslationSource.Notes,
        { slideNumber: slideIdx + 1, shapeType: 'notes' },
      );
    }
  }
}

// XML helper functions

function parseXml(xml: string, filename: string): Document {
  try {
    return new DOMParser().parseFromString(xml, 'text/xml');
  } catch (e) {
    throw new Error(`Failed to parse XML: ${filename}`);
  }
}

function findFirstChild(parent: Element, ns: string, localName: string): Element | null {
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i] as Element;
    if (child.nodeType !== 1) continue;
    // Use namespace-aware comparison
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

function getLocalName(element: Element): string {
  const tag = element.tagName || '';
  const colonIdx = tag.indexOf(':');
  return colonIdx >= 0 ? tag.substring(colonIdx + 1) : tag;
}

function getShapeName(sp: Element): string {
  const nvSpPr = findFirstChild(sp, NS_P, 'nvSpPr');
  if (!nvSpPr) return '';
  const cNvPr = findDescendant(nvSpPr, NS_P, 'cNvPr');
  return cNvPr?.getAttribute('name') || '';
}

function getPlaceholderType(sp: Element): string | undefined {
  const ph = findDescendant(sp, NS_P, 'ph');
  return ph?.getAttribute('type') || undefined;
}

function getDirectText(element: Element): string {
  // Get text content from paragraphs without runs
  let text = '';
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === 3) { // text node
      text += child.textContent || '';
    }
  }
  // Also check a:t direct children
  const tElements = element.getElementsByTagNameNS(NS_A, 't');
  if (tElements.length > 0) {
    text = '';
    for (let i = 0; i < tElements.length; i++) {
      text += tElements[i].textContent || '';
    }
  }
  return text;
}