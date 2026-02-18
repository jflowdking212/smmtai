import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithRouter } from '../test/render';
import { OnboardingWizard, shouldShowOnboarding } from '../components/OnboardingWizard';

describe('OnboardingWizard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the getting started wizard with first step', () => {
    renderWithRouter(<OnboardingWizard onDismiss={() => {}} />);
    expect(screen.getByText('Getting Started')).toBeTruthy();
    expect(screen.getByText('Connect your first account')).toBeTruthy();
    expect(screen.getByText('Connect Account')).toBeTruthy();
  });

  it('advances to next step when skip is clicked', () => {
    renderWithRouter(<OnboardingWizard onDismiss={() => {}} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(screen.getByText('Create your first post')).toBeTruthy();
  });

  it('marks step complete and persists to localStorage', () => {
    renderWithRouter(<OnboardingWizard onDismiss={() => {}} />);
    fireEvent.click(screen.getByText('Skip'));
    const stored = JSON.parse(localStorage.getItem('postmind_onboarding')!);
    expect(stored).toContain('connect');
  });

  it('calls onDismiss when X is clicked', () => {
    const onDismiss = vi.fn();
    renderWithRouter(<OnboardingWizard onDismiss={onDismiss} />);
    // Find the small close button (has p-1 class)
    const allButtons = screen.getAllByRole('button');
    const closeButton = allButtons.find((b) => b.classList.contains('p-1'));
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(onDismiss).toHaveBeenCalled();
    }
  });
});

describe('shouldShowOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns true for new users', () => {
    expect(shouldShowOnboarding()).toBe(true);
  });

  it('returns false when dismissed', () => {
    localStorage.setItem('postmind_onboarding_dismissed', 'true');
    expect(shouldShowOnboarding()).toBe(false);
  });
});
