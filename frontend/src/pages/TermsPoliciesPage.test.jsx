import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

import TermsPoliciesPage from './TermsPoliciesPage';

describe('TermsPoliciesPage', () => {
  beforeEach(() => mockNavigate.mockReset());

  it('renders main heading and section titles', () => {
    render(<MemoryRouter><TermsPoliciesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Terms & Policies/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Penerimaan Syarat/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Akun Pengguna/i })).toBeInTheDocument();
  });

  it('navigates back when back button clicked', () => {
    render(<MemoryRouter><TermsPoliciesPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Kembali/i));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
