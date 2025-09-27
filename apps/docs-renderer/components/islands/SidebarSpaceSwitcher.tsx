'use client';

import { useRouter } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'; // Make sure this path is correct

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
        <SelectTrigger className="w-full border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-4 text-sm text-[var(--sidebar-fg)] outline-none ">
          <SelectValue placeholder="Select a space" />
        </SelectTrigger>
        <SelectContent className="border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)]">
          {spaces.map((space) => (
            <SelectItem
              key={space.slug}
              value={space.slug}
              className="cursor-pointer pl-4 focus:bg-[var(--primary)] focus:text-[var(--primary-fg)]"
            >
              {space.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
