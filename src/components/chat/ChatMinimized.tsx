'use client';

import { Sparkles, Maximize2 } from 'lucide-react';

interface ChatMinimizedProps {
  onMaximize: () => void;
  onClose: () => void;
}

export default function ChatMinimized({ onMaximize, onClose }: ChatMinimizedProps) {
  return (
    <div className="fixed bottom-20 right-6 bg-white dark:bg-surface rounded-2xl shadow-2xl z-50 border border-gray-100 dark:border-border-custom animate-scale-in overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-brand-orange dark:bg-brand-navy text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 animate-pulse-soft" />
          <span className="font-semibold">Asistente IA</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onMaximize}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
