import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePopover from './ProfilePopover';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const defaultProps = {
  getUserName: () => 'John Doe',
  getUserEmail: () => 'john@tazkia.ac.id',
  position: { x: 100, y: 200 },
  onLogout: jest.fn(),
  onSettingsClick: jest.fn(),
  onClose: jest.fn(),
};

function renderPopover(props = {}) {
  return render(
    <MemoryRouter>
      <ProfilePopover {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe('ProfilePopover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
  });

  it('renders user name and email', () => {
    renderPopover();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@tazkia.ac.id')).toBeInTheDocument();
  });

  it('renders Settings, Tentang, Help, and Log out buttons', () => {
    renderPopover();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Tentang')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    renderPopover();
    // The backdrop is the first fixed div
    const backdrop = document.querySelector('.fixed.inset-0');
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSettingsClick and onClose when Settings is clicked', () => {
    renderPopover();
    fireEvent.click(screen.getByText('Settings'));
    expect(defaultProps.onSettingsClick).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to /tentang when Tentang is clicked', () => {
    renderPopover();
    fireEvent.click(screen.getByText('Tentang'));
    expect(mockNavigate).toHaveBeenCalledWith('/tentang');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onLogout when Log out is clicked', () => {
    renderPopover();
    fireEvent.click(screen.getByText('Log out'));
    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });

  it('toggles help submenu on click (mobile mode)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
    renderPopover();

    // Help items should not be visible initially
    expect(screen.queryByText('Help center')).not.toBeInTheDocument();

    // Click Help to expand
    fireEvent.click(screen.getByText('Help'));
    expect(screen.getByText('Help center')).toBeInTheDocument();
    expect(screen.getByText('Terms & policies')).toBeInTheDocument();
    expect(screen.getByText('Report a bug')).toBeInTheDocument();
  });

  it('navigates to help item path when clicked', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
    renderPopover();

    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('Help center'));

    expect(mockNavigate).toHaveBeenCalledWith('/help');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('disables items without a path (Team dev)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
    renderPopover();

    fireEvent.click(screen.getByText('Help'));
    const teamDevBtn = screen.getByText('Team dev');
    expect(teamDevBtn).toBeDisabled();
  });
});
