'use client';

interface SkeletonProps {
  /** Width class e.g. "w-full", "w-32" */
  width?: string;
  /** Height class e.g. "h-4", "h-8" */
  height?: string;
  /** Whether it's a circle (avatar) skeleton */
  circle?: boolean;
  /** Number of lines to render */
  lines?: number;
  className?: string;
}

export default function Skeleton({
  width = 'w-full',
  height = 'h-4',
  circle = false,
  lines = 1,
  className = '',
}: SkeletonProps) {
  if (circle) {
    return (
      <div
        className={`rounded-full bg-gray-200 animate-pulse ${width} ${height} ${className}`}
      />
    );
  }

  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`rounded-lg bg-gray-200 animate-pulse ${height} ${
              i === lines - 1 ? 'w-3/4' : width
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg bg-gray-200 animate-pulse ${width} ${height} ${className}`}
    />
  );
}

/** A pre-built skeleton that mimics a StatCard */
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton width="w-20" height="h-3" />
          <Skeleton width="w-16" height="h-7" />
        </div>
        <Skeleton width="w-10" height="h-10" className="rounded-xl" />
      </div>
    </div>
  );
}

/** A pre-built skeleton that mimics a list item */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton circle width="w-8" height="h-8" />
      <div className="flex-1 space-y-1.5">
        <Skeleton width="w-3/4" height="h-4" />
        <Skeleton width="w-1/2" height="h-3" />
      </div>
    </div>
  );
}
