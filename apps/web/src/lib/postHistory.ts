export type StatusBadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'brand';

export interface PlatformStatusLike {
  status: string;
}

export function getStatusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'published':
      return 'success';
    case 'partial':
    case 'pending_approval':
      return 'warning';
    case 'failed':
    case 'rejected':
      return 'danger';
    case 'scheduled':
      return 'brand';
    default:
      return 'default';
  }
}

export function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ');
}

export function buildPostListParams(statusFilter: string, page: number, limit: number): Record<string, string> {
  return {
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    page: String(page),
    limit: String(limit),
  };
}

export function summarizePlatformOutcomes(platformPosts: PlatformStatusLike[]) {
  return platformPosts.reduce(
    (acc, post) => {
      if (post.status === 'published') {
        acc.published += 1;
      } else if (post.status === 'failed') {
        acc.failed += 1;
      } else {
        acc.pending += 1;
      }
      return acc;
    },
    { published: 0, failed: 0, pending: 0 },
  );
}
