import React from 'react';
import { render, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

const Probe = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} data-testid="probe">{theme}</button>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    if (!window.matchMedia) {
      window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
    }
  });

  it('uses saved theme from localStorage', () => {
    localStorage.setItem('sapa_theme', 'dark');
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(getByTestId('probe').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('defaults from prefers-color-scheme when no saved value', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(getByTestId('probe').textContent).toBe('dark');
  });

  it('toggles theme between dark and light', () => {
    localStorage.setItem('sapa_theme', 'light');
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>);
    const btn = getByTestId('probe');
    expect(btn.textContent).toBe('light');
    act(() => btn.click());
    expect(btn.textContent).toBe('dark');
    expect(localStorage.getItem('sapa_theme')).toBe('dark');
    act(() => btn.click());
    expect(btn.textContent).toBe('light');
  });

  it('useTheme throws outside provider', () => {
    const Bad = () => useTheme();
    const orig = console.error;
    console.error = jest.fn();
    expect(() => render(<Bad />)).toThrow(/within ThemeProvider/);
    console.error = orig;
  });
});
