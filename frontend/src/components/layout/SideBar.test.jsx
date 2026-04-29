import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './SideBar';

jest.mock('../../api/axiosConfig', () => ({
  get: jest.fn().mockResolvedValue({ data: { conversations: [] } }),
}));

jest.mock('../common/NotificationDropdown', () => () => <div data-testid="notification-dropdown" />);
jest.mock('./ProfilePopover', () => () => <div data-testid="profile-popover" />);

describe('Sidebar', () => {
  const mockUser = { name: 'Test User', nim: '123456789012', email: 'test@tazkia.ac.id' };

  it('renders correctly', () => {
    render(
      <MemoryRouter>
        <Sidebar 
          user={mockUser} 
          isSidebarOpen={true} 
          onToggleSidebar={jest.fn()} 
          chatHistory={[]} 
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
  });
});
