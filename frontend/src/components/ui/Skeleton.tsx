interface Props {
  className?: string;
  rows?: number;
}

export function Skeleton({ className = 'h-4 w-full', rows = 1 }: Props) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`animate-pulse bg-gray-800 rounded ${className}`} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-5 bg-gray-800 rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
