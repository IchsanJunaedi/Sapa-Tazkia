import React from 'react';

// Component untuk membuat teks memiliki warna gradien
const GradientText = ({ children, className = '' }) => {
  return (
    <span 
      className={`bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600 ${className}`}
      // Properti style untuk memastikan gradien bekerja pada teks
      style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
    >
      {children}
    </span>
  );
};

export default GradientText;
