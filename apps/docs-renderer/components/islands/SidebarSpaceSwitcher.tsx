'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SpaceOption = {
  slug: string;
  name: string;
  entry?: string;
};

export default function SidebarSpaceSwitcher({
  spaces,
  currentSpace,
  hrefPrefix = '',
}: {
  spaces: SpaceOption[];
  currentSpace: string;
  hrefPrefix?: string;
}) {
  const router = useRouter();

  if (spaces.length <= 1) return null;

  const handleValueChange = (slug: string) => {
    const target = spaces.find((space) => space.slug === slug);
    if (!target) return;
    const entry = target.entry ?? `/${slug}`;
    router.push(`${hrefPrefix}${entry}`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={currentSpace} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full touch-manipulation border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-4 text-sm text-[var(--sidebar-fg)] outline-none">
          <SelectValue placeholder="Select a space" />
        </SelectTrigger>
        <SelectContent
          className="z-[9999] border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)]"
          position="popper"
          sideOffset={4}
          // Force portal to body for better mobile support
        >
          {spaces.map((space) => (
            <SelectItem
              key={space.slug}
              value={space.slug}
              className="cursor-pointer touch-manipulation pl-4 focus:bg-[var(--primary)] focus:text-[var(--primary-fg)]"
            >
              {space.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* CSS to ensure proper mobile behavior */}
      <style jsx>{`
        /* Ensure touch targets are large enough for mobile */
        :global([data-radix-select-trigger]) {
          min-height: 44px;
        }

        /* Improve z-index stacking */
        :global([data-radix-select-content]) {
          z-index: 9999 !important;
        }

        /* Better mobile touch handling */
        :global([data-radix-select-item]) {
          min-height: 44px;
          touch-action: manipulation;
        }
      `}</style>
    </div>
  );
}
