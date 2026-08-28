import { Skeleton, TutorCardSkeleton } from '@/components/ui/states';

/** Shown while the marketplace route renders. */
export default function TutorsLoading() {
  return (
    <div className="container-page py-8 lg:py-10">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <Skeleton className="mt-6 h-12 w-full" />
      <div className="mt-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <div className="hidden space-y-4 lg:block">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-20 w-full" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((card) => (
            <TutorCardSkeleton key={card} />
          ))}
        </div>
      </div>
    </div>
  );
}
