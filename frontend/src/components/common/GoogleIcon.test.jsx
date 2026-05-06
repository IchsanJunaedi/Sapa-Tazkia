import React from 'react';
import { render } from '@testing-library/react';
import { GoogleIcon } from './GoogleIcon';

describe('GoogleIcon', () => {
  it('renders an svg', () => {
    const { container } = render(<GoogleIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('w-5');
  });

  it('contains four colored paths', () => {
    const { container } = render(<GoogleIcon />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(4);
  });
});
