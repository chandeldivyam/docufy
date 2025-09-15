'use client';
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache/provider';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { Authenticated, Unauthenticated } from 'convex/react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexQueryCacheProvider>
      {/* already under root provider now */}
      <div className="bg-background flex h-screen overflow-hidden">
        <Authenticated>
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              <div className="container mr-auto h-full p-6">{children}</div>
            </main>
          </div>
          <Toaster position="bottom-right" />
        </Authenticated>
        <Unauthenticated>
          <div className="flex h-full items-center justify-center">Authenticating...</div>
        </Unauthenticated>
      </div>
    </ConvexQueryCacheProvider>
  );
}
