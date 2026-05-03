import { CliConfig } from '../types.js';

export interface ChatPayload {
  model: string;
  temperature: number;
  messages: { role: string; content: string }[];
}

export function buildBatchPrompt(texts: string[], config: CliConfig): ChatPayload {
  const hasMarkers = texts.some(t => t.includes('[[R0]]'));
  const sourceLabel = config.sourceLang === 'auto' ? detectSourceHint(texts) : config.sourceLang;

  const systemParts = [
    `You are a professional translator translating from ${sourceLabel} to ${config.targetLang}.`,
    hasMarkers
      ? 'You MUST preserve ALL run markers ([[R0]]...[[/R0]], [[R1]]...[[/R1]], etc.) exactly as they appear — same markers, same order, no additions, no omissions, no changes to marker text.'
      : '',
    'Return ONLY a valid JSON array of strings — no markdown, no code fences, no explanation.',
    'Translate ALL translatable text into the target language. Do not leave any source-language text untranslated unless it is a proper noun (person/place/brand name), URL, email, variable name, or code snippet.',
  ].filter(Boolean).join(' ');

  const userParts = [
    `Translate the following ${texts.length} items from ${sourceLabel} to ${config.targetLang}.`,
    '',
    'Rules:',
    `1) Output ONLY a JSON array of exactly ${texts.length} strings — same order, same count.`,
    '2) No markdown fences, no extra commentary, no trailing text.',
    hasMarkers
      ? '3) Keep ALL [[Rn]]...[[/Rn]] markers exactly as they appear in each string. Only translate the text between and outside markers.'
      : '3) Preserve whitespace, punctuation style, and line breaks from the original.',
    '4) Keep URLs, emails, file paths, and code unchanged.',
    '5) Translate proper nouns only if they have a well-established translation in the target language; otherwise keep them unchanged.',
    '',
    `Input JSON:\n${JSON.stringify(texts)}`,
  ].join('\n');

  return {
    model: config.model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemParts },
      { role: 'user', content: userParts },
    ],
  };
}

export function buildSinglePrompt(text: string, config: CliConfig, hasMarkers: boolean): ChatPayload {
  const sourceLabel = config.sourceLang === 'auto' ? 'the source language' : config.sourceLang;

  const systemContent = [
    `You are a professional translator. Translate from ${sourceLabel} to ${config.targetLang}.`,
    'Output ONLY the translated text — no explanation, no commentary, no extra content.',
    'Translate ALL translatable text. Do not leave source text unchanged unless it is a proper noun, URL, or code.',
  ].join(' ');

  const userParts = [
    hasMarkers
      ? 'Preserve ALL [[Rn]]...[[/Rn]] markers exactly — same markers, same order. Only translate the text between and outside them.'
      : 'Preserve whitespace, punctuation style, and line breaks.',
    'Keep URLs, emails, and code unchanged.',
    '',
    text,
  ].join('\n');

  return {
    model: config.model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userParts },
    ],
  };
}

function detectSourceHint(texts: string[]): string {
  // Heuristic to give the model a hint about source language
  let cjkCount = 0;
  let latinCount = 0;
  for (const t of texts) {
    if (/[一-鿿㐀-䶿]/.test(t)) cjkCount++;
    if (/[a-zA-Z]/.test(t)) latinCount++;
  }
  if (cjkCount > latinCount * 0.5) return 'Chinese';
  if (latinCount > 0) return 'English';
  return 'the source language';
}