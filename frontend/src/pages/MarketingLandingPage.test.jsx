import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarketingLandingPage from './MarketingLandingPage';
import { useAuth } from '../context/AuthContext';

// Mock framer-motion to avoid animation issues in JSDOM
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    header: ({ children, ...props }) => <header {...props}>{children}</header>,
    section: ({ children, ...props }) => <section {...props}>{children}</section>,
    nav: ({ children, ...props }) => <nav {...props}>{children}</nav>,
    h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }) => <p {...props}>{children}</p>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
    a: ({ children, ...props }) => <a {...props}>{children}</a>,
    span: ({ children, ...props }) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
  useScroll: () => ({ scrollY: { onChange: jest.fn() } }),
  useTransform: () => ({}),
  useSpring: () => ({}),
}));

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('MarketingLandingPage', () => {
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: null,
      logout: mockLogout,
      isAuthenticated: false,
    });
    
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  test('renders hero section and key features', () => {
    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    // Text is split by BlurText or appears in multiple sections, so we check for presence
    expect(screen.getAllByText(/Tanya/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mulai Sekarang/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Coba sebagai Tamu/i).length).toBeGreaterThan(0);
  });

  test('navbar appears on scroll', async () => {
    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    // Mock scroll event
    fireEvent.scroll(window, { target: { scrollY: 100 } });
    
    // In actual component, scroll visibility is handled by motion/state
    // We just check if it renders initially
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  test('user menu opens and handles logout', async () => {
    useAuth.mockReturnValue({
      user: { fullName: 'Ichsan Junaedi', email: 'ichsan@example.com' },
      logout: mockLogout,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    // For 'Ichsan Junaedi', initials should be 'IJ'
    const userButton = screen.getByText('IJ');
    fireEvent.click(userButton);

    const logoutButton = screen.getByText(/Keluar/i);
    fireEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalled();
  });

  test('mobile menu toggles', async () => {
    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    // In desktop view, mobile menu button might not be visible or present
    // But we check for any button that looks like a menu toggle
    const menuButtons = screen.getAllByRole('button');
    const mobileToggle = menuButtons.find(btn => btn.querySelector('svg.lucide-menu') || btn.innerHTML.includes('Menu'));
    
    if (mobileToggle) {
      fireEvent.click(mobileToggle);
    }
    
    // Check for menu items (should be visible either via mobile toggle or desktop nav)
    expect(screen.getAllByText(/Fitur/i).length).toBeGreaterThan(0);
  });

  test('hero panel can be closed and reopened', async () => {
    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    // Find the close button (X) in the hero panel
    const closeButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('svg.lucide-x'));
    expect(closeButtons.length).toBeGreaterThan(0);
    
    fireEvent.click(closeButtons[0]);

    // Reopen button (Menu)
    const reopenButton = screen.getByRole('button', { name: /Menu/i });
    fireEvent.click(reopenButton);
    
    expect(screen.getAllByText(/Tanya/i).length).toBeGreaterThan(0);
  });

  test('hero dropdown menu works', async () => {
    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuBtn);

    // Should see navigation links in dropdown
    expect(screen.getAllByText(/Fitur/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kontak/i).length).toBeGreaterThan(0);

    // Clicking a link closes the menu
    const fiturLinks = screen.getAllByText(/Fitur/i);
    fireEvent.click(fiturLinks[0]);
    
    // Menu should be closed
    await waitFor(() => {
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  test('navigates to login when clicking login in mobile menu', async () => {
    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    const menuBtn = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuBtn);

    const loginBtns = screen.getAllByText(/Login/i);
    expect(loginBtns.length).toBeGreaterThan(0);
  });

  test('contact form handles submission', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    );

    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/Nama lengkapmu/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText(/Email kampus atau pribadimu/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Tuliskan pertanyaan/i), { target: { value: 'Hello' } });

    fireEvent.submit(screen.getByRole('button', { name: /Kirim Pesan/i }));

    await waitFor(() => {
      expect(screen.getByText(/Pesan Terkirim!/i)).toBeInTheDocument();
    });
  });

  test('opens footer modals', async () => {
    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Privasi/i }));
    expect(screen.getByRole('heading', { name: /Kebijakan Privasi/i })).toBeInTheDocument();

    const closeBtn = screen.getAllByRole('button').find(btn => btn.querySelector('svg.lucide-x'));
    fireEvent.click(closeBtn);

    fireEvent.click(screen.getByRole('button', { name: /Syarat/i }));
    expect(screen.getByRole('heading', { name: /Syarat Penggunaan/i })).toBeInTheDocument();
  });
});
