import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import RateLimitStatus from './RateLimitStatus';

// Mock aiService
const mockGetRateLimitStatus = jest.fn();
const mockAddListener = jest.fn();
const mockRemoveListener = jest.fn();

jest.mock('../../api/aiService', () => ({
  __esModule: true,
  default: {
    getRateLimitStatus: (...args) => mockGetRateLimitStatus(...args),
    addRateLimitListener: (...args) => mockAddListener(...args),
    removeRateLimitListener: (...args) => mockRemoveListener(...args),
  },
}));

describe('RateLimitStatus', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, REACT_APP_SHOW_RATE_LIMIT_STATUS: 'true' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('renders nothing when REACT_APP_SHOW_RATE_LIMIT_STATUS is not true', async () => {
    process.env.REACT_APP_SHOW_RATE_LIMIT_STATUS = 'false';
    mockGetRateLimitStatus.mockResolvedValue({
      success: true,
      data: { remaining: 5000, limit: 7000, userType: 'regular', resetTime: Date.now() + 3600000 },
    });

    const { container } = render(<RateLimitStatus />);
    await waitFor(() => expect(mockGetRateLimitStatus).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('renders rate limit info when enabled and data loads', async () => {
    mockGetRateLimitStatus.mockResolvedValue({
      success: true,
      data: { remaining: 5000, limit: 7000, userType: 'regular', resetTime: Date.now() + 3600000 },
    });

    render(<RateLimitStatus userName="Ahmad" />);

    await waitFor(() => {
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });
    expect(screen.getByText('/7,000')).toBeInTheDocument();
    expect(screen.getByText('Ahmad')).toBeInTheDocument();
  });

  it('shows Mode Tamu for guest users', async () => {
    mockGetRateLimitStatus.mockResolvedValue({
      success: true,
      data: { remaining: 3000, limit: 7000, userType: 'guest', resetTime: Date.now() + 3600000 },
    });

    render(<RateLimitStatus isGuestMode={true} />);

    await waitFor(() => {
      expect(screen.getByText('Mode Tamu')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully with fallback values', async () => {
    mockGetRateLimitStatus.mockRejectedValue(new Error('Network error'));

    render(<RateLimitStatus />);

    await waitFor(() => {
      expect(screen.getByText('7,000')).toBeInTheDocument();
    });
  });

  it('registers and unregisters rate limit listener', async () => {
    mockGetRateLimitStatus.mockResolvedValue({
      success: true,
      data: { remaining: 1000, limit: 7000, userType: 'regular', resetTime: Date.now() + 3600000 },
    });

    const { unmount } = render(<RateLimitStatus />);

    await waitFor(() => expect(mockAddListener).toHaveBeenCalledTimes(1));

    unmount();
    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
  });

  it('handles window_limits format from API', async () => {
    mockGetRateLimitStatus.mockResolvedValue({
      success: true,
      data: {
        window_limits: { remaining: 2000, limit: 7000, reset_time: Date.now() + 3600000 },
        user_type: 'regular',
      },
    });

    render(<RateLimitStatus userName="Budi" />);

    await waitFor(() => {
      expect(screen.getByText('2,000')).toBeInTheDocument();
    });
  });

  it('shows tooltip on hover with usage details', async () => {
    mockGetRateLimitStatus.mockResolvedValue({
      success: true,
      data: { remaining: 5000, limit: 7000, userType: 'regular', resetTime: Date.now() + 3600000 },
    });

    render(<RateLimitStatus userName="Test" />);

    await waitFor(() => {
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });

    // Hover over the component
    const mainCard = screen.getByText('5,000').closest('.fixed');
    fireEvent.mouseEnter(mainCard);

    expect(screen.getByText('Detail Penggunaan')).toBeInTheDocument();
    expect(screen.getByText('Token Terpakai')).toBeInTheDocument();
  });

  it('shows login prompt for guest users in tooltip', async () => {
    mockGetRateLimitStatus.mockResolvedValue({
      success: true,
      data: { remaining: 3000, limit: 7000, userType: 'guest', resetTime: Date.now() + 3600000 },
    });

    render(<RateLimitStatus isGuestMode={true} />);

    await waitFor(() => {
      expect(screen.getByText('Mode Tamu')).toBeInTheDocument();
    });

    const mainCard = screen.getByText('3,000').closest('.fixed');
    fireEvent.mouseEnter(mainCard);

    expect(screen.getByText(/Login untuk kuota 2x lipat/)).toBeInTheDocument();
  });

  it('updates status via realtime listener', async () => {
    let capturedListener;
    mockAddListener.mockImplementation((fn) => { capturedListener = fn; });
    mockGetRateLimitStatus.mockResolvedValue({
      success: true,
      data: { remaining: 5000, limit: 7000, userType: 'regular', resetTime: Date.now() + 3600000 },
    });

    render(<RateLimitStatus userName="Test" />);

    await waitFor(() => {
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });

    // Simulate realtime update
    act(() => {
      capturedListener({ remaining: 4500, limit: 7000, userType: 'regular', resetTime: Date.now() + 3600000 });
    });

    await waitFor(() => {
      expect(screen.getByText('4,500')).toBeInTheDocument();
    });
  });
});
