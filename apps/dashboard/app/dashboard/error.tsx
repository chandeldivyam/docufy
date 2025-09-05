'use client'; // Error boundaries must be Client Components

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({ error }: { error: Error & { digest?: string } }) {
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);

  const handleReturnToDashboard = async () => {
    setIsClearing(true);

    try {
      // Clear the active project cookie
      await fetch('/api/active-project', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to clear cookies:', error);
    } finally {
      // Navigate to dashboard regardless of cookie clearing success
      router.push('/dashboard');
      setIsClearing(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md space-y-4 text-center">
        <h2 className="text-destructive text-2xl font-bold">Something went wrong!</h2>
        <p className="text-muted-foreground">
          An unexpected error occurred. We'll clear your session and return you to the dashboard.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="bg-muted mt-4 rounded-lg p-4 text-left">
            <summary className="text-foreground cursor-pointer font-medium">
              Error Details (Development)
            </summary>
            <pre className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">
              {error.message}
            </pre>
          </details>
        )}

        <button
          onClick={handleReturnToDashboard}
          disabled={isClearing}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isClearing ? 'Cleaning...' : 'Go to Home'}
        </button>
      </div>
    </div>
  );
}
