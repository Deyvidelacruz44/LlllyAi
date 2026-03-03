'use client';

import { Sparkles, MessageSquare, Minimize2, Volume2, VolumeX } from 'lucide-react';

interface ChatHeaderProps {
  chatsCount: number;
  showChatsList: boolean;
  onToggleChatsList: () => void;
  onMinimize: () => void;
  onClose: () => void;
  autoReadEnabled?: boolean;
  onToggleAutoRead?: () => void;
}

export default function ChatHeader({
  chatsCount,
  showChatsList,
  onToggleChatsList,
  onMinimize,
  onClose,
  autoReadEnabled = false,
  onToggleAutoRead,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-brand-orange dark:bg-brand-navy text-white">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 animate-pulse-soft" />
        </div>
        <div>
          <span className="font-semibold block text-sm">Lilly AI</span>
          <span className="text-[10px] text-white/70">Tu asistente personal</span>
        </div>
      </div>
      <div className="flex gap-1">
        {onToggleAutoRead && (
          <button
            onClick={onToggleAutoRead}
            className={`p-2 rounded-lg transition-colors ${autoReadEnabled ? 'bg-white/30' : 'hover:bg-white/20'}`}
            title={autoReadEnabled ? 'Desactivar lectura automática' : 'Activar lectura automática'}
          >
            {autoReadEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}
        {chatsCount > 0 && (
          <button
            onClick={onToggleChatsList}
            className={`p-2 rounded-lg transition-colors ${showChatsList ? 'bg-white/30' : 'hover:bg-white/20'}`}
            title="Ver conversaciones"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onMinimize}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          title="Minimizar"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          title="Cerrar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
