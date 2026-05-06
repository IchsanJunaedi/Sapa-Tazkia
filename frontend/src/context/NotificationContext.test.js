import React from 'react';
import { render, act, waitFor } from '@testing-library/react';

jest.mock('../api/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn() },
}));

let mockAuth = { isAuthenticated: false };
jest.mock('./AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const api = require('../api/axiosConfig').default;
const { NotificationProvider, useNotifications } = require('./NotificationContext');

const Probe = () => {
  const ctx = useNotifications();
  return (
    <div>
      <span data-testid="count">{ctx.unreadCount}</span>
      <span data-testid="size">{ctx.notifications.length}</span>
      <button data-testid="mark1" onClick={() => ctx.markRead(1)}>m1</button>
      <button data-testid="markall" onClick={() => ctx.markAllRead()}>ma</button>
    </div>
  );
};

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    api.get.mockReset();
    api.patch.mockReset();
    mockAuth = { isAuthenticated: false };
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not fetch when unauthenticated', () => {
    render(<NotificationProvider><Probe /></NotificationProvider>);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('fetches notifications when authenticated', async () => {
    mockAuth = { isAuthenticated: true };
    api.get.mockResolvedValue({ data: { data: [{ id: 1, isRead: false }, { id: 2, isRead: false }], unreadCount: 2 } });
    const { getByTestId } = render(<NotificationProvider><Probe /></NotificationProvider>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/notifications'));
    await waitFor(() => expect(getByTestId('size').textContent).toBe('2'));
    expect(getByTestId('count').textContent).toBe('2');
  });

  it('markRead patches and decrements count', async () => {
    mockAuth = { isAuthenticated: true };
    api.get.mockResolvedValue({ data: { data: [{ id: 1, isRead: false }], unreadCount: 1 } });
    api.patch.mockResolvedValue({});
    const { getByTestId } = render(<NotificationProvider><Probe /></NotificationProvider>);
    await waitFor(() => expect(getByTestId('count').textContent).toBe('1'));
    await act(async () => { getByTestId('mark1').click(); });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/notifications/1/read'));
    await waitFor(() => expect(getByTestId('count').textContent).toBe('0'));
  });

  it('markAllRead patches and zeroes count', async () => {
    mockAuth = { isAuthenticated: true };
    api.get.mockResolvedValue({ data: { data: [{ id: 1, isRead: false }, { id: 2, isRead: false }], unreadCount: 2 } });
    api.patch.mockResolvedValue({});
    const { getByTestId } = render(<NotificationProvider><Probe /></NotificationProvider>);
    await waitFor(() => expect(getByTestId('count').textContent).toBe('2'));
    await act(async () => { getByTestId('markall').click(); });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/notifications/read-all'));
    await waitFor(() => expect(getByTestId('count').textContent).toBe('0'));
  });

  it('handles api errors silently', async () => {
    mockAuth = { isAuthenticated: true };
    api.get.mockRejectedValue(new Error('boom'));
    const { getByTestId } = render(<NotificationProvider><Probe /></NotificationProvider>);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(getByTestId('count').textContent).toBe('0');
  });

  it('useNotifications throws outside provider', () => {
    const Bad = () => useNotifications();
    const orig = console.error;
    console.error = jest.fn();
    expect(() => render(<Bad />)).toThrow(/within NotificationProvider/);
    console.error = orig;
  });
});
