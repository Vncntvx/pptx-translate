import { describe, it, expect } from 'vitest';
import { parseRelationships, getSlideOrder } from '../../src/pptx/relationships.js';
import { unpackPptx } from '../../src/pptx/unpack.js';
import { existsSync } from 'node:fs';

const SAMPLE_PATH = '/Volumes/Work/Project/pptTranslate/学术论文写作/test.pptx';

describe('relationships', () => {
  it('should parse relationships from a real PPTX', async () => {
    if (!existsSync(SAMPLE_PATH)) return;

    const archive = await unpackPptx(SAMPLE_PATH);
    const rels = parseRelationships(archive);

    expect(rels.slideToImage.size).toBeGreaterThan(0);
    expect(rels.slideToNotes.size).toBeGreaterThan(0);
  });

  it('should get slide order from presentation.xml', async () => {
    if (!existsSync(SAMPLE_PATH)) return;

    const archive = await unpackPptx(SAMPLE_PATH);
    const slideOrder = getSlideOrder(archive);

    expect(slideOrder.length).toBeGreaterThan(0);
    for (const slideFile of slideOrder) {
      expect(slideFile).toContain('slide');
      expect(slideFile).toContain('.xml');
    }
  });
});