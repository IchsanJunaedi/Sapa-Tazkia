import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatWindow from './ChatWindow';

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('ChatWindow', () => {
  const mockMessages = [
    { role: 'user', content: 'Hello AI' },
    { role: 'assistant', content: 'Hello Human! **I am here to help.**', isStreamComplete: true },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders empty state when no messages', () => {
    render(<ChatWindow messages={[]} isLoading={false} error={null} />);
    expect(screen.getByText(/Sapa Tazkia AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Tanyakan apa saja tentang Tazkia/i)).toBeInTheDocument();
  });

  test('renders messages correctly', () => {
    render(<ChatWindow messages={mockMessages} isLoading={false} error={null} />);
    expect(screen.getByText('Hello AI')).toBeInTheDocument();
    expect(screen.getByText(/Hello Human!/i)).toBeInTheDocument();
    expect(screen.getByText(/I am here to help/i)).toBeInTheDocument();
  });

  test('handles Arabic text correctly', () => {
    const arabicMsg = [{ role: 'assistant', content: 'السلام عليكم', isStreamComplete: true }];
    render(<ChatWindow messages={arabicMsg} isLoading={false} error={null} />);
    
    const messageContainer = screen.getByText('السلام عليكم');
    expect(messageContainer.className).toContain('arabic-text');
  });

  test('renders markdown links', () => {
    const linkMsg = [{ role: 'assistant', content: 'Check [Tazkia](https://tazkia.ac.id)', isStreamComplete: true }];
    render(<ChatWindow messages={linkMsg} isLoading={false} error={null} />);
    
    const link = screen.getByRole('link', { name: 'Tazkia' });
    expect(link).toHaveAttribute('href', 'https://tazkia.ac.id');
  });

  test('shows typing indicator when loading', () => {
    render(<ChatWindow messages={mockMessages} isLoading={true} error={null} />);
    const dots = document.querySelectorAll('.typing-dot');
    expect(dots.length).toBe(3);
  });

  test('renders rate limit error state', () => {
    const rateLimitError = { code: 'rate_limit_exceeded', message: 'Limit reached' };
    render(<ChatWindow messages={[]} isLoading={false} error={rateLimitError} />);
    
    expect(screen.getByText(/Batas Penggunaan Tercapai/i)).toBeInTheDocument();
    expect(screen.getByText(/Limit reached/i)).toBeInTheDocument();
  });

  test('renders general error state', () => {
    const generalError = { message: 'System down' };
    render(<ChatWindow messages={[]} isLoading={false} error={generalError} />);
    
    expect(screen.getByText(/System down/i)).toBeInTheDocument();
  });

  test('handles message copy', async () => {
    const oldMessages = [
      { role: 'assistant', content: 'Copy me', isStreamComplete: true }
    ];
    render(<ChatWindow messages={oldMessages} isLoading={false} error={null} />);
    
    const copyButton = screen.getByTitle(/Salin teks/i);
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Copy me');
    });
  });

  test('renders PDF download button when available', () => {
    const pdfMsg = [{ role: 'assistant', content: 'Here is your PDF', hasPDF: true, isStreamComplete: true }];
    const mockDownload = jest.fn();
    render(<ChatWindow messages={pdfMsg} isLoading={false} error={null} onDownloadPDF={mockDownload} />);
    
    const downloadBtn = screen.getByText(/Download Transkrip PDF/i);
    fireEvent.click(downloadBtn);
    expect(mockDownload).toHaveBeenCalled();
  });

  test('renders retry button for errors', () => {
    const errorMsg = [{ role: 'assistant', content: 'Error occurred', isError: true, isStreamComplete: true }];
    const mockRetry = jest.fn();
    render(<ChatWindow messages={errorMsg} isLoading={false} error={null} onRetry={mockRetry} />);
    
    const retryBtn = screen.getByTitle(/Coba lagi/i);
    fireEvent.click(retryBtn);
    expect(mockRetry).toHaveBeenCalled();
  });
});
