// frontend/src/components/common/Button.test.jsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies default variant and size classes', () => {
    render(<Button>btn</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-gray-200');
    expect(btn.className).toContain('px-4');
  });

  it('applies primary variant', () => {
    render(<Button variant="primary">p</Button>);
    expect(screen.getByRole('button').className).toContain('bg-blue-600');
  });

  it('applies secondary variant', () => {
    render(<Button variant="secondary">s</Button>);
    expect(screen.getByRole('button').className).toContain('border-blue-600');
  });

  it('applies size=lg', () => {
    render(<Button size="lg">l</Button>);
    expect(screen.getByRole('button').className).toContain('px-6');
  });

  it('applies size=sm', () => {
    render(<Button size="sm">s</Button>);
    expect(screen.getByRole('button').className).toContain('px-3');
  });

  it('merges custom className', () => {
    render(<Button className="custom-x">x</Button>);
    expect(screen.getByRole('button').className).toContain('custom-x');
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>go</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('passes through extra props (e.g. disabled)', () => {
    render(<Button disabled>d</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
