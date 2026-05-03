import { PptxArchive, CliConfig, XmlTextNode, LangDetectStrategy } from '../types.js';
import { TranslationService } from '../translation/service.js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { detectStrategy } from '../utils/lang-detect.js';
import {
  NS_A, NS_C,
  PPTX_FILE_PATTERNS,
} from '../utils/xml-namespaces.js';

const xmlSerializer = new XMLSerializer();

export interface XmlFallbackResult {
  nodesTranslated: number;
  filesModified: string[];
}

export async function translateXmlFallback(
  archive: PptxArchive,
  translator: TranslationService,
  config: CliConfig,
): Promise<XmlFallbackResult> {
  const shouldTranslate = detectStrategy(config.langDetect === LangDetectStrategy.All ? 'all' : 'cjk');
  let nodesTranslated = 0;
  const filesModified: string[] = [];

  // Determine which files to process
  const filesToProcess = getXmlFilesForFallback(archive, config);

  for (const filePath of filesToProcess) {
    const xmlContent = archive.xmlFiles.get(filePath);
    if (!xmlContent) continue;

    try {
      const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
      const nodes = findXmlTextNodes(doc, filePath, shouldTranslate);

      if (nodes.length === 0) continue;

      // Batch translate
      const texts = nodes.map(n => n.originalText);
      const translations = await translator.translateBatch(
        texts.map((t, i) => ({
          id: `xml-${filePath}-${i}`,
          location: `xml-fallback/${filePath}/node${i}`,
          source: 'xml-fallback' as any,
          runs: [{ index: 0, text: t, format: {} }],
          sourceText: t,
          markedText: `[[R0]]${t}[[/R0]]`,
          xmlFilePath: filePath,
          xmlNodePath: `node${i}`,
        })),
      );

      // Write back translations
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const result = translations[i];
        if (!result || !result.translatedText) continue;

        // Update the text content of the XML element
        setTextContent(node.xmlElement, result.translatedText);
        nodesTranslated++;
      }

      // Serialize back to string
      const updatedXml = xmlSerializer.serializeToString(doc);
      archive.xmlFiles.set(filePath, updatedXml);
      filesModified.push(filePath);

      if (config.verbose) {
        console.log(`[xml-pass] ${filePath}: translated ${nodes.length} text nodes`);
      }
    } catch {
      // Skip files that fail to parse
      continue;
    }
  }

  return { nodesTranslated, filesModified };
}

function getXmlFilesForFallback(archive: PptxArchive, config: CliConfig): string[] {
  const files: string[] = [];

  for (const [filename] of archive.xmlFiles) {
    if (PPTX_FILE_PATTERNS.slides.test(filename)) {
      files.push(filename);
    }
    if (PPTX_FILE_PATTERNS.charts.test(filename)) {
      files.push(filename);
    }
    if (PPTX_FILE_PATTERNS.diagrams.test(filename)) {
      files.push(filename);
    }
    if (config.includeNotes && PPTX_FILE_PATTERNS.notesSlides.test(filename)) {
      files.push(filename);
    }
    if (PPTX_FILE_PATTERNS.slideMasters.test(filename)) {
      files.push(filename);
    }
    if (PPTX_FILE_PATTERNS.slideLayouts.test(filename)) {
      files.push(filename);
    }
  }

  return files;
}

function findXmlTextNodes(
  doc: Document,
  filePath: string,
  shouldTranslate: (text: string) => boolean,
): XmlTextNode[] {
  const nodes: XmlTextNode[] = [];
  let aIdx = 0;
  let cIdx = 0;

  // Find all a:t elements (DrawingML text)
  const aTElements = doc.getElementsByTagNameNS(NS_A, 't');
  for (let i = 0; i < aTElements.length; i++) {
    const el = aTElements[i];
    const text = el.textContent || '';
    if (!text || !text.trim()) continue;
    if (shouldTranslate(text)) {
      nodes.push({
        filePath,
        nodeTag: 'a:t',
        nodeIndex: aIdx++,
        originalText: text,
        xmlElement: el,
      });
    }
  }

  // Find all c:v elements (chart values)
  const cVElements = doc.getElementsByTagNameNS(NS_C, 'v');
  for (let i = 0; i < cVElements.length; i++) {
    const el = cVElements[i];
    const text = el.textContent || '';
    if (!text || !text.trim()) continue;
    // Only translate chart values that contain text-like content
    if (shouldTranslate(text) && !isPureNumeric(text)) {
      nodes.push({
        filePath,
        nodeTag: 'c:v',
        nodeIndex: cIdx++,
        originalText: text,
        xmlElement: el,
      });
    }
  }

  return nodes;
}

function isPureNumeric(text: string): boolean {
  return /^[\d.,\s%\-+]+$/.test(text.trim());
}

function setTextContent(element: Element, text: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  element.appendChild(element.ownerDocument!.createTextNode(text));
}