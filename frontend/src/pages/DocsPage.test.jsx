import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DocsPage from './DocsPage';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/docs', search: '' }),
}));

describe('DocsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock scrollTo
    Element.prototype.scrollTo = jest.fn();
  });

  test('renders HomeContent by default', () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Dokumentasi Sapa Tazkia/i)).toBeInTheDocument();
  });

  test('navigates to Fitur page via sidebar', () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>
    );

    const fiturButton = screen.getAllByText(/Pelajari Fitur/i)[0];
    fireEvent.click(fiturButton);

    expect(screen.getByText(/Semua kemampuan yang tersedia di SAPA/i)).toBeInTheDocument();
  });

  test('toggles accordion in HelpContent', async () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>
    );

    const helpButton = screen.getAllByText(/Help Center/i)[0];
    fireEvent.click(helpButton);

    const question = screen.getByText(/Bagaimana cara login ke SAPA\?/i);
    fireEvent.click(question);

    expect(await screen.findByText(/Kamu bisa login menggunakan NIM dan password/i)).toBeInTheDocument();
  });

  test('navigates via breadcrumbs', () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByText(/Team Dev/i)[0]);
    expect(screen.getByText(/Tim pengembang di balik SAPA/i)).toBeInTheDocument();

    const docsBreadcrumb = screen.getByRole('button', { name: /^Docs$/i });
    fireEvent.click(docsBreadcrumb);

    expect(screen.getByText(/Dokumentasi Sapa Tazkia/i)).toBeInTheDocument();
  });

  test('HomeContent quick links work', () => {
    render(
      <MemoryRouter>
        <DocsPage />
      </MemoryRouter>
    );

    const caraKerjaButtons = screen.getAllByText(/Cara Kerja/i);
    const caraKerjaButton = caraKerjaButtons.find(el => el.closest('button'));
    fireEvent.click(caraKerjaButton);

    expect(screen.getByText(/Memahami arsitektur dan pipeline di balik SAPA/i)).toBeInTheDocument();
  });
});
