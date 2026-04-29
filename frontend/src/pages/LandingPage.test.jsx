import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import api from '../api/axiosConfig';

import axios from 'axios';

jest.mock('axios', () => {
  const mockAxios = {
    get: jest.fn(() => Promise.resolve({ data: { data: [] } })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
  };
  return {
    __esModule: true,
    default: mockAxios,
    ...mockAxios
  };
});

jest.mock('../api/axiosConfig', () => {
  const mockApi = {
    get: jest.fn().mockResolvedValue({ data: { conversations: [] } }),
  };
  return {
    __esModule: true,
    default: mockApi,
    ...mockApi
  };
});

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    logout: jest.fn(),
    loading: false,
    isAuthenticated: false,
    handleGoogleAuthCallback: jest.fn(),
    needsProfileCompletion: false,
    pendingVerification: false,
    pendingEmail: null,
  }),
}));

beforeAll(() => {
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  }));
});

jest.mock('../components/common/NotificationDropdown', () => () => <div data-testid="notification-dropdown" />);

describe('LandingPage', () => {
  it('renders correctly without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    // Verify it rendered successfully by checking if a main wrapper exists
    expect(container).toBeInTheDocument();
  });
});
