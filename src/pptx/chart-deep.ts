import { PptxArchive, TranslationUnit, TranslationSource, TextRun } from '../types.js';
import { DOMParser } from '@xmldom/xmldom';
import {
  NS_A, NS_C,
  PPTX_FILE_PATTERNS,
} from '../utils/xml-namespaces.js';

let unitIdCounter = 0;

export function resetChartDeepCounter(): void {
  unitIdCounter = 0;
}

export function extractChartDeepText(
  archive: PptxArchive,
  chartFile: string,
  slideIdx: number,
): TranslationUnit[] {
  const units: TranslationUnit[] = [];
  const chartXml = archive.xmlFiles.get(chartFile);
  if (!chartXml) return units;

  const doc = parseXml(chartXml, chartFile);
  const chartSpace = doc.documentElement;
  const chart = findChild(chartSpace, NS_C, 'chart') || chartSpace;

  // 1. Axis titles (catAx/title, valAx/title, serAx/title)
  extractAxisTitles(chart, chartFile, slideIdx, units);

  // 2. Series names (c:ser/c:tx via strRef/strCache or rich)
  extractSeriesNames(chart, chartFile, slideIdx, units);

  // 3. Category names (c:ser/c:cat via strRef/strCache or multiLvlStrRef)
  extractCategoryNames(chart, chartFile, slideIdx, units);

  // 4. Data labels (c:dLbl/c:tx or c:dLbls with text)
  extractDataLabels(chart, chartFile, slideIdx, units);

  // 5. Legend entries with explicit text
  extractLegendText(chart, chartFile, slideIdx, units);

  return units;
}

// Axis titles
function extractAxisTitles(
  chart: Element,
  chartFile: string,
  slideIdx: number,
  units: TranslationUnit[],
): void {
  // Check catAx, valAx, serAx for title elements
  const axisTypes = ['catAx', 'valAx', 'serAx'];
  for (const axisType of axisTypes) {
    const axisElements = chart.getElementsByTagNameNS(NS_C, axisType);
    for (let aIdx = 0; aIdx < axisElements.length; aIdx++) {
      const axis = axisElements[aIdx];
      const title = findChild(axis, NS_C, 'title');
      if (!title) continue;

      const tx = findChild(title, NS_C, 'tx');
      if (!tx) continue;

      // Title text can be in rich text or strRef
      const rich = findDescendant(tx, NS_A, 'rich');
      if (rich) {
        extractFromRichText(rich, chartFile, slideIdx, units,
          `slide${slideIdx}/${axisType}${aIdx}-title`,
          axisType === 'catAx' ? TranslationSource.ChartAxis : TranslationSource.ChartAxis);
      }

      // Also check strRef/strCache
      const strRef = findChild(tx, NS_C, 'strRef');
      if (strRef) {
        const strCache = findChild(strRef, NS_C, 'strCache');
        if (strCache) {
          extractFromStrCache(strCache, chartFile, slideIdx, units,
            `slide${slideIdx}/${axisType}${aIdx}-title`,
            TranslationSource.ChartAxis);
        }
      }
    }
  }
}

// Series names
function extractSeriesNames(
  chart: Element,
  chartFile: string,
  slideIdx: number,
  units: TranslationUnit[],
): void {
  const serElements = chart.getElementsByTagNameNS(NS_C, 'ser');
  for (let sIdx = 0; sIdx < serElements.length; sIdx++) {
    const ser = serElements[sIdx];
    const tx = findChild(ser, NS_C, 'tx');
    if (!tx) continue;

    // Series name can be in strRef/strCache or rich
    const strRef = findChild(tx, NS_C, 'strRef');
    if (strRef) {
      const strCache = findChild(strRef, NS_C, 'strCache');
      if (strCache) {
        extractFromStrCache(strCache, chartFile, slideIdx, units,
          `slide${slideIdx}/ser${sIdx}-name`,
          TranslationSource.ChartSeriesName);
      }
    }

    const rich = findDescendant(tx, NS_A, 'rich');
    if (rich) {
      extractFromRichText(rich, chartFile, slideIdx, units,
        `slide${slideIdx}/ser${sIdx}-name`,
        TranslationSource.ChartSeriesName);
    }
  }
}

