'use client';

import { Phone, MessageSquare, Sparkles } from 'lucide-react';

interface ChatFABProps {
  speechSupported: boolean;
  synthSupported: boolean;
  onOpenChat: () => void;
  onOpenVoice: () => void;
}

export default function ChatFAB({
  speechSupported,
  synthSupported,
  onOpenChat,
  onOpenVoice,
}: ChatFABProps) {
  return (
    <div className="fixed bottom-20 right-6 z-50 hidden lg:flex items-end gap-3 animate-fade-in">
      {/* Quick voice button - one tap to talk */}
      {speechSupported && synthSupported && (
        <button
          onClick={onOpenVoice}
          className="bg-brand-orange text-white p-3.5 rounded-2xl shadow-xl shadow-brand-orange/25 hover:shadow-brand-orange/40 transition-all duration-300 hover:scale-110 active:scale-95 group"
          title="Hablar con IA"
        >
          <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      )}
      {/* Chat button */}
      <button
        onClick={onOpenChat}
        className="relative bg-brand-orange text-white p-4 rounded-2xl shadow-2xl shadow-brand-orange/30 hover:shadow-brand-orange/50 transition-all duration-300 hover:scale-110 group"
        title="Abrir Chat IA"
      >
        <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-bounce-soft">
          <Sparkles className="w-3 h-3" />
        </span>
        <span className="absolute inset-0 rounded-2xl bg-brand-orange animate-ping opacity-20"></span>
      </button>
    </div>
  );
}
