import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../test/render';
import { ComposePage } from '../pages/ComposePage';

const mockApi = vi.hoisted(() => ({
  connections: {
    list: vi.fn(),
    facebookPages: vi.fn(),
    entreprenrsPages: vi.fn(),
    chrxstiansPages: vi.fn(),
    chrxstiansGroups: vi.fn(),
    iohahPages: vi.fn(),
    iohahGroups: vi.fn(),
  },
  posts: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    submitForApproval: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    publish: vi.fn(),
    uploadMedia: vi.fn(),
  },
  schedule: {
    schedulePost: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

type DraftRecord = {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  scheduledAt: string | null;
  designData: Record<string, unknown>;
  media: Array<{ id: string; url: string; type: 'image' | 'video' }>;
  platformPosts: Array<{ id: string; platform: string; socialConnectionId: string }>;
};

const baseConnection = [
  { id: 'conn-1', platform: 'facebook', accountName: 'Acme FB', isActive: true },
];

function makeDraft(id: string, content: string): DraftRecord {
  return {
    id,
    content,
    status: 'draft',
    createdAt: '2030-01-01T10:00:00.000Z',
    updatedAt: '2030-01-02T10:00:00.000Z',
    scheduledAt: null,
    designData: {},
    media: [],
    platformPosts: [{ id: `${id}-pp-1`, platform: 'facebook', socialConnectionId: 'conn-1' }],
  };
}

describe('ComposePage draft flows', () => {
  let draftStore: DraftRecord[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    draftStore = [];
    window.sessionStorage.clear();

    mockApi.connections.list.mockResolvedValue({ success: true, data: baseConnection });
    mockApi.connections.facebookPages.mockResolvedValue({ success: true, data: [] });
    mockApi.connections.entreprenrsPages.mockResolvedValue({ success: true, data: [] });
    mockApi.connections.chrxstiansPages.mockResolvedValue({ success: true, data: [] });
    mockApi.connections.chrxstiansGroups.mockResolvedValue({ success: true, data: [] });
    mockApi.connections.iohahPages.mockResolvedValue({ success: true, data: [] });
    mockApi.connections.iohahGroups.mockResolvedValue({ success: true, data: [] });
    mockApi.posts.create.mockResolvedValue({ success: true, data: { id: 'draft-autosave-1' } });
    mockApi.posts.update.mockResolvedValue({ success: true, data: {} });
    mockApi.posts.get.mockResolvedValue({ success: true, data: makeDraft('draft-1', 'Loaded draft content') });
    mockApi.posts.delete.mockResolvedValue({ success: true, data: { message: 'Post deleted' } });
    mockApi.posts.submitForApproval.mockResolvedValue({ success: true, data: {} });
    mockApi.posts.approve.mockResolvedValue({ success: true, data: {} });
    mockApi.posts.reject.mockResolvedValue({ success: true, data: {} });
    mockApi.posts.publish.mockResolvedValue({ success: true, data: {} });

    mockApi.posts.list.mockImplementation(async (params?: Record<string, string>) => {
      if (params?.status === 'pending_approval') {
        return { success: true, data: { posts: [] } };
      }
      if (params?.status === 'draft') {
        return {
          success: true,
          data: { posts: draftStore, total: draftStore.length, page: 1, limit: 50, pages: 1 },
        };
      }
      return { success: true, data: { posts: [], total: 0, page: 1, limit: 20, pages: 1 } };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autosaves a draft after content edits', async () => {
    renderWithRouter(<ComposePage />);

    const platformButton = await screen.findByRole('button', { name: /Acme FB/i });
    fireEvent.click(platformButton);

    const textarea = screen.getByPlaceholderText("What do you want to share?");
    fireEvent.change(textarea, { target: { value: 'Autosave draft body' } });

    await waitFor(() => {
      expect(mockApi.posts.create).toHaveBeenCalledWith(expect.objectContaining({
        isDraft: true,
        content: 'Autosave draft body',
      }));
    }, { timeout: 4000 });
    expect(await screen.findByText(/Draft autosaved/i)).toBeTruthy();
  });

  it('opens a selected draft into the composer', async () => {
    draftStore = [makeDraft('draft-1', 'Draft preview row')];
    mockApi.posts.get.mockResolvedValue({
      success: true,
      data: {
        ...makeDraft('draft-1', 'Loaded draft content'),
        designData: {
          __smmtaiPublishPayload: { link: 'https://example.com', hashtags: ['launch'] },
        },
      },
    });

    renderWithRouter(<ComposePage />);

    expect(await screen.findByText('Draft preview row')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    await waitFor(() => expect(mockApi.posts.get).toHaveBeenCalledWith('draft-1'));
    await waitFor(() => {
      expect((screen.getByPlaceholderText("What do you want to share?") as HTMLTextAreaElement).value)
        .toBe('Loaded draft content');
    });
  });

  it('deletes drafts from the draft manager list', async () => {
    draftStore = [makeDraft('draft-1', 'Delete me draft')];
    mockApi.posts.delete.mockImplementation(async () => {
      draftStore = [];
      return { success: true, data: { message: 'Post deleted' } };
    });

    renderWithRouter(<ComposePage />);

    expect(await screen.findByText('Delete me draft')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Delete draft draft-1'));

    await waitFor(() => expect(mockApi.posts.delete).toHaveBeenCalledWith('draft-1'));
    expect(await screen.findByText('No drafts yet')).toBeTruthy();
  });

  it('hydrates composer from AI handoff payload', async () => {
    window.sessionStorage.setItem('__smmtaiComposeSeed', JSON.stringify({
      source: 'ai',
      content: 'Seeded caption from AI',
      hashtags: ['launch', 'growth'],
    }));

    renderWithRouter(<ComposePage />);

    await waitFor(() => {
      expect((screen.getByPlaceholderText("What do you want to share?") as HTMLTextAreaElement).value)
        .toBe('Seeded caption from AI');
    });
    expect((screen.getByPlaceholderText('launch, growth, product') as HTMLInputElement).value)
      .toBe('launch, growth');
    expect(window.sessionStorage.getItem('__smmtaiComposeSeed')).toBeNull();
  });
});
