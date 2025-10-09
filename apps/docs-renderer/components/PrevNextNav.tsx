// apps/docs-renderer/components/PrevNextNav.tsx
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type NavLink = {
  title: string;
  route: string;
};

export function PrevNextNav({
  previous,
  next,
}: {
  previous?: NavLink | null;
  next?: NavLink | null;
}) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav className="dfy-prev-next-nav mt-12 flex flex-col gap-4 sm:flex-row">
      <div className="flex-1">
        {previous && (
          <Link
            href={previous.route}
            className="hover:bg-muted flex h-full w-full flex-col rounded-md border p-4 no-underline transition-colors"
          >
            <div className="mb-2 flex items-center gap-2 text-sm">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </div>
            <span className="font-medium">{previous.title}</span>
          </Link>
        )}
      </div>
      <div className="flex-1">
        {next && (
          <Link
            href={next.route}
            className="hover:bg-muted flex h-full w-full flex-col items-end rounded-md border p-4 text-right no-underline transition-colors"
          >
            <div className="mb-2 flex items-center gap-2 text-sm">
              Next
              <ChevronRight className="h-4 w-4" />
            </div>
            <span className="font-medium">{next.title}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
