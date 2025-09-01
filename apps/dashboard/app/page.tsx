'use client';

import { Authenticated, Unauthenticated } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import Link from 'next/link';

export default function Home() {
  const { user, signOut } = useAuth();

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1>Docufy Dashboard</h1>
        <div className="flex gap-2">
          {user ? (
            <button onClick={() => signOut()}>Sign out</button>
          ) : (
            <>
              <Link href="/sign-in">
                <button>Sign in</button>
              </Link>
              <Link href="/sign-up">
                <button>Sign up</button>
              </Link>
            </>
          )}
        </div>
      </div>
      <Authenticated>
        <p>Welcome {user?.email}</p>
      </Authenticated>
      <Unauthenticated>
        <p>Please sign in to view data</p>
      </Unauthenticated>
    </div>
  );
}
