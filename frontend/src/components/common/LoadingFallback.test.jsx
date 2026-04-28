// frontend/src/components/common/LoadingFallback.test.jsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import LoadingFallback from './LoadingFallback';

describe('LoadingFallback', () => {
  it('renders the loading indicator', () => {
    render(<LoadingFallback />);
    expect(screen.getByText('Memuat')).toBeInTheDocument();
  });
});
