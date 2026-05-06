import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const Boom = () => {
  throw new Error('boom');
};

describe('ErrorBoundary', () => {
  let originalConsoleError;
  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>healthy</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('catches errors and shows fallback UI', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/terjadi kesalahan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Beranda/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Muat Ulang/i })).toBeInTheDocument();
  });

  it('reloads the page when "Muat Ulang" is clicked', () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { reload: jest.fn(), href: '' };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /Muat Ulang/i }));
    expect(window.location.reload).toHaveBeenCalled();
    window.location = originalLocation;
  });

  it('navigates home when "Beranda" is clicked', () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { reload: jest.fn(), href: '' };
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByRole('button', { name: /Beranda/i }));
    expect(window.location.href).toBe('/');
    window.location = originalLocation;
  });
});
