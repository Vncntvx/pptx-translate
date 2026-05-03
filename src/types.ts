export enum TranslationSource {
  SlideBody = 'slide-body',
  TableCell = 'table-cell',
  ChartTitle = 'chart-title',
  ChartAxis = 'chart-axis',
  ChartLegend = 'chart-legend',
  ChartDataLabel = 'chart-data-label',
  ChartSeriesName = 'chart-series-name',
  SmartArt = 'smart-art',
  Notes = 'notes',
  SlideMaster = 'slide-master',
  SlideLayout = 'slide-layout',
  XmlFallback = 'xml-fallback',
}

export enum LangDetectStrategy {
  Cjk = 'cjk',
  All = 'all',
}

// PPTX Archive

export interface PptxArchive {
  zip: import('jszip').JSZip;
  xmlFiles: Map<string, string>;
  binaryFiles: Map<string, Uint8Array>;
  originalCompression: Map<string, string>;
}

export interface RelInfo {
  type: string;
  target: string;
  id: string;
}

export interface PptxRelationships {
  slideToChart: Map<string, string[]>;
  slideToDiagram: Map<string, string[]>;
  slideToNotes: Map<string, string>;
  slideToImage: Map<string, string[]>;
}

// Translation Unit (Pass 1)

export interface TranslationUnit {
  id: string;
  location: string;
  source: TranslationSource;
  runs: TextRun[];
  sourceText: string;
  markedText: string;
  xmlFilePath: string;
  xmlNodePath: string;
  context?: TranslationContext;
}

export interface TranslationContext {
  slideNumber?: number;
  shapeName?: string;
  shapeType?: string;
  placeholderType?: string;
  surroundingText?: string;
}

// Text Run

export interface TextRun {
  index: number;
  text: string;
  format: RunFormat;
  xmlElement?: import('@xmldom/xmldom').Element;
}

export interface RunFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number; // hundredths of pt (1200 = 12pt)
  fontFamily?: string;
  color?: string; // RGB hex
  lang?: string;
  dirty?: boolean;
  strike?: boolean;
  shadow?: boolean;
  baseline?: number;
}

// XML Text Node (Pass 2)

export interface XmlTextNode {
  filePath: string;
  nodeTag: 'a:t' | 'c:v' | 'd:v';
  nodeIndex: number;
  originalText: string;
  xmlElement: import('@xmldom/xmldom').Element;
}

// Location Reference

export interface LocationRef {
  slideFile: string;
  slideIndex: number;
  shapeId: string;
  shapeName?: string;
  textBodyIndex: number;
  paragraphIndex: number;
  runIndexRange?: [number, number];
}

// Translation Result

export interface TranslationResult {
  unitId: string;
  translatedText: string;
  markerParsed: string[] | null;
  usedFallback: boolean;
  fallbackReason?: string;
  apiCallCount: number;
}

export interface XmlTranslationResult {
  filePath: string;
  nodeIndex: number;
  originalText: string;
  translatedText: string;
}

// Validation

export interface PreTranslationSnapshot {
  units: {
    id: string;
    sourceText: string;
    sourceHash: string;
    location: string;
  }[];
  xmlNodes: {
    filePath: string;
    nodeIndex: number;
    originalText: string;
    textHash: string;
  }[];
}

export interface ValidationReport {
  totalSourceUnits: number;
  translatedUnits: number;
  skippedUnits: number;
  failedUnits: number;
  fallbackUnits: number;
  xmlFallbackNodes: number;
  missingUnits: string[];
  formatWarnings: FormatWarning[];
  summary: string;
}

export interface FormatWarning {
  location: string;
  type: 'font-size-overflow' | 'run-structure-loss' | 'attribute-mismatch';
  detail: string;
}

export interface TranslationReport extends ValidationReport {
  unitDetails: TranslationUnitReport[];
  timestamp: string;
  inputPath: string;
  outputPath: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  totalApiCalls: number;
  totalTokensEstimated: number;
  durationMs: number;
}

export interface TranslationUnitReport {
  id: string;
  location: string;
  source: TranslationSource;
  sourceText: string;
  translatedText: string;
  status: 'success' | 'fallback' | 'failed' | 'skipped';
  markerPreserved: boolean;
  fallbackReason?: string;
}

// CLI Configuration

export interface CliConfig {
  inputPath: string;
  outputPath?: string;
  sourceLang: string;
  targetLang: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  batchSize: number;
  batchMaxChars: number;
  maxWorkers: number;
  rpm: number;
  tpm: number;
  includeNotes: boolean;
  includeMasterLayout: boolean;
  langDetect: LangDetectStrategy;
  verbose: boolean;
  reportPath?: string;
}

// Translation Service Internals

export interface BatchChunk {
  texts: string[];
  chunkId: string;
  estimatedTokens: number;
}

export interface CacheEntry {
  source: string;
  translated: string;
  timestamp: number;
}

// Pipeline Progress

export interface PipelineProgress {
  phase: 'unpack' | 'extract' | 'snapshot' | 'translate' | 'writeback' | 'xml-fallback' | 'validate' | 'repack';
  current: number;
  total: number;
  message: string;
}