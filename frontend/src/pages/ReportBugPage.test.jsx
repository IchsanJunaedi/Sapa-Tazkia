import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

import ReportBugPage from './ReportBugPage';

describe('ReportBugPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    axios.post.mockReset?.();
    jest.spyOn(window.localStorage.__proto__, 'getItem').mockReturnValue('test-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the form initially', () => {
    render(<MemoryRouter><ReportBugPage /></MemoryRouter>);
    expect(screen.getByText(/Report a Bug/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Tombol kirim/i)).toBeInTheDocument();
  });

  it('shows error if title is too short', async () => {
    render(<MemoryRouter><ReportBugPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Tombol kirim/i), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByText(/Kirim Laporan/i));
    expect(await screen.findByText(/minimal 10 karakter/i)).toBeInTheDocument();
  });

  it('shows error if title is too long', async () => {
    render(<MemoryRouter><ReportBugPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Tombol kirim/i), {
      target: { value: 'a'.repeat(201) },
    });
    fireEvent.click(screen.getByText(/Kirim Laporan/i));
    expect(await screen.findByText(/maksimal 200 karakter/i)).toBeInTheDocument();
  });

  it('submits successfully and shows success state', async () => {
    axios.post.mockResolvedValueOnce({ data: { ok: true } });
    render(<MemoryRouter><ReportBugPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Tombol kirim/i), {
      target: { value: 'Bug yang panjang dan deskriptif' },
    });
    fireEvent.click(screen.getByText(/Kirim Laporan/i));
    await waitFor(() => {
      expect(screen.getByText(/Laporan Terkirim/i)).toBeInTheDocument();
    });
    expect(axios.post).toHaveBeenCalled();
  });

  it('shows server error on failed submit', async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { message: 'Server error' } } });
    render(<MemoryRouter><ReportBugPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Tombol kirim/i), {
      target: { value: 'Bug yang panjang dan deskriptif' },
    });
    fireEvent.click(screen.getByText(/Kirim Laporan/i));
    expect(await screen.findByText(/Server error/i)).toBeInTheDocument();
  });

  it('navigates back when back button clicked', () => {
    render(<MemoryRouter><ReportBugPage /></MemoryRouter>);
    fireEvent.click(screen.getByText(/Kembali/i));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('resets to form when "Kirim laporan lain" clicked after success', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    render(<MemoryRouter><ReportBugPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Tombol kirim/i), {
      target: { value: 'Bug yang panjang dan deskriptif' },
    });
    fireEvent.click(screen.getByText(/Kirim Laporan/i));
    await screen.findByText(/Laporan Terkirim/i);
    fireEvent.click(screen.getByText(/Kirim laporan lain/i));
    expect(screen.getByText(/Report a Bug/i)).toBeInTheDocument();
  });

  it('navigates to /chat when "Kembali ke Chat" clicked after success', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    render(<MemoryRouter><ReportBugPage /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Tombol kirim/i), {
      target: { value: 'Bug yang panjang dan deskriptif' },
    });
    fireEvent.click(screen.getByText(/Kirim Laporan/i));
    await screen.findByText(/Laporan Terkirim/i);
    fireEvent.click(screen.getByText(/Kembali ke Chat/i));
    expect(mockNavigate).toHaveBeenCalledWith('/chat');
  });
});
