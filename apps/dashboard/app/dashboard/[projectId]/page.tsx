'use client';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function DashboardProjectPage() {
  const user = useQuery(api.users.getCurrentUser);
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      Welcome back, {user?.firstName} {user?.lastName}
    </div>
  );
}
