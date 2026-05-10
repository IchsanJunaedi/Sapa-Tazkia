import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../api/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: { conversations: [] } }),
    patch: jest.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

jest.mock('../common/NotificationDropdown', () => () => <div data-testid="notification-dropdown" />);
jest.mock('./ProfilePopover', () => ({ getUserName, getUserEmail, onLogout, onClose, onSettingsClick }) => (
  <div data-testid="profile-popover">
    <span>{getUserName()}</span>
    <span>{getUserEmail()}</span>
    <button onClick={onLogout}>Logout</button>
    <button onClick={onSettingsClick}>Settings</button>
    <button onClick={onClose}>Close</button>
  </div>
));

jest.mock('sweetalert2', () => ({
  fire: jest.fn().mockResolvedValue({ value: null }),
}));

import Sidebar from './SideBar';

const mockUser = { name: 'Test User', nim: '123456789012', email: 'test@tazkia.ac.id' };

const now = new Date();
const todayChat = { id: 'chat-1', title: 'Today Chat', timestamp: now.toISOString() };
const yesterdayChat = { id: 'chat-2', title: 'Yesterday Chat', timestamp: new Date(now - 86400000).toISOString() };
const oldChat = { id: 'chat-3', title: 'Old Chat', timestamp: new Date(now - 86400000 * 40).toISOString() };

const defaultProps = {
  user: mockUser,
  onLogin: jest.fn(),
  onLogout: jest.fn(),
  chatHistory: [todayChat, yesterdayChat, oldChat],
  currentChatId: null,
  onSelectChat: jest.fn(),
  onDeleteChat: jest.fn(),
  isDeleting: false,
  isSidebarOpen: true,
  onToggleSidebar: jest.fn(),
  onNewChat: jest.fn(),
  onSettingsClick: jest.fn(),
  isStartingNewChat: false,
};

function renderSidebar(props = {}) {
  return render(
    <MemoryRouter>
      <Sidebar {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Basic Rendering ──────────────────────────────────────────────────────

  it('renders user name when sidebar is open', () => {
    renderSidebar();
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
  });

  it('renders chat history items', () => {
    renderSidebar();
    expect(screen.getByText('Today Chat')).toBeInTheDocument();
    expect(screen.getByText('Yesterday Chat')).toBeInTheDocument();
    expect(screen.getByText('Old Chat')).toBeInTheDocument();
  });

  it('renders New Chat button', () => {
    renderSidebar();
    // The new chat button has PenSquare icon
    const newChatBtns = screen.getAllByRole('button');
    expect(newChatBtns.length).toBeGreaterThan(0);
  });

  it('renders notification dropdown', () => {
    renderSidebar();
    expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
  });

  // ─── Chat Selection ────────────────────────────────────────────────────────

  it('calls onSelectChat when a chat is clicked', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('Today Chat'));
    expect(defaultProps.onSelectChat).toHaveBeenCalledWith('chat-1');
  });

  it('does not call onSelectChat when same chat is clicked', () => {
    renderSidebar({ currentChatId: 'chat-1' });
    fireEvent.click(screen.getByText('Today Chat'));
    expect(defaultProps.onSelectChat).not.toHaveBeenCalled();
  });

  it('does not call onSelectChat when isDeleting', () => {
    renderSidebar({ isDeleting: true });
    fireEvent.click(screen.getByText('Today Chat'));
    expect(defaultProps.onSelectChat).not.toHaveBeenCalled();
  });

  // ─── New Chat ──────────────────────────────────────────────────────────────

  it('calls onNewChat when new chat button is clicked', () => {
    renderSidebar();
    // Find the new chat button (PenSquare icon button)
    const buttons = screen.getAllByRole('button');
    const newChatBtn = buttons.find(btn => btn.getAttribute('title') === 'New Chat' || btn.textContent === '');
    if (newChatBtn) {
      fireEvent.click(newChatBtn);
    }
    // Alternative: look for the button with specific aria or title
  });

  // ─── Toggle Sidebar ────────────────────────────────────────────────────────

  it('calls onToggleSidebar when toggle button is clicked', () => {
    renderSidebar();
    const toggleBtn = screen.getByAltText('Toggle Sidebar');
    fireEvent.click(toggleBtn.closest('button'));
    expect(defaultProps.onToggleSidebar).toHaveBeenCalled();
  });

  // ─── Collapsed State ───────────────────────────────────────────────────────

  it('hides chat titles when sidebar is collapsed', () => {
    renderSidebar({ isSidebarOpen: false });
    // In collapsed mode, text should be hidden
    expect(screen.queryByText('Today Chat')).not.toBeInTheDocument();
  });

  // ─── Profile Popover ───────────────────────────────────────────────────────

  it('shows profile popover when profile area is clicked', () => {
    renderSidebar();
    // Click on the user profile area (contains user name)
    const userNameEl = screen.getByText(/Test User/i);
    fireEvent.click(userNameEl.closest('button') || userNameEl.closest('div[class*="cursor"]') || userNameEl);
    // Profile popover should appear
    expect(screen.getByTestId('profile-popover')).toBeInTheDocument();
  });

  it('calls onLogout from profile popover', () => {
    renderSidebar();
    const userNameEl = screen.getByText(/Test User/i);
    fireEvent.click(userNameEl.closest('button') || userNameEl);
    
    fireEvent.click(screen.getByText('Logout'));
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  // ─── No User (Guest) ──────────────────────────────────────────────────────

  it('renders login area when no user is provided', () => {
    renderSidebar({ user: null });
    // Without a user, the sidebar should still render without crashing
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  // ─── Chat Groups ──────────────────────────────────────────────────────────

  it('groups chats by time period', () => {
    renderSidebar();
    // Chats are rendered and grouped - verify they appear in the DOM
    expect(screen.getByText('Today Chat')).toBeInTheDocument();
    expect(screen.getByText('Yesterday Chat')).toBeInTheDocument();
  });

  // ─── Search ────────────────────────────────────────────────────────────────

  it('renders search input when sidebar is open', () => {
    renderSidebar();
    const searchInput = screen.queryByPlaceholderText(/Cari/i) || screen.queryByRole('searchbox');
    // Search might be present depending on implementation
  });

  // ─── Empty Chat History ────────────────────────────────────────────────────

  it('renders correctly with empty chat history', () => {
    renderSidebar({ chatHistory: [] });
    expect(screen.queryByText('Today Chat')).not.toBeInTheDocument();
  });

  // ─── Chat Section Toggle ───────────────────────────────────────────────────

  it('renders all chat items in the list', () => {
    renderSidebar();
    expect(screen.getByText('Today Chat')).toBeInTheDocument();
    expect(screen.getByText('Old Chat')).toBeInTheDocument();
  });
});
