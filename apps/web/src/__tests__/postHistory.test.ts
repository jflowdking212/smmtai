import { describe, expect, it } from 'vitest';
import {
  buildPostListParams,
  formatStatusLabel,
  getStatusBadgeVariant,
  summarizePlatformOutcomes,
} from '../lib/postHistory';

describe('postHistory helpers', () => {
  it('maps status to badge variant', () => {
    expect(getStatusBadgeVariant('published')).toBe('success');
    expect(getStatusBadgeVariant('failed')).toBe('danger');
    expect(getStatusBadgeVariant('scheduled')).toBe('brand');
    expect(getStatusBadgeVariant('pending_approval')).toBe('warning');
    expect(getStatusBadgeVariant('draft')).toBe('default');
  });

  it('formats status labels', () => {
    expect(formatStatusLabel('pending_approval')).toBe('Pending Approval');
    expect(formatStatusLabel('partial')).toBe('Partial');
  });

  it('builds post-list params with optional status filter', () => {
    expect(buildPostListParams('all', 2, 20)).toEqual({ page: '2', limit: '20' });
    expect(buildPostListParams('published', 1, 10)).toEqual({ status: 'published', page: '1', limit: '10' });
  });

  it('summarizes platform outcomes', () => {
    expect(
      summarizePlatformOutcomes([
        { status: 'published' },
        { status: 'failed' },
        { status: 'published' },
        { status: 'pending' },
      ]),
    ).toEqual({ published: 2, failed: 1, pending: 1 });
  });
});
