'use client';

import { Trash2 } from 'lucide-react';
import type { Chat } from '@/types/chat';

interface ChatListProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

export default function ChatList({
  chats,
  currentChatId,
  onSelectChat,
  onCreateChat,
  onDeleteChat,
}: ChatListProps) {
  return (
    <div className="border-b border-gray-100 dark:border-border-custom bg-gray-50/80 dark:bg-surface-secondary/80 backdrop-blur p-3 max-h-48 overflow-y-auto animate-fade-in-down">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Conversaciones
        </span>
        <button
          onClick={onCreateChat}
          className="text-xs bg-brand-navy text-white px-3 py-1.5 rounded-lg hover:shadow-md transition-all active:scale-95"
        >
          + Nueva
        </button>
      </div>
      <div className="space-y-1">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
              currentChatId === chat.id
                ? 'bg-brand-navy/10 dark:bg-brand-blue/10 border border-brand-blue/30'
                : 'hover:bg-white dark:hover:bg-surface hover:shadow-sm border border-transparent'
            }`}
            onClick={() => onSelectChat(chat.id)}
          >
            <span className="text-sm truncate flex-1 text-gray-700 dark:text-foreground">{chat.title}</span>
            {chats.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg transition-colors ml-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
