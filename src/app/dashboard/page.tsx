'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/overview');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Redirigiendo al panel...</p>
    </div>
  );
}
