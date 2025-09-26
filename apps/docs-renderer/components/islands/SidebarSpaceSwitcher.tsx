'use client';

import { useRouter } from 'next/navigation';

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

  return (
    <div className="dfy-space-switcher">
      <label htmlFor="dfy-space-select" className="sr-only">
        Select space
      </label>
      <select
        id="dfy-space-select"
        className="dfy-select"
        value={currentSpace}
        onChange={(event) => {
          const slug = event.target.value;
          const target = spaces.find((space) => space.slug === slug);
          if (!target) return;
          const entry = target.entry ?? `/${slug}`;
          router.push(`${hrefPrefix}${entry}`);
        }}
      >
        {spaces.map((space) => (
          <option key={space.slug} value={space.slug}>
            {space.name}
          </option>
        ))}
      </select>
    </div>
  );
}
