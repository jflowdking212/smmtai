import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '../test/render';
import { FeedbackWidget } from '../components/FeedbackWidget';

describe('FeedbackWidget', () => {
  it('renders floating button initially', () => {
    renderWithRouter(<FeedbackWidget />);
    expect(screen.getByTitle('Send feedback')).toBeTruthy();
  });

  it('opens feedback form on button click', () => {
    renderWithRouter(<FeedbackWidget />);
    fireEvent.click(screen.getByTitle('Send feedback'));
    expect(screen.getByText('Send Feedback', { selector: 'h3' })).toBeTruthy();
    expect(screen.getByPlaceholderText("Tell us what's on your mind…")).toBeTruthy();
  });

  it('shows all feedback type buttons', () => {
    renderWithRouter(<FeedbackWidget />);
    fireEvent.click(screen.getByTitle('Send feedback'));
    expect(screen.getByText(/Bug Report/)).toBeTruthy();
    expect(screen.getByText(/Feature Request/)).toBeTruthy();
    expect(screen.getByText(/General Feedback/)).toBeTruthy();
  });

  it('disables send when message is empty', () => {
    renderWithRouter(<FeedbackWidget />);
    fireEvent.click(screen.getByTitle('Send feedback'));
    const sendButton = screen.getByRole('button', { name: /Send Feedback/i });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables send when message is provided', () => {
    renderWithRouter(<FeedbackWidget />);
    fireEvent.click(screen.getByTitle('Send feedback'));
    fireEvent.change(screen.getByPlaceholderText("Tell us what's on your mind…"), {
      target: { value: 'Great app!' },
    });
    const sendButton = screen.getByRole('button', { name: /Send Feedback/i });
    expect((sendButton as HTMLButtonElement).disabled).toBe(false);
  });
});
