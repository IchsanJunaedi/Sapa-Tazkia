import React from 'react';
import { render } from '@testing-library/react';
import SkeletonBlock, {
  SkeletonCard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonChatMessage,
  SkeletonDashboardGrid,
  SkeletonChart,
  SkeletonPage,
} from './SkeletonLoader';

describe('SkeletonLoader exports', () => {
  it('SkeletonBlock renders a div with shimmer', () => {
    const { container } = render(<SkeletonBlock className="h-4 w-20" />);
    expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(2);
  });

  it('SkeletonCard renders structure', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('SkeletonTableRow renders cols', () => {
    const { container } = render(
      <table><tbody><SkeletonTableRow cols={3} /></tbody></table>
    );
    expect(container.querySelectorAll('td').length).toBe(3);
  });

  it('SkeletonTable renders rows', () => {
    const { container } = render(<SkeletonTable rows={2} cols={2} />);
    expect(container.querySelectorAll('tr').length).toBe(2);
  });

  it('SkeletonChatMessage renders both user and assistant variants', () => {
    const { container: a } = render(<SkeletonChatMessage isUser={false} />);
    const { container: b } = render(<SkeletonChatMessage isUser />);
    expect(a.firstChild).toBeInTheDocument();
    expect(b.firstChild).toBeInTheDocument();
  });

  it('SkeletonDashboardGrid renders 6 cards', () => {
    const { container } = render(<SkeletonDashboardGrid />);
    // 6 SkeletonCard, each is one div child of grid
    expect(container.firstChild.children.length).toBe(6);
  });

  it('SkeletonChart renders bars', () => {
    const { container } = render(<SkeletonChart />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('SkeletonPage renders full page', () => {
    const { container } = render(<SkeletonPage />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
