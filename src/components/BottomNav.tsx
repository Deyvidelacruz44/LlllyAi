'use client';

import { LayoutDashboard, Calendar, CheckSquare, Wallet, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { hapticLight, hapticMedium } from '@/lib/haptics';

const items = [
  { name: 'Panel', href: '/dashboard/overview', icon: LayoutDashboard },
  { name: 'Calendario', href: '/dashboard/calendar', icon: Calendar },
  { name: 'Lilly', href: '#lilly', icon: Sparkles, center: true },
  { name: 'Tareas', href: '/dashboard/tasks', icon: CheckSquare },
  { name: 'Finanzas', href: '/dashboard/finances', icon: Wallet },
];

interface BottomNavProps {
  onOpenChat: () => void;
}

export default function BottomNav({ onOpenChat }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 dark:bg-surface/95 backdrop-blur-lg border-t border-gray-200 dark:border-border-custom safe-area-bottom"
      role="navigation"
      aria-label="Navegación principal móvil"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.href !== '#lilly' && pathname.startsWith(item.href);
          const isLilly = item.center;

          if (isLilly) {
            return (
              <button
                key={item.name}
                onClick={() => { hapticMedium(); onOpenChat(); }}
                className="relative -mt-5 flex flex-col items-center group"
                aria-label="Abrir asistente Lilly"
              >
                <div className="w-14 h-14 bg-brand-orange dark:bg-brand-orange rounded-2xl shadow-lg shadow-brand-orange/30 flex items-center justify-center transition-transform group-active:scale-90 group-hover:scale-105 animate-pulse-ring">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] font-medium text-brand-orange mt-0.5">{item.name}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => hapticLight()}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                isActive
                  ? 'text-brand-navy dark:text-brand-blue'
                  : 'text-gray-400 dark:text-text-tertiary hover:text-gray-600 dark:hover:text-text-secondary'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-brand-navy/10 dark:bg-brand-blue/10' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
