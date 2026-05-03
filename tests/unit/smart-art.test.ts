import { describe, it, expect } from 'vitest';
import { extractSmartArtText } from '../../src/pptx/smart-art.js';
import { PptxArchive, TranslationSource } from '../../src/types.js';
import JSZip from 'jszip';

// Create a mock archive with SmartArt diagram data XML
function createSmartArtArchive(diagramXml: string): PptxArchive {
  const zip = new JSZip();
  const xmlFiles = new Map<string, string>();
  xmlFiles.set('ppt/diagrams/data1.xml', diagramXml);
  return { zip, xmlFiles, binaryFiles: new Map(), originalCompression: new Map() };
}

const smartArtDataXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"
               xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <dgm:ptLst>
    <dgm:pt modelId="0" type="doc">
      <dgm:prSet/>
      <a:spPr/>
      <a:t>文档标题</a:t>
    </dgm:pt>
    <dgm:pt modelId="2" type="par">
      <a:spPr/>
      <dgm:t>
        <a:bodyPr/>
        <a:lstStyle/>
        <a:p>
          <a:pPr/>
          <a:r>
            <a:rPr lang="zh-CN"/>
            <a:t>第一个要点</a:t>
          </a:r>
        </a:p>
      </dgm:t>
    </dgm:pt>
    <dgm:pt modelId="3" type="par">
      <a:spPr/>
      <dgm:t>
        <a:bodyPr/>
        <a:lstStyle/>
        <a:p>
          <a:pPr/>
          <a:r>
            <a:rPr lang="zh-CN" b="1"/>
            <a:t>第二个要点</a:t>
          </a:r>
          <a:r>
            <a:rPr lang="zh-CN" i="1"/>
            <a:t>（补充说明）</a:t>
          </a:r>
        </a:p>
      </dgm:t>
    </dgm:pt>
    <dgm:pt modelId="4" type="conn">
      <dgm:prSet/>
      <a:spPr/>
    </dgm:pt>
  </dgm:ptLst>
  <dgm:cxLst/>
  <dgm:pres/>
</dgm:dataModel>`;

describe('SmartArt extraction', () => {
  it('should extract text from SmartArt pt elements', () => {
    const archive = createSmartArtArchive(smartArtDataXml);
    const units = extractSmartArtText(archive, 'ppt/diagrams/data1.xml', 0);

    // Should find text units (skip conn type)
    expect(units.length).toBeGreaterThan(0);
  });

  it('should skip conn type pt elements', () => {
    const archive = createSmartArtArchive(smartArtDataXml);
    const units = extractSmartArtText(archive, 'ppt/diagrams/data1.xml', 0);

    // conn pt (modelId=4) should be skipped
    const connUnits = units.filter(u => u.location.includes('pt-4'));
    expect(connUnits.length).toBe(0);
  });

  it('should extract multi-run paragraphs with markers', () => {
    const archive = createSmartArtArchive(smartArtDataXml);
    const units = extractSmartArtText(archive, 'ppt/diagrams/data1.xml', 0);

    // pt modelId=3 has a paragraph with 2 runs
    const multiRunUnits = units.filter(u => u.runs.length > 1);
    expect(multiRunUnits.length).toBeGreaterThan(0);

    const multiRun = multiRunUnits[0];
    expect(multiRun.markedText).toContain('[[R0]]');
    expect(multiRun.markedText).toContain('[[R1]]');
  });

  it('should extract format attributes from runs', () => {
    const archive = createSmartArtArchive(smartArtDataXml);
    const units = extractSmartArtText(archive, 'ppt/diagrams/data1.xml', 0);

    // pt modelId=3 first run should be bold
    const unit = units.find(u => u.location.includes('pt-3'));
    if (unit && unit.runs.length > 0) {
      expect(unit.runs[0].format.bold).toBe(true);
    }
    if (unit && unit.runs.length > 1) {
      expect(unit.runs[1].format.italic).toBe(true);
    }
  });

  it('should handle standalone a:t elements', () => {
    const archive = createSmartArtArchive(smartArtDataXml);
    const units = extractSmartArtText(archive, 'ppt/diagrams/data1.xml', 0);

    // pt modelId=0 has a standalone a:t "文档标题"
    const standaloneUnits = units.filter(u => u.sourceText === '文档标题');
    expect(standaloneUnits.length).toBeGreaterThan(0);
  });

  it('should return empty for missing file', () => {
    const archive = createSmartArtArchive(smartArtDataXml);
    const units = extractSmartArtText(archive, 'ppt/diagrams/data99.xml', 0);
    expect(units.length).toBe(0);
  });

  it('should assign correct source type', () => {
    const archive = createSmartArtArchive(smartArtDataXml);
    const units = extractSmartArtText(archive, 'ppt/diagrams/data1.xml', 0);

    for (const unit of units) {
      expect(unit.source).toBe(TranslationSource.SmartArt);
    }
  });
});