'use client';

import { RefObject } from 'react';
import { Loader2, Sparkles, CheckCircle, Calendar, ListTodo } from 'lucide-react';
import { format } from 'date-fns';
import type { Message } from '@/types/chat';

// Simple markdown: renders **bold** text
export function renderContent(content: string) {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  currentChatId: string | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onSendSuggestion: (text: string) => void;
}

export default function MessageList({
  messages,
  loading,
  currentChatId,
  messagesEndRef,
  onSendSuggestion,
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/50 to-white dark:from-background dark:to-surface overscroll-y-contain">
      {messages.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-12 animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 bg-brand-navy/10 dark:bg-brand-blue/10 rounded-2xl flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-brand-navy dark:text-brand-blue" />
          </div>
          <p className="font-medium text-gray-700 dark:text-foreground mb-1">¡Hola! Soy tu asistente IA</p>
          <p className="text-sm text-gray-400 dark:text-text-tertiary max-w-[200px] mx-auto">
            Pregúntame sobre tu agenda o pídeme crear eventos y tareas
          </p>

          {/* Quick suggestions */}
          <div className="mt-6 space-y-2">
            <p className="text-xs text-gray-400 mb-2">Prueba diciendo:</p>
            {[
              '¿Qué tengo para hoy?',
              'Crea una reunión mañana a las 3pm',
              'Agregar tarea: Comprar víveres',
              'Recuerda que prefiero reuniones en la mañana',
            ].map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSendSuggestion(suggestion)}
                disabled={!currentChatId || loading}
                className="block w-full text-left text-xs px-3 py-2.5 sm:py-2 bg-white dark:bg-surface rounded-xl sm:rounded-lg border border-gray-200 dark:border-border-custom text-gray-600 dark:text-text-secondary hover:border-brand-blue hover:bg-brand-blue/10 dark:hover:bg-brand-blue/5 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                &ldquo;{suggestion}&rdquo;
              </button>
            ))}
          </div>
        </div>
      ) : (
        messages.map((msg, index) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-brand-navy text-white rounded-br-md'
                  : 'bg-white dark:bg-surface border border-gray-100 dark:border-border-custom text-gray-800 dark:text-foreground shadow-sm rounded-bl-md'
              }`}
            >
              {msg.actionExecuted && (
                <div
                  className={`flex items-center gap-1.5 text-xs mb-1.5 ${msg.role === 'user' ? 'text-white/80' : 'text-green-600'}`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {msg.actionType === 'event' && <Calendar className="w-3 h-3" />}
                  {msg.actionType === 'task' && <ListTodo className="w-3 h-3" />}
                  <span>{msg.actionType === 'event' ? 'Evento creado' : 'Tarea creada'}</span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
              </p>
              <p
                className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}
              >
                {format(msg.timestamp, 'HH:mm')}
              </p>
            </div>
          </div>
        ))
      )}
      {loading && (
        <div className="flex justify-start animate-fade-in">
          <div className="bg-white dark:bg-surface border border-gray-100 dark:border-border-custom rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-brand-navy dark:bg-brand-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-brand-navy dark:bg-brand-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-brand-navy dark:bg-brand-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-gray-500 dark:text-text-secondary">Lilly está pensando...</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
