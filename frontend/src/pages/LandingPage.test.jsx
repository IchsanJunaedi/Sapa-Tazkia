import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import api from '../api/axiosConfig';
beforeAll(() => {
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  }));
});

jest.mock('../api/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: { data: [], conversations: [] } })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
  clearAuthHeaders: jest.fn(),
  setAuthHeaders: jest.fn(),
  testConnection: jest.fn(() => Promise.resolve(true)),
}));

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
