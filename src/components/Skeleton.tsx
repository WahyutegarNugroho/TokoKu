'use client';

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 bg-stone rounded animate-pulse ${className}`} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface rounded-lg border border-hairline p-5 space-y-3 animate-pulse ${className}`}>
      <div className="h-5 bg-stone rounded w-1/3" />
      <div className="h-4 bg-stone rounded w-2/3" />
      <div className="h-4 bg-stone rounded w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-hairline">
          <div className="h-4 bg-stone rounded w-1/4" />
          <div className="h-4 bg-stone rounded w-2/4" />
          <div className="h-4 bg-stone rounded w-1/6 ml-auto" />
        </div>
      ))}
    </div>
  );
}
