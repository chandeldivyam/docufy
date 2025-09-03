export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* Server-rendered sidebar with static navigation */}
      <>Sidebar</>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Server-rendered header */}
        <>Header</>

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
