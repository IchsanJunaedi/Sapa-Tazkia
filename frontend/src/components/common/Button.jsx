import React from 'react';

// Component Button dasar dengan dukungan variant dan size untuk Tailwind
const Button = ({ children, onClick, className, variant = 'default', size = 'md', ...props }) => {
  const baseClasses = 'font-semibold transition-all duration-200 ease-in-out flex items-center justify-center rounded-lg';

  const variantClasses = {
    default: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md',
    secondary: 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50',
  };

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  // Logika penggabungan kelas
  const finalClasses = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      onClick={onClick}
      className={finalClasses}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
