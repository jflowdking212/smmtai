export interface DraftAutosaveSignatureInput {
  content: string;
  selectedConnectionIds: string[];
  perPlatformCaptions: Record<string, string>;
  mediaUrls: string[];
  link: string;
  hashtagsInput: string;
  platformMetadataInput: string;
  scheduledAt: string;
}

export interface DraftListSortInput {
  id: string;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export function buildDraftAutosaveSignature(input: DraftAutosaveSignatureInput): string {
  const sortedCaptions = Object.entries(input.perPlatformCaptions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, value.trim()]);

  return JSON.stringify({
    content: input.content.trim(),
    selectedConnectionIds: [...input.selectedConnectionIds].sort(),
    perPlatformCaptions: sortedCaptions,
    mediaUrls: [...input.mediaUrls].sort(),
    link: input.link.trim(),
    hashtagsInput: input.hashtagsInput.trim(),
    platformMetadataInput: input.platformMetadataInput.trim(),
    scheduledAt: input.scheduledAt || '',
  });
}

export function sortDraftsByUpdatedAt<T extends DraftListSortInput>(drafts: T[]): T[] {
  return [...drafts].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export function toLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

export function toLocalDateTimeInputFromDate(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

export function toUtcIsoFromLocalDateTimeInput(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
