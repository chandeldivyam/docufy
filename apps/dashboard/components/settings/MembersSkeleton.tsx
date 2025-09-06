import { Skeleton } from '@/components/ui/skeleton';

export function MemberItemSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

export function MembersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <MemberItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function InviteItemSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-4 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}
