import { describe, expect, it } from 'vitest';
import { buildDraftAutosaveSignature, sortDraftsByUpdatedAt, toLocalDateTimeInput } from '../lib/composeDrafts';

describe('composeDrafts helpers', () => {
  it('builds stable autosave signatures regardless of selection order', () => {
    const signatureA = buildDraftAutosaveSignature({
      content: 'Hello',
      selectedConnectionIds: ['b', 'a'],
      perPlatformCaptions: { b: 'caption b', a: 'caption a' },
      mediaUrls: ['https://example.com/2.png', 'https://example.com/1.png'],
      link: 'https://example.com',
      hashtagsInput: 'launch, growth',
      platformMetadataInput: '{"a":{"boardId":"1"}}',
      scheduledAt: '2030-01-01T10:00',
    });

    const signatureB = buildDraftAutosaveSignature({
      content: 'Hello',
      selectedConnectionIds: ['a', 'b'],
      perPlatformCaptions: { a: 'caption a', b: 'caption b' },
      mediaUrls: ['https://example.com/1.png', 'https://example.com/2.png'],
      link: 'https://example.com',
      hashtagsInput: 'launch, growth',
      platformMetadataInput: '{"a":{"boardId":"1"}}',
      scheduledAt: '2030-01-01T10:00',
    });

    expect(signatureA).toBe(signatureB);
  });

  it('sorts drafts by updatedAt descending', () => {
    const sorted = sortDraftsByUpdatedAt([
      { id: '1', updatedAt: '2024-01-01T10:00:00.000Z' },
      { id: '2', updatedAt: '2024-01-03T10:00:00.000Z' },
      { id: '3', createdAt: '2024-01-02T10:00:00.000Z' },
    ]);

    expect(sorted.map((draft) => draft.id)).toEqual(['2', '3', '1']);
  });

  it('converts UTC datetime to local datetime input format', () => {
    const value = toLocalDateTimeInput('2030-01-01T10:00:00.000Z');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
