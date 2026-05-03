import { describe, it, expect } from 'vitest';
import { distributeTextToRuns } from '../../src/run-preservation/distribute.js';
import { TextRun } from '../../src/types.js';

describe('distributeTextToRuns', () => {
  it('should assign text to single run', () => {
    const runs: TextRun[] = [
      { index: 0, text: 'original', format: {} },
    ];
    distributeTextToRuns(runs, 'translated');
    expect(runs[0].text).toBe('translated');
  });

  it('should distribute proportionally by original lengths', () => {
    const runs: TextRun[] = [
      { index: 0, text: 'AAAA', format: {} },
      { index: 1, text: 'BBBB', format: {} },
    ];
    distributeTextToRuns(runs, 'XXYYZZWW');
    // 4+4=8 chars total, 8 chars to distribute, each gets 4
    expect(runs[0].text.length + runs[1].text.length).toBe(8);
    expect(runs[0].text).toBe('XXYY');
    expect(runs[1].text).toBe('ZZWW');
  });

  it('should handle unequal original lengths', () => {
    const runs: TextRun[] = [
      { index: 0, text: 'AAAAAA', format: {} },
      { index: 1, text: 'BB', format: {} },
    ];
    distributeTextToRuns(runs, 'XYZZWQ');
    // 6:2 ratio, 6 chars to distribute → approximately 4:2 or 5:1
    expect(runs[0].text.length + runs[1].text.length).toBe(6);
    expect(runs[0].text.length).toBeGreaterThanOrEqual(4);
    expect(runs[1].text.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle all-empty runs with equal weights', () => {
    const runs: TextRun[] = [
      { index: 0, text: '', format: {} },
      { index: 1, text: '', format: {} },
    ];
    distributeTextToRuns(runs, 'AB');
    expect(runs[0].text).toBe('A');
    expect(runs[1].text).toBe('B');
  });

  it('should not lose any characters', () => {
    const runs: TextRun[] = [
      { index: 0, text: 'AB', format: {} },
      { index: 1, text: 'C', format: {} },
      { index: 2, text: 'DEFGH', format: {} },
    ];
    const longText = '这是翻译后的很长文本内容';
    distributeTextToRuns(runs, longText);
    const combined = runs.map(r => r.text).join('');
    expect(combined).toBe(longText);
  });

  it('should handle empty runs array gracefully', () => {
    const runs: TextRun[] = [];
    distributeTextToRuns(runs, 'text');
    // Should not crash, nothing to distribute
  });

  it('should preserve CJK characters correctly', () => {
    const runs: TextRun[] = [
      { index: 0, text: '你好世界', format: {} },
      { index: 1, text: '测试', format: {} },
    ];
    distributeTextToRuns(runs, 'HelloWorld测试完成');
    const combined = runs.map(r => r.text).join('');
    expect(combined).toBe('HelloWorld测试完成');
  });
});