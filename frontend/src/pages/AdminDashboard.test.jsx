import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import axios from 'axios';

// Mock recharts
jest.mock('recharts', () => ({
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }) => <div style={{width: '100%', height: '100%'}}>{children}</div>,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
}));

jest.mock('axios');

describe('AdminDashboard', () => {
  beforeAll(() => {
    window.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
    
    const localStorageMock = (function() {
      let store = { token: 'fake-token' };
      return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        clear: () => { store = {}; },
        removeItem: (key) => { delete store[key]; }
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    axios.get.mockImplementation((url) => {
      if (url.includes('/admin/analytics/realtime')) {
        return Promise.resolve({ data: { realtime: { chatToday: 10, activeUsers: 5, tokensUsed: 1000, delta: {} } } });
      }
      if (url.includes('/admin/analytics/history')) {
        return Promise.resolve({ data: { snapshots: [], hourlyData: {}, topUsers: [], topQuestions: [] } });
      }
      if (url.includes('/admin/knowledge-base')) {
        return Promise.resolve({ data: { documents: [{ id: '1', content: 'Test Doc Content', source: 'src', category: 'cat' }] } });
      }
      if (url.includes('/admin/bug-reports')) {
          return Promise.resolve({ data: { reports: [{ id: '1', title: 'Bug Title 1', description: 'Broken', status: 'pending' }] } });
      }
      if (url.includes('/admin/suggested-prompts')) {
          return Promise.resolve({ data: [] });
      }
      if (url.includes('/admin/announcements')) {
          return Promise.resolve({ data: { data: [] } });
      }
      if (url.includes('/admin/chat-logs')) {
          return Promise.resolve({ data: { logs: [] } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  const renderDashboard = () => {
    return render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );
  };

  test('renders and allows switching through actual tabs', async () => {
    renderDashboard();
    
    // Default: Analytics
    await screen.findByText(/Chat Today/i);

    // Chat Logs
    fireEvent.click(screen.getByText('Chat Logs'));
    await screen.findByText('Live Chat Logs');

    // Knowledge Base
    fireEvent.click(screen.getByText('Knowledge Base'));
    await screen.findByText('Test Doc Content');

    // Bug Reports
    fireEvent.click(screen.getByText('Bug Reports'));
    await screen.findByText('Bug Title 1');

    // Suggested Prompts
    fireEvent.click(screen.getByText('Suggested Prompts'));
    await screen.findByPlaceholderText('Teks pertanyaan...');

    // Pengumuman
    fireEvent.click(screen.getByText('Pengumuman'));
    await screen.findByPlaceholderText('Judul pengumuman...');
  });

  test('handles adding a document in Knowledge Base', async () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Knowledge Base'));
    await screen.findByText('Test Doc Content');
    
    fireEvent.click(screen.getByText(/Add Document/i));
    fireEvent.change(screen.getByPlaceholderText(/Enter document content/i), { target: { value: 'New knowledge content long enough' } });
    
    axios.post.mockResolvedValue({ data: { success: true } });
    fireEvent.click(screen.getByText(/Add & Embed/i));
    
    await waitFor(() => expect(axios.post).toHaveBeenCalled());
  });
});
