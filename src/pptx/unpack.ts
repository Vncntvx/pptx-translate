import JSZip from 'jszip';
import { PptxArchive } from '../types.js';
import { readFile } from 'node:fs/promises';

export async function unpackPptx(filePath: string): Promise<PptxArchive> {
  const data = await readFile(filePath);
  const zip = await JSZip.loadAsync(data);

  const xmlFiles = new Map<string, string>();
  const binaryFiles = new Map<string, Uint8Array>();
  const originalCompression = new Map<string, string>();

  for (const [filename, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    const compression = file.options?.compression ?? 'STORE';
    originalCompression.set(filename, compression === 'DEFLATE' ? 'DEFLATE' : 'STORE');

    if (filename.endsWith('.xml') || filename.endsWith('.rels')) {
      const content = await file.async('string');
      xmlFiles.set(filename, content);
    } else {
      const content = await file.async('uint8array');
      binaryFiles.set(filename, content);
    }
  }

  return { zip, xmlFiles, binaryFiles, originalCompression };
}