'use client';

import { RefObject } from 'react';
import { Send, Mic, Phone, X, MicOff } from 'lucide-react';

interface ChatInputProps {
  // Text input
  input: string;
  loading: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;

  // Voice note
  voiceNoteMode: boolean;
  voiceNoteEditing: boolean;
  voiceNoteTranscript: string;
  voiceNoteDuration: number;
  voiceNoteError: string;
  voiceNoteInputRef: RefObject<HTMLInputElement | null>;
  onVoiceNoteTranscriptChange: (value: string) => void;
  onStartVoiceNote: () => void;
  onCancelVoiceNote: () => void;
  onSendVoiceNote: () => void;
  onEditVoiceNote: () => void;
  formatVoiceDuration: (seconds: number) => string;

  // Live voice
  speechSupported: boolean;
  synthSupported: boolean;
  onStartLiveVoice: () => void;
}

export default function ChatInput({
  input,
  loading,
  textareaRef,
  onInputChange,
  onSend,
  voiceNoteMode,
  voiceNoteEditing,
  voiceNoteTranscript,
  voiceNoteDuration,
  voiceNoteError,
  voiceNoteInputRef,
  onVoiceNoteTranscriptChange,
  onStartVoiceNote,
  onCancelVoiceNote,
  onSendVoiceNote,
  onEditVoiceNote,
  formatVoiceDuration,
  speechSupported,
  synthSupported,
  onStartLiveVoice,
}: ChatInputProps) {
  return (
    <div className="p-3 border-t border-gray-100 dark:border-border-custom bg-white dark:bg-surface">
      {voiceNoteMode ? (
        <div className="px-3 py-2">
          {voiceNoteEditing ? (
            <>
              {voiceNoteError && (
                <p className="text-xs text-red-500 font-medium mb-2 flex items-center gap-1">
                  <MicOff className="w-3.5 h-3.5" />
                  {voiceNoteError}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancelVoiceNote}
                  className="p-2.5 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-xl transition-all active:scale-95 shrink-0"
                  title="Cancelar"
                >
                  <X className="w-5 h-5" />
                </button>
                <input
                  ref={voiceNoteInputRef}
                  type="text"
                  value={voiceNoteTranscript}
                  onChange={(e) => onVoiceNoteTranscriptChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSendVoiceNote();
                    }
                  }}
                  placeholder="Escribe tu mensaje aquí..."
                  autoFocus
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue focus:bg-white transition-all placeholder:text-gray-400 min-w-0"
                />
                <button
                  type="button"
                  onClick={onSendVoiceNote}
                  disabled={!voiceNoteTranscript.trim()}
                  className="bg-brand-navy text-white p-2.5 rounded-xl hover:shadow-lg hover:shadow-brand-navy/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
                  title="Enviar mensaje"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancelVoiceNote}
                className="p-2.5 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-xl transition-all active:scale-95 shrink-0"
                title="Cancelar"
              >
                <X className="w-5 h-5" />
              </button>
              <div
                onClick={onEditVoiceNote}
                className="flex-1 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 min-w-0 cursor-text"
                title="Toca para editar el texto"
              >
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                <span className="text-sm font-mono text-red-600 font-medium shrink-0">
                  {formatVoiceDuration(voiceNoteDuration)}
                </span>
                <span className="text-xs text-gray-600 truncate">
                  {voiceNoteTranscript || 'Escuchando... (toca para escribir)'}
                </span>
              </div>
              <button
                type="button"
                onClick={onSendVoiceNote}
                disabled={!voiceNoteTranscript.trim()}
                className="bg-brand-navy text-white p-2.5 rounded-xl hover:shadow-lg hover:shadow-brand-navy/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
                title="Enviar mensaje"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value);
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Escribe tu mensaje..."
            rows={1}
            className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-surface-secondary border border-gray-200 dark:border-border-custom rounded-xl focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue focus:bg-white dark:focus:bg-surface text-sm text-foreground transition-all placeholder:text-gray-400 dark:placeholder:text-text-tertiary resize-none max-h-[120px] overflow-y-auto"
            disabled={loading}
          />
          {speechSupported && (
            <>
              <button
                type="button"
                onClick={onStartVoiceNote}
                className="p-2.5 rounded-xl transition-all active:scale-95 bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500 shrink-0"
                disabled={loading}
                title="Nota de voz"
              >
                <Mic className="w-5 h-5" />
              </button>
              {synthSupported && (
                <button
                  type="button"
                  onClick={onStartLiveVoice}
                  className="p-2.5 rounded-xl transition-all active:scale-95 bg-brand-navy text-white hover:shadow-lg hover:shadow-brand-navy/25 shrink-0"
                  disabled={loading}
                  title="Conversar en vivo"
                >
                  <Phone className="w-5 h-5" />
                </button>
              )}
            </>
          )}
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-brand-navy text-white p-2.5 rounded-xl hover:shadow-lg hover:shadow-brand-navy/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      )}
    </div>
  );
}
