import { describe, it, expect } from 'vitest';
import { TEMPLATES, getCategories, getTemplatesByCategory } from '../lib/templates';

describe('Templates', () => {
  it('should have 60 templates', () => {
    expect(TEMPLATES).toHaveLength(60);
  });

  it('should have 10 categories', () => {
    expect(getCategories()).toHaveLength(10);
  });

  it('should filter templates by category', () => {
    const biz = getTemplatesByCategory('Business & Corporate');
    expect(biz.length).toBeGreaterThan(0);
    biz.forEach((t) => expect(t.category).toBe('Business & Corporate'));
  });

  it('should return all templates when no category', () => {
    const all = getTemplatesByCategory();
    expect(all).toHaveLength(60);
  });

  it('each template should have valid JSON', () => {
    TEMPLATES.forEach((t) => {
      expect(() => JSON.parse(t.json)).not.toThrow();
    });
  });

  it('each template should have positive dimensions', () => {
    TEMPLATES.forEach((t) => {
      expect(t.width).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
    });
  });
});
