import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '../test/render';
import { HelpPage } from '../pages/HelpPage';

describe('HelpPage', () => {
  it('renders the help center header and search', () => {
    renderWithRouter(<HelpPage />);
    expect(screen.getByText('Help Center')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search help articles...')).toBeTruthy();
  });

  it('shows Getting Started articles by default', () => {
    renderWithRouter(<HelpPage />);
    expect(screen.getByText('Quick Start Guide')).toBeTruthy();
    expect(screen.getByText('Connecting Social Media Accounts')).toBeTruthy();
  });

  it('switches category tabs', () => {
    renderWithRouter(<HelpPage />);
    fireEvent.click(screen.getByText('Features'));
    expect(screen.getByText('Post Composer')).toBeTruthy();
    expect(screen.getByText('Content Calendar')).toBeTruthy();
    expect(screen.getByText('AI Assistant')).toBeTruthy();
  });

  it('filters articles by search', () => {
    renderWithRouter(<HelpPage />);
    fireEvent.change(screen.getByPlaceholderText('Search help articles...'), {
      target: { value: 'Quick Start' },
    });
    expect(screen.getByText('Quick Start Guide')).toBeTruthy();
    expect(screen.queryByText('Connecting Social Media Accounts')).toBeNull();
  });

  it('expands FAQ items on click', () => {
    renderWithRouter(<HelpPage />);
    const faqQuestion = screen.getByText('How many social accounts can I connect?');
    fireEvent.click(faqQuestion.closest('[class*="cursor-pointer"]')!);
    expect(screen.getByText(/Depends on your plan/)).toBeTruthy();
  });

  it('shows quick link cards', () => {
    renderWithRouter(<HelpPage />);
    expect(screen.getByText('Documentation')).toBeTruthy();
    expect(screen.getByText('Video Tutorials')).toBeTruthy();
    expect(screen.getByText('Community')).toBeTruthy();
    expect(screen.getByText('Contact Support')).toBeTruthy();
  });
});
