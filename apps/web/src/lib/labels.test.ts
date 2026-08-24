import { describe, expect, it } from 'vitest';
import { display, qualityLabels, sourceLabels } from './labels';

describe('中文字段映射', () => {
  it('所有线索来源均显示中文', () => {
    expect(sourceLabels.META).toBe('Meta广告');
    expect(sourceLabels.TIKTOK).toBe('TikTok广告');
    expect(sourceLabels.MANUAL).toBe('手动添加');
  });

  it('无联系方式和垃圾表单有明确中文标签', () => {
    expect(qualityLabels.NO_CONTACT).toBe('无联系方式');
    expect(qualityLabels.SUSPECTED_SPAM).toBe('疑似垃圾');
  });

  it('空字段统一显示未提供', () => {
    expect(display(null)).toBe('未提供');
    expect(display('')).toBe('未提供');
  });
});
