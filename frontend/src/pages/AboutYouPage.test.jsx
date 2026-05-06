import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AboutYouPage from './AboutYouPage';
import { useAuth } from '../context/AuthContext';

// Mock dependencies
jest.mock('../context/AuthContext');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/about-you', state: {} }),
}));

describe('AboutYouPage', () => {
  let mockUpdateUserProfileCompletion;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateUserProfileCompletion = jest.fn().mockResolvedValue({ success: true });
    
    useAuth.mockReturnValue({
      user: { id: 1, email: 'test@tazkia.ac.id', fullName: 'User', isProfileComplete: false },
      updateUserProfileCompletion: mockUpdateUserProfileCompletion,
      isAuthenticated: true,
      loading: false,
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true
    });
  });

  test('redirects to home if not authenticated', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
    });

    render(
      <MemoryRouter>
        <AboutYouPage />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  test('renders form correctly', () => {
    render(
      <MemoryRouter>
        <AboutYouPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Lengkapi Profil Anda/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Lengkap/i)).toBeInTheDocument();
    expect(screen.getByText('test@tazkia.ac.id')).toBeInTheDocument();
  });

  test('pre-fills name if valid but not complete', () => {
    useAuth.mockReturnValue({
      user: { id: 1, fullName: 'John Doe', isProfileComplete: false, email: 'john@tazkia.ac.id' },
      isAuthenticated: true,
      loading: false,
    });

    render(
      <MemoryRouter>
        <AboutYouPage />
      </MemoryRouter>
    );

    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  test('shows validation error for short name', async () => {
    render(
      <MemoryRouter>
        <AboutYouPage />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/Nama Lengkap/i);
    fireEvent.change(nameInput, { target: { value: 'A' } });
    
    const submitButton = screen.getByText(/Lanjutkan ke Halaman Utama/i);
    fireEvent.click(submitButton);

    expect(await screen.findByText(/Nama lengkap harus minimal 2 karakter/i)).toBeInTheDocument();
  });

  test('handles successful submission', async () => {
    jest.useFakeTimers();
    render(
      <MemoryRouter>
        <AboutYouPage />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/Nama Lengkap/i);
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    
    const submitButton = screen.getByText(/Lanjutkan ke Halaman Utama/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateUserProfileCompletion).toHaveBeenCalledWith({
        fullName: 'New Name',
        dateOfBirth: null,
      });
    });

    expect(await screen.findByText(/Profil berhasil dilengkapi/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/', expect.any(Object));
    jest.useRealTimers();
  });

  test('handles skip functionality', () => {
    render(
      <MemoryRouter>
        <AboutYouPage />
      </MemoryRouter>
    );

    const skipButton = screen.getByText(/Lewati untuk sekarang/i);
    fireEvent.click(skipButton);

    expect(mockNavigate).toHaveBeenCalledWith('/', expect.objectContaining({
      state: { from: 'profile-skipped' }
    }));
  });

  test('handles back button', () => {
    render(
      <MemoryRouter>
        <AboutYouPage />
      </MemoryRouter>
    );

    const backButton = screen.getByText(/Kembali/i);
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
