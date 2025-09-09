'use client';

import { useState } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoutButtonProps {
  variant?: 'default' | 'icon';
  className?: string;
}

export function LogoutButton({ variant = 'default', className }: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
        disabled={isLoading}
        className={cn('h-8 w-8', className)}
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
        <span className="sr-only">Sign out</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={isLoading}
      className={cn('gap-2', className)}
    >
      <LogOut className="h-4 w-4" />
      <span>Sign out</span>
    </Button>
  );
}
