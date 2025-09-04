import { ConvexClientProvider } from '@/components/ConvexClientProvider';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="bg-background flex h-screen overflow-hidden">
        <Sidebar />

        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <div className="container mr-auto p-6">{children}</div>
          </main>
        </div>
      </div>
    </ConvexClientProvider>
  );
}
