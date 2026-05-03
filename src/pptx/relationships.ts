import { PptxArchive, PptxRelationships, RelInfo } from '../types.js';
import {
  REL_TYPE_CHART,
  REL_TYPE_DIAGRAM,
  REL_TYPE_NOTES,
  REL_TYPE_IMAGE,
  REL_TYPE_SLIDE,
  REL_TYPE_SLIDEMASTER,
  REL_TYPE_SLIDELAYOUT,
  PPTX_FILE_PATTERNS,
} from '../utils/xml-namespaces.js';
import { DOMParser } from '@xmldom/xmldom';

export function parseRelationships(archive: PptxArchive): PptxRelationships {
  const slideToChart = new Map<string, string[]>();
  const slideToDiagram = new Map<string, string[]>();
  const slideToNotes = new Map<string, string>();
  const slideToImage = new Map<string, string[]>();

  // Parse each slide's .rels file
  for (const [filename, content] of archive.xmlFiles) {
    if (!PPTX_FILE_PATTERNS.slideRels.test(filename)) continue;

    const rels = parseRelsXml(content);
    const slideFile = filename.replace('/_rels/', '/').replace('.xml.rels', '.xml');

    const charts: string[] = [];
    const diagrams: string[] = [];
    const images: string[] = [];
    let notesFile = '';

    for (const rel of rels) {
      // Resolve relative target path to absolute path within ZIP
      const target = resolveTarget(filename, rel.target);

      if (rel.type === REL_TYPE_CHART) {
        charts.push(target);
      } else if (rel.type === REL_TYPE_DIAGRAM) {
        diagrams.push(target);
      } else if (rel.type === REL_TYPE_NOTES) {
        notesFile = target;
      } else if (rel.type === REL_TYPE_IMAGE) {
        images.push(target);
      }
    }

    if (charts.length > 0) slideToChart.set(slideFile, charts);
    if (diagrams.length > 0) slideToDiagram.set(slideFile, diagrams);
    if (notesFile) slideToNotes.set(slideFile, notesFile);
    if (images.length > 0) slideToImage.set(slideFile, images);
  }

  return { slideToChart, slideToDiagram, slideToNotes, slideToImage };
}

function parseRelsXml(xmlContent: string): RelInfo[] {
  const rels: RelInfo[] = [];
  try {
    const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
    const relationships = doc.getElementsByTagName('Relationship');
    for (let i = 0; i < relationships.length; i++) {
      const rel = relationships[i];
      const type = rel.getAttribute('Type') || '';
      const target = rel.getAttribute('Target') || '';
      const id = rel.getAttribute('Id') || '';
      rels.push({ type, target, id });
    }
  } catch {
    // Skip invalid .rels files
  }
  return rels;
}

function resolveTarget(relsFilePath: string, targetPath: string): string {
  // .rels files use relative paths from their own directory

  if (targetPath.startsWith('/')) {
    // Absolute path within the package
    return targetPath.substring(1);
  }

  // Get the directory of the rels file (e.g., "ppt/slides/_rels")
  const relsDir = relsFilePath.substring(0, relsFilePath.lastIndexOf('/'));
  // Source directory is one level up from _rels
  const sourceDir = relsDir.replace('/_rels', '');

  // Combine and normalize
  const combined = sourceDir + '/' + targetPath;
  return normalizePath(combined);
}

function normalizePath(path: string): string {
  // Remove ../ and ./ segments
  const parts = path.split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      if (result.length > 0) result.pop();
    } else if (part !== '.' && part !== '') {
      result.push(part);
    }
  }
  return result.join('/');
}

export function getSlideOrder(archive: PptxArchive): string[] {
  // Parse ppt/presentation.xml for slide order
  const presXml = archive.xmlFiles.get('ppt/presentation.xml');
  if (!presXml) {
    // Fallback: sort slide files by number
    return [...archive.xmlFiles.keys()]
      .filter(f => PPTX_FILE_PATTERNS.slides.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });
  }

  try {
    const doc = new DOMParser().parseFromString(presXml, 'text/xml');
    const nsP = 'http://schemas.openxmlformats.org/presentationml/2006/main';
    const nsR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

    // Find sldIdLst entries and resolve via presentation.xml.rels
    const sldIdElements = doc.getElementsByTagNameNS(nsP, 'sldId');
    const presRels = archive.xmlFiles.get('ppt/_rels/presentation.xml.rels');

    if (!presRels) {
      return [...archive.xmlFiles.keys()]
        .filter(f => PPTX_FILE_PATTERNS.slides.test(f))
        .sort();
    }

    const relsMap = parseRelsXml(presRels);
    const rIdToTarget = new Map<string, string>();
    for (const rel of relsMap) {
      if (rel.type === REL_TYPE_SLIDE) {
        rIdToTarget.set(rel.id, resolveTarget('ppt/_rels/presentation.xml.rels', rel.target));
      }
    }

    const slideOrder: string[] = [];
    for (let i = 0; i < sldIdElements.length; i++) {
      const rId = sldIdElements[i].getAttributeNS(nsR, 'id') || '';
      const target = rIdToTarget.get(rId);
      if (target) slideOrder.push(target);
    }

    return slideOrder.length > 0 ? slideOrder : [...archive.xmlFiles.keys()]
      .filter(f => PPTX_FILE_PATTERNS.slides.test(f))
      .sort();
  } catch {
    return [...archive.xmlFiles.keys()]
      .filter(f => PPTX_FILE_PATTERNS.slides.test(f))
      .sort();
  }
}