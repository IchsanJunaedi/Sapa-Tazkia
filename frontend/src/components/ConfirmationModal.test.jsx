// frontend/src/components/ConfirmationModal.test.jsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmationModal from './ConfirmationModal';

describe('ConfirmationModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Hapus Chat',
    message: 'Apakah Anda yakin ingin menghapus?',
  };

  beforeEach(() => jest.clearAllMocks());

  it('does not render when isOpen=false', () => {
    render(<ConfirmationModal {...baseProps} isOpen={false} />);
    expect(screen.queryByText('Hapus Chat')).not.toBeInTheDocument();
  });

  it('renders title and message', () => {
    render(<ConfirmationModal {...baseProps} />);
    expect(screen.getByText('Hapus Chat')).toBeInTheDocument();
    expect(screen.getByText('Apakah Anda yakin ingin menghapus?')).toBeInTheDocument();
  });

  it('uses default button labels', () => {
    render(<ConfirmationModal {...baseProps} />);
    expect(screen.getByText('Batal')).toBeInTheDocument();
    expect(screen.getByText('Hapus')).toBeInTheDocument();
  });

  it('uses custom button labels', () => {
    render(
      <ConfirmationModal
        {...baseProps}
        confirmText="Konfirmasi"
        cancelText="Tutup"
      />,
    );
    expect(screen.getByText('Konfirmasi')).toBeInTheDocument();
    expect(screen.getByText('Tutup')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    render(<ConfirmationModal {...baseProps} />);
    fireEvent.click(screen.getByText('Batal'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm clicked', () => {
    render(<ConfirmationModal {...baseProps} />);
    fireEvent.click(screen.getByText('Hapus'));
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when isDeleting=true', () => {
    render(<ConfirmationModal {...baseProps} isDeleting={true} />);
    expect(screen.getByText('Proses...')).toBeInTheDocument();
  });

  it('disables buttons when isDeleting=true', () => {
    render(<ConfirmationModal {...baseProps} isDeleting={true} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => expect(btn).toBeDisabled());
  });
});
