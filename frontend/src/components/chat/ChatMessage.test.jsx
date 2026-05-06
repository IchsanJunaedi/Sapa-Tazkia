import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';

// Stub heavy markdown / syntax highlighter to avoid pulling huge ESM modules
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="markdown">{children}</div>,
}));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => () => {} }));
jest.mock('react-syntax-highlighter', () => ({
  __esModule: true,
  Prism: ({ children }) => <pre>{children}</pre>,
}));
jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  __esModule: true,
  oneDark: {},
}));

import ChatMessage from './ChatMessage';

const oldMsg = (overrides = {}) => ({
  role: 'assistant',
  content: 'Halo, bagaimana saya bisa membantu?',
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('ChatMessage', () => {
  it('renders user message immediately and right-aligned', () => {
    render(<ChatMessage message={{ role: 'user', content: 'Halo Bot', createdAt: new Date().toISOString() }} />);
    expect(screen.getByText('Halo Bot')).toBeInTheDocument();
  });

  it('renders historical assistant message via MarkdownRenderer', () => {
    render(<ChatMessage message={oldMsg()} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent(/Halo, bagaimana/);
  });

  it('animates new bot messages and finishes on full reveal', () => {
    const newMsg = {
      role: 'assistant',
      content: 'Hi',
      createdAt: new Date().toISOString(),
    };
    render(<ChatMessage message={newMsg} />);
    act(() => { jest.advanceTimersByTime(200); });
    // After enough ticks, full content should be displayed via markdown
    expect(screen.getByTestId('markdown')).toHaveTextContent(/Hi/);
  });

  it('copies content via navigator.clipboard when copy button clicked', async () => {
    render(<ChatMessage message={oldMsg()} />);
    const copyBtn = screen.getByTitle(/Salin teks/i);
    await act(async () => { fireEvent.click(copyBtn); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Halo, bagaimana saya bisa membantu?');
  });

  it('shows PDF download button when message.hasPDF is true', () => {
    render(<ChatMessage message={{ ...oldMsg(), hasPDF: true }} />);
    expect(screen.getByText(/Unduh Nilai/i)).toBeInTheDocument();
  });

  it('handles message without timestamp/createdAt (treated as recent → animates)', () => {
    render(<ChatMessage message={{ role: 'assistant', content: 'X' }} />);
    act(() => { jest.advanceTimersByTime(500); });
    expect(screen.getByTestId('markdown')).toBeInTheDocument();
  });

  it('renders Arabic content with rtl class', () => {
    render(<ChatMessage message={oldMsg({ content: 'مرحبا' })} />);
    expect(screen.getByTestId('markdown')).toHaveTextContent('مرحبا');
  });

  it('handles empty content without crashing', () => {
    const { container } = render(<ChatMessage message={oldMsg({ content: '' })} />);
    expect(container.querySelector('.markdown-body')).toBeInTheDocument();
  });
});
