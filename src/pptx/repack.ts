import { PptxArchive } from '../types.js';
import { writeFile } from 'node:fs/promises';

export async function repackPptx(archive: PptxArchive, outputPath: string): Promise<void> {
  // Re-inject modified XML content back into the JSZip object
  for (const [filename, content] of archive.xmlFiles) {
    const existingFile = archive.zip.file(filename);
    const compression = archive.originalCompression.get(filename) ?? 'DEFLATE';
    const compressionOptions = compression === 'DEFLATE'
      ? { compression: 'DEFLATE', compressionOptions: { level: 6 } }
      : { compression: 'STORE' };

    if (existingFile) {
      archive.zip.file(filename, content, compressionOptions as any);
    }
  }

  // Binary files should already be in the zip from the original load
  // but we ensure they're present with correct compression
  for (const [filename, content] of archive.binaryFiles) {
    const compression = archive.originalCompression.get(filename) ?? 'DEFLATE';
    const compressionOptions = compression === 'DEFLATE'
      ? { compression: 'DEFLATE', compressionOptions: { level: 6 } }
      : { compression: 'STORE' };

    archive.zip.file(filename, content, compressionOptions as any);
  }

  const buffer = await archive.zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  await writeFile(outputPath, buffer);
}