import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ToastProvider } from '@/components/Toast';

export function renderWithRouter(
  ui: ReactElement,
  options: RenderOptions & { route?: string } = {},
) {
  const { route = '/', ...renderOptions } = options;

  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </ToastProvider>,
    renderOptions,
  );
}
