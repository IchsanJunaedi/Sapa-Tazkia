import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../api/axiosConfig', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from '../../api/axiosConfig';
import SuggestedPromptCards from './SuggestedPromptCards';

describe('SuggestedPromptCards', () => {
  beforeEach(() => {
    api.get.mockReset();
    mockNavigate.mockReset();
  });

  it('renders nothing when prompt list is empty', async () => {
    api.get.mockResolvedValue({ data: { data: [] } });
    const { container } = render(<MemoryRouter><SuggestedPromptCards /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('renders prompt buttons after fetch', async () => {
    api.get.mockResolvedValue({
      data: { data: [{ id: 1, text: 'How do I login?' }, { id: 2, text: 'Show grades' }] },
    });
    render(<MemoryRouter><SuggestedPromptCards /></MemoryRouter>);
    await screen.findByText('How do I login?');
    expect(screen.getByText('Show grades')).toBeInTheDocument();
  });

  it('navigates with prompt state when card clicked', async () => {
    api.get.mockResolvedValue({
      data: { data: [{ id: 1, text: 'Hello' }] },
    });
    render(<MemoryRouter><SuggestedPromptCards /></MemoryRouter>);
    await screen.findByText('Hello');
    fireEvent.click(screen.getByText('Hello'));
    expect(mockNavigate).toHaveBeenCalledWith('/chat', { state: { prompt: 'Hello' } });
  });

  it('handles api errors silently', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    const { container } = render(<MemoryRouter><SuggestedPromptCards /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });
});
