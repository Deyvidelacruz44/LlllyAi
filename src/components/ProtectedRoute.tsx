'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar skeleton */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg hidden lg:block">
        <div className="p-4 border-b">
          <div className="skeleton h-8 w-32"></div>
        </div>
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-full"></div>
            <div className="flex-1">
              <div className="skeleton h-4 w-24 mb-2"></div>
              <div className="skeleton h-3 w-32"></div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-10 w-full rounded-lg"></div>
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="lg:pl-64">
        {/* Top bar skeleton */}
        <div className="sticky top-0 z-10 bg-white shadow-sm">
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="skeleton h-6 w-6 rounded lg:hidden"></div>
            <div className="skeleton h-6 w-32"></div>
          </div>
        </div>

        {/* Content skeleton */}
        <div className="p-4 lg:p-6 space-y-6">
          {/* Header card skeleton */}
          <div className="skeleton h-32 w-full rounded-xl"></div>
          
          {/* Stats grid skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-24 rounded-lg"></div>
            ))}
          </div>

          {/* Two column skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="skeleton h-64 rounded-xl"></div>
            <div className="skeleton h-64 rounded-xl"></div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-navy rounded-2xl mb-4 shadow-lg shadow-brand-navy/30 animate-pulse-soft">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 font-medium">Cargando tu agenda...</p>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
