'use client';

import { useAuth } from '@workos-inc/authkit-nextjs/components';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1>Docufy Dashboard</h1>
        <div className="flex gap-2">
          {user ? (
            <>
              <Link href="/dashboard">
                <Button>Dashboard</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in">
                <Button>Sign in</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
