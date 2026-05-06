import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../context/NotificationContext', () => ({
  useNotifications: jest.fn(),
}));

import { useNotifications } from '../../context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';

const setup = (overrides = {}) => {
  useNotifications.mockReturnValue({
    notifications: [],
    unreadCount: 0,
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    ...overrides,
  });
  return render(<NotificationDropdown />);
};

describe('NotificationDropdown', () => {
  beforeEach(() => useNotifications.mockReset());

  it('renders bell icon and is closed by default', () => {
    setup();
    expect(screen.getByTitle('Notifikasi')).toBeInTheDocument();
    expect(screen.queryByText('Notifikasi', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('shows unread count badge capped at 9+', () => {
    setup({ unreadCount: 12 });
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('shows exact unread count below 10', () => {
    setup({ unreadCount: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens dropdown on bell click and shows empty state', () => {
    setup();
    fireEvent.click(screen.getByTitle('Notifikasi'));
    expect(screen.getByText('Belum ada notifikasi')).toBeInTheDocument();
  });

  it('renders notifications list with mark-all when unread', () => {
    const markAllRead = jest.fn();
    const markRead = jest.fn();
    const now = new Date();
    setup({
      unreadCount: 1,
      markAllRead,
      markRead,
      notifications: [
        {
          id: 'n1',
          isRead: false,
          createdAt: now,
          announcement: { title: 'Maintenance', message: 'a'.repeat(100) },
        },
        {
          id: 'n2',
          isRead: true,
          createdAt: new Date(Date.now() - 5 * 60 * 1000),
          announcement: { title: 'Welcome', message: 'short msg' },
        },
      ],
    });
    fireEvent.click(screen.getByTitle('Notifikasi'));
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Tandai semua dibaca/i));
    expect(markAllRead).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Maintenance'));
    expect(markRead).toHaveBeenCalledWith('n1');
  });

  it('formats relative time variants', () => {
    const now = Date.now();
    setup({
      unreadCount: 0,
      notifications: [
        { id: '1', isRead: true, createdAt: new Date(now - 10 * 1000), announcement: { title: 'Just now', message: '' } },
        { id: '2', isRead: true, createdAt: new Date(now - 5 * 60 * 1000), announcement: { title: 'Mins', message: '' } },
        { id: '3', isRead: true, createdAt: new Date(now - 5 * 3600 * 1000), announcement: { title: 'Hrs', message: '' } },
        { id: '4', isRead: true, createdAt: new Date(now - 3 * 86400 * 1000), announcement: { title: 'Days', message: '' } },
      ],
    });
    fireEvent.click(screen.getByTitle('Notifikasi'));
    expect(screen.getByText(/Baru saja/)).toBeInTheDocument();
    expect(screen.getByText(/mnt lalu/)).toBeInTheDocument();
    expect(screen.getByText(/jam lalu/)).toBeInTheDocument();
    expect(screen.getByText(/hari lalu/)).toBeInTheDocument();
  });

  it('closes when clicking outside', () => {
    setup({ unreadCount: 0 });
    fireEvent.click(screen.getByTitle('Notifikasi'));
    expect(screen.getByText('Belum ada notifikasi')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Belum ada notifikasi')).not.toBeInTheDocument();
  });
});
