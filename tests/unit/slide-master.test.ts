import { describe, it, expect } from 'vitest';
import { extractMasterLayoutText } from '../../src/pptx/slide-master.js';
import { PptxArchive, TranslationSource, CliConfig } from '../../src/types.js';
import JSZip from 'jszip';

function createArchiveWithMaster(masterXml: string, layoutXml?: string): PptxArchive {
  const xmlFiles = new Map<string, string>();
  xmlFiles.set('ppt/slideMasters/slideMaster1.xml', masterXml);
  if (layoutXml) {
    xmlFiles.set('ppt/slideLayouts/slideLayout1.xml', layoutXml);
  }
  return { zip: new JSZip(), xmlFiles, binaryFiles: new Map(), originalCompression: new Map() };
}

const masterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:bg/>
    <p:spTree>
      <p:nvGrpSpPr/>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title Placeholder"/>
          <p:nvPr>
            <p:ph type="ctrTitle"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:endParaRPr lang="zh-CN"/>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Footer"/>
          <p:nvPr>
            <p:ph type="ftr" idx="2"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="zh-CN"/>
              <a:t>公司名称</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldMaster>`;

const layoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld name="Title Slide">
    <p:spTree>
      <p:nvGrpSpPr/>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:nvPr>
            <p:ph type="ctrTitle"/>
          </p:nvPr>
        </p:nvSpPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US"/>
              <a:t>Click to add title</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;

const configWithMaster: CliConfig = {
  inputPath: 'test.pptx',
  sourceLang: 'zh',
  targetLang: 'en',
  baseUrl: '',
  apiKey: '',
  model: '',
  timeout: 0,
  retries: 0,
  retryDelay: 0,
  batchSize: 20,
  batchMaxChars: 8000,
  maxWorkers: 5,
  rpm: 60,
  tpm: 100000,
  includeNotes: false,
  includeMasterLayout: true,
  langDetect: 'cjk' as any,
  verbose: false,
};

const configWithoutMaster: CliConfig = {
  ...configWithMaster,
  includeMasterLayout: false,
};

describe('Slide master/layout extraction', () => {
  it('should extract text from slideMaster when enabled', () => {
    const archive = createArchiveWithMaster(masterXml);
    const units = extractMasterLayoutText(archive, configWithMaster);

    expect(units.length).toBeGreaterThan(0);
    expect(units.some(u => u.sourceText === '公司名称')).toBe(true);
  });

  it('should not extract when includeMasterLayout is false', () => {
    const archive = createArchiveWithMaster(masterXml);
    const units = extractMasterLayoutText(archive, configWithoutMaster);

    expect(units.length).toBe(0);
  });

  it('should assign SlideMaster source type', () => {
    const archive = createArchiveWithMaster(masterXml);
    const units = extractMasterLayoutText(archive, configWithMaster);

    for (const unit of units) {
      expect(unit.source).toBe(TranslationSource.SlideMaster);
    }
  });

  it('should extract from slideLayout files', () => {
    const archive = createArchiveWithMaster(masterXml, layoutXml);
    const units = extractMasterLayoutText(archive, configWithMaster);

    const layoutUnits = units.filter(u => u.source === TranslationSource.SlideLayout);
    expect(layoutUnits.length).toBeGreaterThan(0);
    expect(layoutUnits.some(u => u.sourceText === 'Click to add title')).toBe(true);
  });

  it('should extract run format from master text', () => {
    const archive = createArchiveWithMaster(masterXml);
    const units = extractMasterLayoutText(archive, configWithMaster);

    const footerUnit = units.find(u => u.sourceText === '公司名称');
    if (footerUnit) {
      expect(footerUnit.runs.length).toBe(1);
      expect(footerUnit.markedText).toContain('[[R0]]');
    }
  });

  it('should skip empty paragraphs', () => {
    const archive = createArchiveWithMaster(masterXml);
    const units = extractMasterLayoutText(archive, configWithMaster);

    // Title placeholder has empty paragraph (only endParaRPr)
    const emptyUnits = units.filter(u => u.sourceText.trim() === '');
    expect(emptyUnits.length).toBe(0);
  });
});