// Fix for TextEncoder is not defined
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock dependencies
jest.mock('../context/AuthContext');
jest.mock('../api/axiosConfig');
jest.mock('../api/aiService');
jest.mock('../utils/pdfGenerator');

// Mock components
jest.mock('../components/ConfirmationModal', () => ({ isOpen, onConfirm, title }) => (
  isOpen ? (
    <div data-testid="confirmation-modal">
      <h2>{title}</h2>
      <button onClick={onConfirm}>Confirm</button>
    </div>
  ) : null
));

jest.mock('../components/layout/SideBar', () => ({ onNewChat, onSelectChat, chatHistory, onDeleteChat }) => (
  <div data-testid="sidebar">
    <button onClick={onNewChat}>New Chat</button>
    <ul>
      {chatHistory.map(chat => (
        <li key={chat.id}>
          <button onClick={() => onSelectChat(chat.id)}>{chat.title}</button>
          <button onClick={() => onDeleteChat(chat.id)}>Delete Chat Button</button>
        </li>
      ))}
    </ul>
  </div>
));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

const ChatPage = require('./ChatPage').default;
const { useAuth } = require('../context/AuthContext');
const api = require('../api/axiosConfig').default;
const { sendMessageToAI, cancelCurrentRequest } = require('../api/aiService');

