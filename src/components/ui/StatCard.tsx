'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label?: string };
  className?: string;
  children?: ReactNode;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-brand-navy',
  iconBg = 'bg-brand-blue/20',
  trend,
  className = '',
  children,
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all duration-300 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p
              className={`text-xs mt-1 font-medium ${
                trend.value >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%{' '}
              {trend.label && <span className="text-gray-400">{trend.label}</span>}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