// Category names
function extractCategoryNames(
  chart: Element,
  chartFile: string,
  slideIdx: number,
  units: TranslationUnit[],
): void {
  const serElements = chart.getElementsByTagNameNS(NS_C, 'ser');
  for (let sIdx = 0; sIdx < serElements.length; sIdx++) {
    const ser = serElements[sIdx];
    const cat = findChild(ser, NS_C, 'cat');
    if (!cat) continue;

    // Simple strRef/strCache
    const strRef = findChild(cat, NS_C, 'strRef');
    if (strRef) {
      const strCache = findChild(strRef, NS_C, 'strCache');
      if (strCache) {
        extractFromStrCache(strCache, chartFile, slideIdx, units,
          `slide${slideIdx}/ser${sIdx}-cat`,
          TranslationSource.ChartAxis);
      }
    }

    // Multi-level strRef
    const multiLvlStrRef = findChild(cat, NS_C, 'multiLvlStrRef');
    if (multiLvlStrRef) {
      const multiLvlStrCache = findChild(multiLvlStrRef, NS_C, 'multiLvlStrCache');
      if (multiLvlStrCache) {
        // Each level contains pt elements with c:v text
        const lvlElements = multiLvlStrCache.getElementsByTagNameNS(NS_C, 'lvl');
        for (let lIdx = 0; lIdx < lvlElements.length; lIdx++) {
          extractFromStrCache(lvlElements[lIdx], chartFile, slideIdx, units,
            `slide${slideIdx}/ser${sIdx}-cat-lvl${lIdx}`,
            TranslationSource.ChartAxis);
        }
      }
    }

    // Also check for noMultiLvlLbl with direct text
    const numRef = findChild(cat, NS_C, 'numRef');
    // numRef contains numeric data — skip for translation
  }
}

// Data labels
function extractDataLabels(
  chart: Element,
  chartFile: string,
  slideIdx: number,
  units: TranslationUnit[],
): void {
  // Individual data labels: c:dLbl inside c:ser
  const serElements = chart.getElementsByTagNameNS(NS_C, 'ser');
  for (let sIdx = 0; sIdx < serElements.length; sIdx++) {
    const ser = serElements[sIdx];

    // Individual dLbl elements with text
    const dLblElements = ser.getElementsByTagNameNS(NS_C, 'dLbl');
    for (let dIdx = 0; dIdx < dLblElements.length; dIdx++) {
      const dLbl = dLblElements[dIdx];
      const tx = findChild(dLbl, NS_C, 'tx');
      if (!tx) continue;

      // Check for rich text containing translatable text
      const rich = findDescendant(tx, NS_A, 'rich');
      if (rich) {
        extractFromRichText(rich, chartFile, slideIdx, units,
          `slide${slideIdx}/ser${sIdx}-dLbl${dIdx}`,
          TranslationSource.ChartDataLabel);
      }

      // Check strRef/strCache (category name labels)
      const strRef = findChild(tx, NS_C, 'strRef');
      if (strRef) {
        const strCache = findChild(strRef, NS_C, 'strCache');
        if (strCache) {
          extractFromStrCache(strCache, chartFile, slideIdx, units,
            `slide${slideIdx}/ser${sIdx}-dLbl${dIdx}`,
            TranslationSource.ChartDataLabel);
        }
      }
    }

    // Also check dLbls (data label settings) — may contain showSerName, showCatName etc.
    // These are settings, not text content — skip
  }

  // Chart-level dLbls (shared data labels)
  const chartDLbls = chart.getElementsByTagNameNS(NS_C, 'dLbls');
  for (let dIdx = 0; dIdx < chartDLbls.length; dIdx++) {
    const dLbls = chartDLbls[dIdx];
    const tx = findChild(dLbls, NS_C, 'tx');
    if (!tx) continue;

    const rich = findDescendant(tx, NS_A, 'rich');
    if (rich) {
      extractFromRichText(rich, chartFile, slideIdx, units,
        `slide${slideIdx}/dLbls${dIdx}`,
        TranslationSource.ChartDataLabel);
    }
  }
}

