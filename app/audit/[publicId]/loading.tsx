/**
 * Skeleton matching the processing screen's dimensions, so the transition into
 * it does not shift layout.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[480px] flex-col justify-center px-5 py-16">
      <div className="space-y-3 text-center">
        <div className="bg-surface-sunken mx-auto h-8 w-64 animate-pulse rounded" />
        <div className="bg-surface-sunken mx-auto h-4 w-80 animate-pulse rounded" />
      </div>
      <div className="mt-10 space-y-1">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-2.5">
            <div className="bg-surface-sunken size-4 animate-pulse rounded-full" />
            <div className="bg-surface-sunken h-4 w-40 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
