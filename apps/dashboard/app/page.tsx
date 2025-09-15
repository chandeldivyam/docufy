// apps/dashboard/app/page.tsx
'use client';

import { Authenticated, Unauthenticated } from 'convex/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SignInButton } from '@clerk/nextjs';

export default function Home() {
  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1>Docufy Dashboard</h1>
        <div className="flex gap-2">
          <Authenticated>
            <Link href="/dashboard" prefetch={false}>
              <Button>Dashboard</Button>
            </Link>
          </Authenticated>
          <Unauthenticated>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
          </Unauthenticated>
        </div>
      </div>
    </div>
  );
}