// Legend text
function extractLegendText(
  chart: Element,
  chartFile: string,
  slideIdx: number,
  units: TranslationUnit[],
): void {
  const legend = findChild(chart, NS_C, 'legend');
  if (!legend) return;

  // Legend entries may have explicit tx elements (rare, but possible)
  const legendEntries = legend.getElementsByTagNameNS(NS_C, 'legendEntry');
  for (let lIdx = 0; lIdx < legendEntries.length; lIdx++) {
    const entry = legendEntries[lIdx];
    const tx = findChild(entry, NS_C, 'tx');
    if (!tx) continue;

    const rich = findDescendant(tx, NS_A, 'rich');
    if (rich) {
      extractFromRichText(rich, chartFile, slideIdx, units,
        `slide${slideIdx}/legend-entry${lIdx}`,
        TranslationSource.ChartLegend);
    }

    const strRef = findChild(tx, NS_C, 'strRef');
    if (strRef) {
      const strCache = findChild(strRef, NS_C, 'strCache');
      if (strCache) {
        extractFromStrCache(strCache, chartFile, slideIdx, units,
          `slide${slideIdx}/legend-entry${lIdx}`,
          TranslationSource.ChartLegend);
      }
    }
  }
}

// Extract from DrawingML rich text
function extractFromRichText(
  rich: Element,
  chartFile: string,
  slideIdx: number,
  units: TranslationUnit[],
  locationPrefix: string,
  source: TranslationSource,
): void {
  const paragraphs = rich.getElementsByTagNameNS(NS_A, 'p');
  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx];
    const runs = extractRunsFromParagraph(para);
    const sourceText = runs.length > 0
      ? runs.map(r => r.text).join('')
      : collectTextFromElement(para);

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
      xmlFilePath: chartFile,
      xmlNodePath: `${locationPrefix}/p${pIdx}`,
      context: { slideNumber: slideIdx + 1, shapeType: source },
    });
  }
}

// Extract from c:strCache
function extractFromStrCache(
  strCache: Element,
  chartFile: string,
  slideIdx: number,
  units: TranslationUnit[],
  locationPrefix: string,
  source: TranslationSource,
): void {
  // strCache contains pt elements with c:v values
  const ptElements = strCache.getElementsByTagNameNS(NS_C, 'pt');
  for (let ptIdx = 0; ptIdx < ptElements.length; ptIdx++) {
    const pt = ptElements[ptIdx];
    const vEl = findChild(pt, NS_C, 'v');
    if (!vEl) continue;

    const text = vEl.textContent || '';
    if (!text || !text.trim()) continue;
    // Skip pure numeric values
    if (isPureNumeric(text)) continue;

    units.push({
      id: `unit-${unitIdCounter++}`,
      location: `${locationPrefix}/pt${ptIdx}`,
      source,
      runs: [{
        index: 0,
        text,
        format: {},
        xmlElement: vEl,
      }],
      sourceText: text,
      markedText: `[[R0]]${text}[[/R0]]`,
      xmlFilePath: chartFile,
      xmlNodePath: `${locationPrefix}/pt${ptIdx}`,
      context: { slideNumber: slideIdx + 1, shapeType: source },
    });
  }
}

// Extract runs from a paragraph
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

// XML utility
function parseXml(xml: string, filename: string): Document {
  try {
    return new DOMParser().parseFromString(xml, 'text/xml');
  } catch {
    throw new Error(`Failed to parse chart XML: ${filename}`);
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

function collectTextFromElement(element: Element): string {
  const tElements = element.getElementsByTagNameNS(NS_A, 't');
  let text = '';
  for (let i = 0; i < tElements.length; i++) {
    text += tElements[i].textContent || '';
  }
  return text;
}

function isPureNumeric(text: string): boolean {
  return /^[\d.,\s%\-+]+$/.test(text.trim());
}