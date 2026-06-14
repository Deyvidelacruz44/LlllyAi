'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Send, Sparkles, Check, Loader2 } from 'lucide-react';
import { parseTransaction, type ParsedTransaction } from '@/lib/parseTransaction';
import { CATEGORY_LABELS } from '@/app/dashboard/finances/constants';

interface QuickTransactionBarProps {
  onSubmit: (parsed: ParsedTransaction) => Promise<void>;
}

export default function QuickTransactionBar({ onSubmit }: QuickTransactionBarProps) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setVoiceSupported(Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.abort?.();
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const flash = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 4000);
  };

  const submit = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const parsed = parseTransaction(value);
    if (!parsed.confident) {
      flash(false, "No detecté el monto. Ej: “gasté 500 en comida”");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(parsed);
      setText('');
      const sign = parsed.type === 'income' ? '+' : '-';
      flash(true, `${parsed.type === 'income' ? 'Ingreso' : 'Gasto'} ${sign}$${parsed.amount?.toLocaleString()} · ${CATEGORY_LABELS[parsed.category]} (${parsed.description})`);
    } catch {
      flash(false, 'No se pudo registrar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const startListening = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { flash(false, 'Tu navegador no soporta voz'); return; }

    recognitionRef.current?.abort?.();
    const rec = new Recognition();
    recognitionRef.current = rec;
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = true;

    let lastText = '';
    rec.onresult = (e: any) => {
      if (recognitionRef.current !== rec) return;
      // Take only the last result (Android emits cumulative snapshots)
      const last = e.results[e.results.length - 1];
      lastText = (last?.[0]?.transcript || '').trim();
      setText(lastText);
    };
    rec.onerror = () => { if (recognitionRef.current === rec) setListening(false); };
    rec.onend = () => {
      if (recognitionRef.current !== rec) return;
      setListening(false);
      if (lastText.trim()) submit(lastText.trim());
    };

    setListening(true);
    setFeedback(null);
    try { rec.start(); } catch { setListening(false); }
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop?.(); } catch { /* ignore */ }
    setListening(false);
  };

  return (
    <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-custom rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
        <span className="text-xs font-medium text-gray-700 dark:text-text-secondary">Registro rápido</span>
        <span className="text-[10px] text-gray-400 dark:text-text-tertiary ml-auto">Escribe o dicta: &ldquo;gasté 500 en comida&rdquo;</span>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(text); }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? 'Escuchando…' : 'Ej: gasté 500 en comida'}
          disabled={busy}
          className="flex-1 px-3 py-2.5 border border-gray-200 dark:border-border-custom rounded-xl text-sm bg-gray-50 dark:bg-surface-secondary focus:ring-2 focus:ring-brand-orange/40 focus:border-brand-orange focus:bg-white dark:focus:bg-surface outline-none transition-all"
        />

        {voiceSupported && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            title={listening ? 'Detener' : 'Dictar por voz'}
            className={`shrink-0 p-2.5 rounded-xl transition-all ${
              listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-brand-navy/10 dark:bg-brand-blue/10 text-brand-navy dark:text-brand-blue hover:bg-brand-navy/20'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>
        )}

        <button
          type="submit"
          disabled={busy || !text.trim()}
          title="Registrar"
          className="shrink-0 p-2.5 rounded-xl bg-brand-orange text-white hover:bg-brand-orange/90 disabled:opacity-40 transition-all"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>

      {feedback && (
        <div className={`mt-2 flex items-center gap-1.5 text-xs ${feedback.ok ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {feedback.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Sparkles className="w-3.5 h-3.5 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}
    </div>
  );
}
