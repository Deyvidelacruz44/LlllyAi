'use client';

import { RefObject } from 'react';
import { Mic, Loader2, Volume2, PhoneOff, X } from 'lucide-react';
import type { Message, LiveVoiceState } from '@/types/chat';
import { renderContent } from './MessageList';

interface LiveVoiceOverlayProps {
  liveVoiceState: LiveVoiceState;
  liveVoiceTranscript: string;
  messages: Message[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onStop: () => void;
}

export default function LiveVoiceOverlay({
  liveVoiceState,
  liveVoiceTranscript,
  messages,
  messagesEndRef,
  onStop,
}: LiveVoiceOverlayProps) {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-brand-navy via-[#0a0938] to-brand-navy sm:rounded-2xl flex flex-col z-20 animate-fade-in">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden sm:rounded-2xl pointer-events-none">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-brand-blue/8 rounded-full animate-ping"
          style={{ animationDuration: '3s' }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 bg-brand-orange/8 rounded-full animate-ping"
          style={{ animationDuration: '2s' }}
        />
      </div>

      {/* Header */}
      <div
        className="relative z-10 flex items-center justify-between px-5 py-4"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white/60 text-xs font-medium uppercase tracking-widest">
            Conversación en vivo
          </span>
        </div>
        <button
          onClick={onStop}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          title="Cerrar"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>
      </div>

      {/* Recent messages */}
      <div
        className="relative z-10 flex-1 overflow-y-auto px-4 pb-2 space-y-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {messages.slice(-8).map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-white/15 text-white/90 rounded-br-md'
                  : 'bg-white/10 text-white/80 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">
                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
              </p>
            </div>
          </div>
        ))}
        {liveVoiceState === 'processing' && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-2xl rounded-bl-md px-3.5 py-2">
              <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice status area */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 px-6 py-5"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Status orb */}
        <div className="relative">
          <div
            className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-500 ${
              liveVoiceState === 'listening'
                ? 'bg-brand-blue/30 shadow-[0_0_60px_rgba(148,200,249,0.5)]'
                : liveVoiceState === 'processing'
                  ? 'bg-yellow-500/30 shadow-[0_0_60px_rgba(234,179,8,0.5)]'
                  : liveVoiceState === 'speaking'
                    ? 'bg-brand-orange/30 shadow-[0_0_60px_rgba(255,169,20,0.5)]'
                    : 'bg-gray-500/30'
            }`}
          >
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                liveVoiceState === 'listening'
                  ? 'bg-brand-blue animate-pulse'
                  : liveVoiceState === 'processing'
                    ? 'bg-yellow-500'
                    : liveVoiceState === 'speaking'
                      ? 'bg-brand-orange animate-pulse'
                      : 'bg-gray-500'
              }`}
            >
              {liveVoiceState === 'listening' && (
                <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              )}
              {liveVoiceState === 'processing' && (
                <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-spin" />
              )}
              {liveVoiceState === 'speaking' && (
                <Volume2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              )}
              {liveVoiceState === 'idle' && (
                <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              )}
            </div>
          </div>
          {liveVoiceState === 'listening' && (
            <div className="absolute inset-0 rounded-full border-2 border-brand-blue/50 animate-ping" />
          )}
        </div>

        {/* Status text and transcript */}
        <div className="text-center min-h-[56px]">
          <p className="text-white font-medium text-lg">
            {liveVoiceState === 'listening' && 'Te escucho...'}
            {liveVoiceState === 'processing' && 'Déjame pensar...'}
            {liveVoiceState === 'speaking' && 'Respondiendo...'}
            {liveVoiceState === 'idle' && 'Conectando...'}
          </p>
          {liveVoiceTranscript && (
            <p className="text-white/70 text-sm mt-1.5 max-w-[300px] leading-relaxed animate-fade-in">
              &ldquo;{liveVoiceTranscript}&rdquo;
            </p>
          )}
          {liveVoiceState === 'listening' && !liveVoiceTranscript && (
            <p className="text-white/40 text-xs mt-1.5">Habla con naturalidad</p>
          )}
        </div>

        {/* End call button */}
        <button
          onClick={onStop}
          className="bg-red-500 hover:bg-red-600 text-white px-10 py-3.5 rounded-full flex items-center gap-2.5 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all active:scale-95 text-base"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="font-semibold">Finalizar</span>
        </button>
      </div>
    </div>
  );
}
