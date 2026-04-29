import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarketingLandingPage from './MarketingLandingPage';

// Mock IntersectionObserver
beforeAll(() => {
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  }));
});

// Full mock for framer-motion to prevent AggregateErrors from React 18 / rendering issues
jest.mock('framer-motion', () => {
  const React = require('react');
  const dummyComponent = React.forwardRef((props, ref) => {
    const { children, ...rest } = props;
    // Filter out motion-specific props
    const filteredProps = Object.keys(rest).reduce((acc, key) => {
      if (!['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileInView', 'viewport'].includes(key)) {
        acc[key] = rest[key];
      }
      return acc;
    }, {});
    
    // We just render a generic div for any motion.* element
    return <div ref={ref} {...filteredProps}>{children}</div>;
  });
  
  return {
    motion: {
      div: dummyComponent,
      span: dummyComponent,
      h1: dummyComponent,
      h2: dummyComponent,
      h3: dummyComponent,
      p: dummyComponent,
      a: dummyComponent,
      button: dummyComponent,
      section: dummyComponent,
      main: dummyComponent,
      img: dummyComponent,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
    useScroll: () => ({ scrollYProgress: { onChange: () => {} } }),
    useTransform: () => ({}),
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
  };
});

// Mock AuthContext
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    logout: jest.fn(),
  }),
}));

// Mock ResizeObserver
class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.ResizeObserver = ResizeObserver;

describe('MarketingLandingPage', () => {
  it('renders correctly without crashing', () => {
    render(
      <MemoryRouter>
        <MarketingLandingPage />
      </MemoryRouter>
    );
    // Verify one of the main headings is rendered
    expect(screen.getByText(/Tanya Nilai, Jadwal,/i)).toBeInTheDocument();
  });
});
