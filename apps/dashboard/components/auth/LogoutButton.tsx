'use client';

import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';

export function LogoutButton() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <Button variant="ghost" size="sm" onClick={() => signOut()}>
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  );
}
