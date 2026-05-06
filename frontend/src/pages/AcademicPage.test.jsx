import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../api/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockGenerate = jest.fn();
jest.mock('../utils/pdfGenerator', () => ({
  generateTranscriptPDF: (...args) => mockGenerate(...args),
}));

import api from '../api/axiosConfig';
import AcademicPage from './AcademicPage';

const renderPage = () => render(<MemoryRouter><AcademicPage /></MemoryRouter>);

const sampleData = {
  summary: { fullName: 'Alice Tester', nim: '123', programStudi: 'TI', ipk: 3.85, totalSks: 144 },
  grades: {
    1: [
      { courseCode: 'TI001', courseName: 'Algoritma', sks: 3, grade: 'A', gradePoint: 4.0 },
    ],
  },
};

beforeEach(() => {
  api.get.mockReset();
  mockNavigate.mockReset();
  mockGenerate.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('AcademicPage', () => {
  it('shows loading initially', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Memuat Data Akademik/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/Gagal mengambil data/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Kembali ke Dashboard/i));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows error when API returns success:false', async () => {
    api.get.mockResolvedValue({ data: { success: false } });
    renderPage();
    expect(await screen.findByText(/Gagal memuat data transkrip/i)).toBeInTheDocument();
  });

  it('renders summary and grades when API succeeds', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: sampleData } });
    renderPage();
    expect(await screen.findByText('Alice Tester')).toBeInTheDocument();
    expect(screen.getByText('TI')).toBeInTheDocument();
    expect(screen.getByText('3.85')).toBeInTheDocument();
    expect(screen.getByText('Algoritma')).toBeInTheDocument();
  });

  it('triggers PDF download on button click', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: sampleData } });
    renderPage();
    await screen.findByText('Alice Tester');
    fireEvent.click(screen.getByText(/Download Transkrip PDF/i));
    expect(mockGenerate).toHaveBeenCalledWith(sampleData);
  });

  it('navigates to / from navbar back button', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: sampleData } });
    renderPage();
    await screen.findByText('Alice Tester');
    fireEvent.click(screen.getByText(/Dashboard/i));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
