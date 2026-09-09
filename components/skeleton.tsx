export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-xl ${className}`} />;
}

/** A skeleton shaped like a product/knowledge card (image + title + text lines). */
export function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
      <Skeleton className="w-full aspect-square mb-3" />
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-3" />
      <Skeleton className="h-3 w-full mb-1" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

/** A skeleton shaped like a table/list row (avatar + two text lines + trailing chip). */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}
