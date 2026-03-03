'use client';

import { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  /** Variant: "pills" renders as rounded pills, "underline" renders with border-bottom */
  variant?: 'pills' | 'underline';
}

export default function TabNav({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  variant = 'pills',
}: TabNavProps) {
  if (variant === 'underline') {
    return (
      <div className={`flex border-b border-gray-200 ${className}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200
              ${
                activeTab === tab.id
                  ? 'border-brand-navy text-brand-navy'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-brand-navy/10 text-brand-navy'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Pills variant (default)
  return (
    <div className={`flex gap-1 bg-gray-100 p-1 rounded-xl ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
            ${
              activeTab === tab.id
                ? 'bg-white text-brand-navy shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? 'bg-brand-navy/10 text-brand-navy'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
