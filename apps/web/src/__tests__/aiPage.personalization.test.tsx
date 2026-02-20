import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '../test/render';
import { AIPage } from '../pages/AIPage';

const mockApi = vi.hoisted(() => ({
  ai: {
    caption: vi.fn(),
    hashtags: vi.fn(),
    imagePrompt: vi.fn(),
    rewrite: vi.fn(),
    translate: vi.fn(),
    compliance: vi.fn(),
    bestTimes: vi.fn(),
    trending: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

describe('AIPage personalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockApi.ai.caption.mockResolvedValue({
      success: true,
      data: { caption: 'Generated caption', character_count: 17, platform_limit: 2200, hashtags: [], cta: null },
    });
    mockApi.ai.trending.mockResolvedValue({ success: true, data: { topics: [] } });
  });

  it('forwards brand voice, industry, and audience persona for captions', async () => {
    renderWithRouter(<AIPage />);

    fireEvent.change(screen.getByPlaceholderText('Describe what your post should be about...'), {
      target: { value: 'Launch campaign update' },
    });
    fireEvent.change(screen.getByLabelText('Brand Voice Profile (optional)'), {
      target: { value: 'witty' },
    });
    fireEvent.change(screen.getByLabelText('Brand Voice Details (optional)'), {
      target: { value: 'Clever and direct' },
    });
    fireEvent.change(screen.getByLabelText('Industry (optional)'), {
      target: { value: 'SaaS' },
    });
    fireEvent.change(screen.getByLabelText('Audience Persona (optional)'), {
      target: { value: 'Startup founders' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(mockApi.ai.caption).toHaveBeenCalledWith({
        topic: 'Launch campaign update',
        platform: 'instagram',
        tone: 'professional',
        language: 'en',
        include_emoji: true,
        include_cta: true,
        brand_voice_profile: 'witty',
        brand_voice: 'Clever and direct',
        industry: 'SaaS',
        audience_persona: 'Startup founders',
      });
    });
  });

  it('forwards industry and audience persona for trending suggestions', async () => {
    renderWithRouter(<AIPage />);

    fireEvent.click(screen.getByRole('button', { name: /Trending/i }));
    fireEvent.change(screen.getByLabelText('Industry (optional)'), {
      target: { value: 'E-commerce' },
    });
    fireEvent.change(screen.getByLabelText('Audience Persona (optional)'), {
      target: { value: 'First-time store owners' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(mockApi.ai.trending).toHaveBeenCalledWith({
        platform: 'instagram',
        industry: 'E-commerce',
        audience_persona: 'First-time store owners',
        count: 10,
      });
    });
  });

  it('stores successful generations in recent history', async () => {
    renderWithRouter(<AIPage />);

    expect(screen.getByText('No history yet.')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Describe what your post should be about...'), {
      target: { value: 'Launch campaign update' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(mockApi.ai.caption).toHaveBeenCalled();
    });

    expect(screen.queryByText('No history yet.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });

  it('stores caption output for compose handoff', async () => {
    mockApi.ai.caption.mockResolvedValue({
      success: true,
      data: {
        caption: 'Ready for compose',
        character_count: 16,
        platform_limit: 2200,
        hashtags: ['product', 'launch'],
        cta: null,
      },
    });

    renderWithRouter(<AIPage />);

    fireEvent.change(screen.getByPlaceholderText('Describe what your post should be about...'), {
      target: { value: 'Launch update' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => expect(mockApi.ai.caption).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Use in Compose' }));

    expect(JSON.parse(window.sessionStorage.getItem('__postmindComposeSeed') || '{}')).toMatchObject({
      source: 'ai',
      content: 'Ready for compose',
      hashtags: ['product', 'launch'],
    });
  });
});
