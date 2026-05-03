import { describe, it, expect } from 'vitest';
import { unpackPptx } from '../../src/pptx/unpack.js';
import { repackPptx } from '../../src/pptx/repack.js';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures');
const SAMPLE_PATH = '/Volumes/Work/Project/pptTranslate/学术论文写作/test.pptx';

describe('PPTX unpack and repack', () => {
  it('should unpack and repack a PPTX without corruption', async () => {
    if (!existsSync(SAMPLE_PATH)) return;

    const archive = await unpackPptx(SAMPLE_PATH);

    // Verify XML files were extracted
    expect(archive.xmlFiles.size).toBeGreaterThan(0);

    // Check that slide XML files exist
    const slideFiles = [...archive.xmlFiles.keys()].filter(f => f.includes('slides/slide'));
    expect(slideFiles.length).toBeGreaterThan(0);

    // Verify binary files were extracted (images etc)
    expect(archive.binaryFiles.size).toBeGreaterThan(0);

    // Repack to a temp file
    const outputPath = join(FIXTURES_DIR, 'repack-test.pptx');
    await repackPptx(archive, outputPath);

    // Verify output file exists and has reasonable size
    expect(existsSync(outputPath)).toBe(true);
    const originalSize = readFileSync(SAMPLE_PATH).length;
    const outputSize = readFileSync(outputPath).length;
    // Output size may differ due to compression settings, allow 30% tolerance
    expect(outputSize).toBeGreaterThan(originalSize * 0.7);
    expect(outputSize).toBeLessThan(originalSize * 1.3);

    // Clean up
    unlinkSync(outputPath);
  });

  it('should preserve all XML files during repack', async () => {
    if (!existsSync(SAMPLE_PATH)) return;

    const archive = await unpackPptx(SAMPLE_PATH);
    const originalXmlCount = archive.xmlFiles.size;

    // Repack then unpack again
    const outputPath = join(FIXTURES_DIR, 'repack-verify.pptx');
    await repackPptx(archive, outputPath);

    const reUnpacked = await unpackPptx(outputPath);
    expect(reUnpacked.xmlFiles.size).toBe(originalXmlCount);

    // Clean up
    unlinkSync(outputPath);
  });
});