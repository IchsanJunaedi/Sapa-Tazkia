import React from 'react';

const GradientText = ({ children, className = '' }) => {
  return (
    <span className={`bg-gradient-to-r from-primary-500 via-red-400 to-secondary-500 text-transparent bg-clip-text font-bold ${className}`}>
      {children}
    </span>
  );
};

export default GradientText;