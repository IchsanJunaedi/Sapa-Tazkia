import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from './ChatPage';

// Mock dependencies
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Test User' },
    logout: jest.fn(),
    loading: false,
    isAuthenticated: true,
  }),
}));

jest.mock('../api/axiosConfig', () => ({
  get: jest.fn().mockResolvedValue({ data: { conversations: [] } }),
  delete: jest.fn().mockResolvedValue({}),
}));

jest.mock('../api/aiService', () => ({
  sendMessageToAI: jest.fn().mockResolvedValue({ message: 'Hello!' }),
  cancelCurrentRequest: jest.fn(),
  addRateLimitListener: jest.fn(),
  removeRateLimitListener: jest.fn(),
}));

jest.mock('../utils/pdfGenerator', () => ({
  generateTranscriptPDF: jest.fn(),
}));

jest.mock('../components/common/NotificationDropdown', () => () => <div />);

beforeAll(() => {
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  }));
});

describe('ChatPage', () => {
  it('renders correctly without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    );

    expect(container).toBeInTheDocument();
  });
});
