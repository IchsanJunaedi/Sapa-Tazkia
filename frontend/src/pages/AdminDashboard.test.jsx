import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import axios from 'axios';

jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} }),
}));

// Mock recharts
jest.mock('recharts', () => ({
  BarChart: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
  AreaChart: () => null,
  Area: () => null,
}));

jest.mock('axios');

beforeAll(() => {
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

describe('AdminDashboard', () => {
  it('renders correctly without crashing', async () => {
    // Mock the realtime analytics, history, and knowledge base API returns
    axios.get.mockImplementation((url) => {
      if (url.includes('realtime')) {
        return Promise.resolve({ data: { realtime: {} } });
      }
      if (url.includes('history')) {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );

    // After component loads, should render the KPI cards among other things
    await waitFor(() => {
      expect(screen.getByText(/Chat Today/i)).toBeInTheDocument();
    });
  });
});