describe('ChatPage', () => {
  let mockLogout;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout = jest.fn();

    useAuth.mockReturnValue({
      user: { id: '1', fullName: 'Test User' },
      logout: mockLogout,
      loading: false,
      isAuthenticated: true,
    });

    api.get.mockImplementation((url) => {
      if (url === '/ai/conversations') {
        return Promise.resolve({ data: { conversations: [{ id: 'chat-1', title: 'Old Chat' }] } });
      }
      if (url.startsWith('/ai/history/')) {
        return Promise.resolve({ data: { messages: [{ role: 'user', content: 'Hi' }, { role: 'bot', content: 'Hello' }] } });
      }
      return Promise.resolve({ data: { success: true, messages: [] } });
    });

    api.delete.mockResolvedValue({ data: { success: true } });

    sendMessageToAI.mockResolvedValue({
      message: 'AI response',
      conversationId: 'new-chat-id',
      timestamp: new Date().toISOString(),
    });

    window.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: () => null,
      unobserve: () => null,
      disconnect: () => null,
    }));

    // Clean localStorage mock
    const storage = {};
    const localStorageMock = {
      getItem: jest.fn(key => storage[key] || null),
      setItem: jest.fn((key, value) => { storage[key] = value.toString(); }),
      removeItem: jest.fn(key => { delete storage[key]; }),
      clear: jest.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  });

  const renderWithRouter = (initialState = {}, path = '/chat') => {
    return render(
      <MemoryRouter initialEntries={[{ pathname: path, state: initialState }]}>
        <Routes>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:chatId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  test('renders and loads conversations', async () => {
    renderWithRouter();
    await screen.findByText('Old Chat');
  });

  test('handles chat selection from sidebar', async () => {
    renderWithRouter();
    await screen.findByText('Old Chat');
    fireEvent.click(screen.getByText('Old Chat'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/history/chat-1'));
    expect(await screen.findByText('Hello')).toBeInTheDocument();
  });

  test('handles chat deletion', async () => {
    renderWithRouter();
    await screen.findByText('Old Chat');
    fireEvent.click(screen.getByText('Delete Chat Button'));
    
    // Conf modal should show
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirm'));
    
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/ai/conversations/chat-1'));
  });

  test('handles logout on 401', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } });
    renderWithRouter();
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  test('handles sending a message and starting a new chat', async () => {
    renderWithRouter();
    
    const input = screen.getByPlaceholderText(/Message Sapa Tazkia/i);
    fireEvent.change(input, { target: { value: 'What is IPK?' } });
    fireEvent.submit(screen.getByTestId('tanya-form'));

    await waitFor(() => {
      expect(sendMessageToAI).toHaveBeenCalledWith(
        'What is IPK?',
        false, // isGuest
        true,  // shouldCreateNewChat
        null,  // currentChatId
        expect.any(Function) // onStream
      );
    });

    // Use findByText to wait for typewriter or use old timestamp
    expect(await screen.findByText('AI response')).toBeInTheDocument();
  });

  test('handles streaming response', async () => {
    sendMessageToAI.mockImplementation((msg, isGuest, isNew, chatId, onStream) => {
      onStream('He', false);
      onStream('llo', false);
      return Promise.resolve({
        message: 'Hello',
        conversationId: 'chat-stream',
      });
    });

    renderWithRouter();
    
    const input = screen.getByPlaceholderText(/Message Sapa Tazkia/i);
    fireEvent.change(input, { target: { value: 'Say hello' } });
    fireEvent.submit(screen.getByTestId('tanya-form'));

    // The component should show the streamed chunks
    await screen.findByText('Hello');
  });

  test('handles guest mode', async () => {
    // Mock localStorage to simulate guest
    const localStorageMock = {
      getItem: jest.fn((key) => {
        if (key === 'guestSessionId') return 'guest-123';
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

    renderWithRouter({ isGuest: true });

    const input = screen.getByPlaceholderText(/Message Sapa Tazkia/i);
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.submit(screen.getByTestId('tanya-form'));

    await waitFor(() => {
      expect(sendMessageToAI).toHaveBeenCalledWith(
        'Hello',
        true, // isGuest should be true
        true,
        null,
        expect.any(Function)
      );
    });
  });

  test('handles PDF download button in message', async () => {
    // Set timestamp to past to avoid typewriter effect delays
    const pastDate = new Date(Date.now() - 10000).toISOString();
    sendMessageToAI.mockResolvedValue({
      message: 'Here is your transcript [DOWNLOAD_PDF]',
      conversationId: 'chat-pdf',
      timestamp: pastDate,
    });

    const { generateTranscriptPDF } = require('../utils/pdfGenerator');
    api.get.mockImplementation((url) => {
      if (url === '/academic/transcript') {
        return Promise.resolve({ data: { success: true, data: { transcript: 'data' } } });
      }
      return Promise.resolve({ data: { conversations: [] } });
    });

    renderWithRouter();
    
    const input = screen.getByPlaceholderText(/Message Sapa Tazkia/i);
    fireEvent.change(input, { target: { value: 'Download my PDF' } });
    fireEvent.submit(screen.getByTestId('tanya-form'));

    // Button text is "Download Transkrip PDF"
    const pdfButton = await screen.findByText(/Download Transkrip PDF/i);
    expect(pdfButton).toBeInTheDocument();

    fireEvent.click(pdfButton);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/academic/transcript');
      expect(generateTranscriptPDF).toHaveBeenCalledWith({ transcript: 'data' });
    });
  });

  test('handles retry on error', async () => {
    // Mock Date.now to be consistent
    const now = Date.now();
    const pastDate = new Date(now - 10000).toISOString();
    
    sendMessageToAI.mockRejectedValueOnce({ status: 500 });
    
    renderWithRouter();
    
    const input = screen.getByPlaceholderText(/Message Sapa Tazkia/i);
    fireEvent.change(input, { target: { value: 'Retry this' } });
    fireEvent.submit(screen.getByTestId('tanya-form'));

    // The error message is added with current timestamp, so it might be "typing"
    // We need to wait or mock Date.now to be in the future when checking
    
    const errorText = await screen.findByText(/Maaf, terjadi kesalahan pada sistem/i);
    expect(errorText).toBeInTheDocument();
    
    // To see the retry button, isTyping must be false.
    // isTyping is false if !isRecent OR typewriter finished.
    // Let's just wait a bit or find it.
    
    const retryButton = await screen.findByTitle(/Coba lagi/i);
    expect(retryButton).toBeInTheDocument();
    
    sendMessageToAI.mockResolvedValueOnce({
      message: 'Success after retry',
      conversationId: 'chat-retry',
      timestamp: pastDate,
    });

    fireEvent.click(retryButton);

    expect(await screen.findByText('Success after retry')).toBeInTheDocument();
  });

  test('handles cancelling generation', async () => {
    // Mock a slow response that we can cancel
    let cancelPromise;
    sendMessageToAI.mockImplementation(() => {
      cancelPromise = new Promise((resolve, reject) => {
        // This promise won't resolve until we mock-cancel it
      });
      return cancelPromise;
    });

    renderWithRouter();
    
    const input = screen.getByPlaceholderText(/Message Sapa Tazkia/i);
    fireEvent.change(input, { target: { value: 'Slow message' } });
    fireEvent.submit(screen.getByTestId('tanya-form'));

    // Check for cancel button (Square icon in the form)
    const cancelButton = await screen.findByLabelText(/Cancel Generation/i);
    
    cancelCurrentRequest.mockReturnValue(true);
    
    fireEvent.click(cancelButton);
    
    expect(cancelCurrentRequest).toHaveBeenCalled();
  });
});
