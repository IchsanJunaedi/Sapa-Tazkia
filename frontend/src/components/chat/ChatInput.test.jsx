import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from './ChatInput';

describe('ChatInput', () => {
  it('renders textarea and submit button', () => {
    render(<ChatInput onSend={jest.fn()} />);
    expect(screen.getByTestId('pertanyaan-input')).toBeInTheDocument();
    expect(screen.getByTestId('submit-tanya')).toBeInTheDocument();
  });

  it('disables submit when input is empty', () => {
    render(<ChatInput onSend={jest.fn()} />);
    expect(screen.getByTestId('submit-tanya')).toBeDisabled();
  });

  it('enables submit when input has trimmed text', () => {
    render(<ChatInput onSend={jest.fn()} />);
    fireEvent.change(screen.getByTestId('pertanyaan-input'), { target: { value: 'hi' } });
    expect(screen.getByTestId('submit-tanya')).not.toBeDisabled();
  });

  it('disables submit when input is whitespace only', () => {
    render(<ChatInput onSend={jest.fn()} />);
    fireEvent.change(screen.getByTestId('pertanyaan-input'), { target: { value: '   ' } });
    expect(screen.getByTestId('submit-tanya')).toBeDisabled();
  });

  it('disables submit when input exceeds max chars', () => {
    render(<ChatInput onSend={jest.fn()} />);
    const long = 'a'.repeat(251);
    fireEvent.change(screen.getByTestId('pertanyaan-input'), { target: { value: long } });
    expect(screen.getByTestId('submit-tanya')).toBeDisabled();
    expect(screen.getByText(/too long/i)).toBeInTheDocument();
  });

  it('disables submit when disabled prop is true', () => {
    render(<ChatInput onSend={jest.fn()} disabled />);
    fireEvent.change(screen.getByTestId('pertanyaan-input'), { target: { value: 'hi' } });
    expect(screen.getByTestId('submit-tanya')).toBeDisabled();
  });

  it('calls onSend with trimmed input on submit', () => {
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} />);
    fireEvent.change(screen.getByTestId('pertanyaan-input'), { target: { value: '  hello  ' } });
    fireEvent.click(screen.getByTestId('submit-tanya'));
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('clears input after submit', () => {
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByTestId('pertanyaan-input');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('submit-tanya'));
    expect(input.value).toBe('');
  });

  it('submits via Enter key (without shift)', () => {
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByTestId('pertanyaan-input');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('does not submit with Shift+Enter', () => {
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} />);
    const input = screen.getByTestId('pertanyaan-input');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});
