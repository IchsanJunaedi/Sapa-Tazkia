import React from 'react';

/**
 * Reusable skeleton loading components for premium data-fetching UX.
 * Use these in place of "Loading..." text to create a polished feel.
 */

// Base skeleton block with shimmer animation
const SkeletonBlock = ({ className = '', style }) => (
  <div
    className={`rounded-lg bg-[#27272a] relative overflow-hidden ${className}`}
    style={style}
  >
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[#3f3f46]/40 to-transparent" />
  </div>
);

// Card skeleton (for KPI cards, stat cards)
export const SkeletonCard = () => (
  <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
    <div className="h-[2px] w-full bg-[#27272a]" />
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-20" />
        <SkeletonBlock className="h-5 w-5 rounded-md" />
      </div>
      <SkeletonBlock className="h-8 w-24" />
      <SkeletonBlock className="h-3 w-16" />
    </div>
  </div>
);

// Table row skeleton
export const SkeletonTableRow = ({ cols = 4 }) => (
  <tr className="border-b border-[#27272a]/50">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-5 py-4">
        <SkeletonBlock className={`h-4 ${i === 0 ? 'w-32' : i === cols - 1 ? 'w-16' : 'w-20'}`} />
      </td>
    ))}
  </tr>
);

// Table skeleton (multiple rows)
export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
    <div className="px-5 py-4 border-b border-[#27272a]">
      <SkeletonBlock className="h-5 w-32" />
    </div>
    <table className="w-full">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} cols={cols} />
        ))}
      </tbody>
    </table>
  </div>
);

// Chat message skeleton
export const SkeletonChatMessage = ({ isUser = false }) => (
  <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
    {!isUser && <SkeletonBlock className="w-8 h-8 rounded-full flex-shrink-0" />}
    <div className={`max-w-[70%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <SkeletonBlock className="h-4 w-48" />
      <SkeletonBlock className="h-4 w-36" />
      <SkeletonBlock className="h-4 w-24" />
    </div>
  </div>
);

// Dashboard grid skeleton (6 KPI cards)
export const SkeletonDashboardGrid = () => (
  <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// Chart skeleton
export const SkeletonChart = ({ height = 'h-48' }) => (
  <div className={`bg-[#18181b] border border-[#27272a] rounded-xl p-5`}>
    <SkeletonBlock className="h-5 w-28 mb-4" />
    <div className={`${height} flex items-end gap-2 px-4`}>
      {Array.from({ length: 7 }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className="flex-1 rounded-t-md"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  </div>
);

// Full page skeleton
export const SkeletonPage = () => (
  <div className="min-h-screen bg-[#09090b] p-6 space-y-6">
    <div className="flex items-center justify-between">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-10 w-24 rounded-lg" />
    </div>
    <SkeletonDashboardGrid />
    <SkeletonChart />
    <SkeletonTable />
  </div>
);

export default SkeletonBlock;
