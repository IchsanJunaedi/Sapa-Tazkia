import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

import TentangPage from './TentangPage';

describe('TentangPage', () => {
  beforeEach(() => mockNavigate.mockReset());

  it('renders heading and back button', () => {
    render(<MemoryRouter><TentangPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Sapa Tazkia/i })).toBeInTheDocument();
    expect(screen.getByText(/Kembali/i)).toBeInTheDocument();
  });

  it('navigates back when back button clicked', () => {
    render(<MemoryRouter><TentangPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Kembali/i));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
