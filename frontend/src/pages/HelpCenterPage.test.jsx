import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

import HelpCenterPage from './HelpCenterPage';

describe('HelpCenterPage', () => {
  beforeEach(() => mockNavigate.mockReset());

  it('renders title and category headings', () => {
    render(<MemoryRouter><HelpCenterPage /></MemoryRouter>);
    expect(screen.getByText(/Help Center/i)).toBeInTheDocument();
    expect(screen.getByText(/Akun & Login/i)).toBeInTheDocument();
    expect(screen.getByText(/Chat AI/i)).toBeInTheDocument();
  });

  it('expands and collapses an accordion item on click', () => {
    render(<MemoryRouter><HelpCenterPage /></MemoryRouter>);
    const question = screen.getByText(/Bagaimana cara login ke SAPA/i);
    // Answer not visible until accordion is opened
    expect(screen.queryByText(/login menggunakan NIM/i)).not.toBeInTheDocument();
    fireEvent.click(question);
    expect(screen.getByText(/login menggunakan NIM/i)).toBeInTheDocument();
    fireEvent.click(question);
    expect(screen.queryByText(/login menggunakan NIM/i)).not.toBeInTheDocument();
  });

  it('navigates back when back button clicked', () => {
    render(<MemoryRouter><HelpCenterPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Kembali/i));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('navigates to report bug page from CTA', () => {
    render(<MemoryRouter><HelpCenterPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Laporkan masalah/i));
    expect(mockNavigate).toHaveBeenCalledWith('/report-bug');
  });
});
