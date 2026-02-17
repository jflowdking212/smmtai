import { describe, it, expect } from 'vitest';
import { CANVAS_SIZES, getCanvasSize, getAvailablePostTypes } from '../lib/canvasSizes';

describe('Canvas Sizes', () => {
  it('should have sizes for all 13 platforms', () => {
    expect(Object.keys(CANVAS_SIZES).length).toBe(13);
  });

  it('should return correct Instagram post size', () => {
    const size = getCanvasSize('instagram', 'post');
    expect(size.width).toBe(1080);
    expect(size.height).toBe(1080);
  });

  it('should return default size for unknown platform', () => {
    const size = getCanvasSize('unknown', 'post');
    expect(size.width).toBe(1200);
    expect(size.height).toBe(630);
  });

  it('should list available post types for Facebook', () => {
    const types = getAvailablePostTypes('facebook');
    expect(types).toContain('post');
    expect(types).toContain('story');
    expect(types).toContain('cover');
    expect(types).toContain('ad');
  });
});
