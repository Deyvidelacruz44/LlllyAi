'use client';

import { ReactNode } from 'react';

type BadgeVariant = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' | 'orange';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-brand-blue/20 text-brand-navy border border-brand-blue/30',
  green: 'bg-green-100 text-green-700 border border-green-200',
  red: 'bg-red-100 text-red-700 border border-red-200',
  yellow: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  purple: 'bg-purple-100 text-purple-700 border border-purple-200',
  gray: 'bg-gray-100 text-gray-700 border border-gray-200',
  orange: 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30',
};

const dotColors: Record<BadgeVariant, string> = {
  blue: 'bg-brand-navy',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  gray: 'bg-gray-500',
  orange: 'bg-brand-orange',
};

export default function Badge({
  variant = 'gray',
  children,
  className = '',
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-200 gap-1.5 ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
