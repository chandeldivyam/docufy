import { ConvexClientProvider } from '@/components/ConvexClientProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/sonner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="bg-background flex h-screen overflow-hidden">
        <Sidebar />

        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">{children}</div>
          </main>
        </div>
        <Toaster position="bottom-right" />
      </div>
    </ConvexClientProvider>
  );
}
