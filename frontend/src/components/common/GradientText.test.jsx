// frontend/src/components/common/GradientText.test.jsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import GradientText from './GradientText';

describe('GradientText', () => {
  it('renders children', () => {
    render(<GradientText>Hello</GradientText>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies gradient classes', () => {
    render(<GradientText>X</GradientText>);
    const span = screen.getByText('X');
    expect(span.className).toContain('bg-clip-text');
    expect(span.className).toContain('from-orange-500');
  });

  it('merges custom className', () => {
    render(<GradientText className="text-2xl">X</GradientText>);
    expect(screen.getByText('X').className).toContain('text-2xl');
  });
});
