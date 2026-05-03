export const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
export const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
export const NS_DGM = 'http://schemas.openxmlformats.org/drawingml/2006/diagram';

// Tag names for xmldom lookup

export const TAG_A_T = `${NS_A}:t`;
export const TAG_A_R = `${NS_A}:r`;
export const TAG_A_RPR = `${NS_A}:rPr`;
export const TAG_A_P = `${NS_A}:p`;
export const TAG_A_PPR = `${NS_A}:pPr`;
export const TAG_A_BODYPR = `${NS_A}:bodyPr`;
export const TAG_A_TBL = `${NS_A}:tbl`;
export const TAG_A_TR = `${NS_A}:tr`;
export const TAG_A_TC = `${NS_A}:tc`;
export const TAG_A_TXBODY = `${NS_A}:txBody`;
export const TAG_A_SOLIDFILL = `${NS_A}:solidFill`;
export const TAG_A_SRGBCLR = `${NS_A}:srgbClr`;
export const TAG_A_LATIN = `${NS_A}:latin`;
export const TAG_A_EA = `${NS_A}:ea`;

export const TAG_P_SP = `${NS_P}:sp`;
export const TAG_P_GRPSP = `${NS_P}:grpSp`;
export const TAG_P_GRPSPPR = `${NS_P}:grpSpPr`;
export const TAG_P_TXBODY = `${NS_P}:txBody`;
export const TAG_P_NVSPPR = `${NS_P}:nvSpPr`;
export const TAG_P_CNVSPPR = `${NS_P}:cxnSpPr`;
export const TAG_P_SPPR = `${NS_P}:spPr`;
export const TAG_P_PH = `${NS_P}:ph`;
export const TAG_P_PIC = `${NS_P}:pic`;
export const TAG_P_GRAPHICFRAME = `${NS_P}:graphicFrame`;
export const TAG_P_SLIDE = `${NS_P}:sld`;

export const TAG_C_TITLE = `${NS_C}:title`;
export const TAG_C_TX = `${NS_C}:tx`;
export const TAG_C_CHART = `${NS_C}:chart`;
export const TAG_C_CATAAX = `${NS_C}:catAx`;
export const TAG_C_VALAAX = `${NS_C}:valAx`;
export const TAG_C_LEGEND = `${NS_C}:legend`;
export const TAG_C_LEGENDENTRY = `${NS_C}:legendEntry`;
export const TAG_C_DLBL = `${NS_C}:dLbl`;
export const TAG_C_DLBLS = `${NS_C}:dLbls`;
export const TAG_C_SER = `${NS_C}:ser`;
export const TAG_C_V = `${NS_C}:v`;
export const TAG_C_STRREF = `${NS_C}:strRef`;
export const TAG_C_STRCACHE = `${NS_C}:strCache`;
export const TAG_C_PT = `${NS_C}:pt`;
export const TAG_C_F = `${NS_C}:f`;
export const TAG_C_V_CHART = `${NS_C}:v`;

// Relationship types

export const REL_TYPE_CHART = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
export const REL_TYPE_DIAGRAM = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData';
export const REL_TYPE_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
export const REL_TYPE_NOTES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide';
export const REL_TYPE_SLIDE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
export const REL_TYPE_SLIDEMASTER = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster';
export const REL_TYPE_SLIDELAYOUT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout';

// Namespace prefix map (for xmldom serialization)

export const NS_PREFIX_MAP: Record<string, string> = {
  [NS_A]: 'a',
  [NS_P]: 'p',
  [NS_R]: 'r',
  [NS_C]: 'c',
  [NS_DGM]: 'dgm',
};

// PPTX file patterns

export const PPTX_FILE_PATTERNS = {
  slides: /^ppt\/slides\/slide\d+\.xml$/,
  slideRels: /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/,
  notesSlides: /^ppt\/notesSlides\/notesSlide\d+\.xml$/,
  charts: /^ppt\/charts\/chart\d+\.xml$/,
  diagrams: /^ppt\/diagrams\/(data|drawing|layout|colors|style)\d+\.xml$/,
  slideMasters: /^ppt\/slideMasters\/slideMaster\d+\.xml$/,
  slideLayouts: /^ppt\/slideLayouts\/slideLayout\d+\.xml$/,
  presentation: /^ppt\/presentation\.xml$/,
  contentTypes: /^\[Content_Types\]\.xml$/,
};