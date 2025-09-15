// apps/dashboard/app/(auth)/sign-in/page.tsx
'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignIn afterSignInUrl="/dashboard" />
    </div>
  );
}
