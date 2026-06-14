'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, limit, Timestamp, getDoc, setDoc, increment,
} from 'firebase/firestore';
import {
  addDays, startOfDay, nextMonday, nextTuesday, nextWednesday,
  nextThursday, nextFriday, nextSaturday, nextSunday,
} from 'date-fns';
import type { Message, Chat, AIAction } from '@/types/chat';
import { buildSmartContext, contextToPromptString, generateSmartGreeting } from '@/lib/contextBuilder';
import { useUserProfileStore } from '@/stores/userProfileStore';
import { useIntegrationsStore } from '@/stores/integrationsStore';
import {
  ChatFAB,
  ChatMinimized,
  ChatHeader,
  ChatList,
  MessageList,
  ChatInput,
  LiveVoiceOverlay,
} from './chat';

export default function FloatingChat() {
  const { user } = useAuth();
  const { profile: userProfileState, load: loadProfile, updateVoiceSettings, updateName, addNote } = useUserProfileStore();
  const { integrations: userIntegrations, load: loadIntegrations } = useIntegrationsStore();

  // ── Core UI state ──────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [showChatsList, setShowChatsList] = useState(false);
  const [autoReadEnabled, setAutoReadEnabled] = useState(false);
  const [greetingShown, setGreetingShown] = useState<string | null>(null);

  // ── Voice note state ───────────────────────────────────────────
  const [voiceNoteMode, setVoiceNoteMode] = useState(false);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState(0);
  const [voiceNoteTranscript, setVoiceNoteTranscript] = useState('');
  const [voiceNoteEditing, setVoiceNoteEditing] = useState(false);
  const [voiceNoteError, setVoiceNoteError] = useState('');
  const voiceNoteInputRef = useRef<HTMLInputElement>(null);

  // ── Live voice state ───────────────────────────────────────────
  const [liveVoiceMode, setLiveVoiceMode] = useState(false);
  const [liveVoiceState, setLiveVoiceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [liveVoiceTranscript, setLiveVoiceTranscript] = useState('');
  const [synthSupported, setSynthSupported] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputBaseRef = useRef('');
  const voiceNoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceNoteRecognitionRef = useRef<any>(null);
  const voiceNoteActiveRef = useRef(false);
  const liveVoiceRecognitionRef = useRef<any>(null);
  const liveVoiceModeRef = useRef(false);
  const sendMessageTextFnRef = useRef<(text: string) => Promise<string | null>>(async () => null);
  const handleLiveVoiceMessageFnRef = useRef<(text: string) => Promise<void>>(async () => {});
  const startLiveListeningFnRef = useRef<() => void>(() => {});
  const wakeLockRef = useRef<any>(null);
  const spanishVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const autoStartVoiceRef = useRef(false);

  // ═══════════════════════════════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (user && isOpen) loadChats();
  }, [user, isOpen]);

  // Load user profile and sync autoRead setting
  useEffect(() => {
    if (user) {
      loadProfile(user.uid);
      loadIntegrations(user.uid);
    }
  }, [user, loadProfile, loadIntegrations]);

  useEffect(() => {
    if (userProfileState?.voiceSettings) {
      setAutoReadEnabled(userProfileState.voiceSettings.autoRead);
    }
  }, [userProfileState?.voiceSettings]);

  useEffect(() => {
    if (currentChatId && isOpen) loadMessages(currentChatId);
  }, [currentChatId, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSpeechSupported(Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    setSynthSupported(Boolean(window.speechSynthesis));
  }, []);

  // Cache the best available Spanish voice for TTS
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const findSpanishVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const preferred = [
        voices.find(v => v.lang.startsWith('es') && v.name.toLowerCase().includes('female')),
        voices.find(v => v.lang === 'es-MX'),
        voices.find(v => v.lang === 'es-ES'),
        voices.find(v => v.lang === 'es-US'),
        voices.find(v => v.lang.startsWith('es')),
      ];
      spanishVoiceRef.current = preferred.find(Boolean) || null;
    };
    findSpanishVoice();
    window.speechSynthesis.addEventListener('voiceschanged', findSpanishVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', findSpanishVoice);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      voiceNoteRecognitionRef.current?.abort?.();
      liveVoiceRecognitionRef.current?.abort?.();
      if (voiceNoteTimerRef.current) clearInterval(voiceNoteTimerRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      wakeLockRef.current?.release?.().catch(() => {});
    };
  }, []);

  // Listen for bottom-nav open event
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('open-lilly-chat', handler);
    return () => window.removeEventListener('open-lilly-chat', handler);
  }, []);

  // Auto-start live voice when chat is ready (triggered from FAB quick button)
  useEffect(() => {
    if (currentChatId && isOpen && autoStartVoiceRef.current) {
      autoStartVoiceRef.current = false;
      const timer = setTimeout(() => {
        setLiveVoiceMode(true);
        liveVoiceModeRef.current = true;
        setLiveVoiceState('listening');
        setLiveVoiceTranscript('');
        if ('wakeLock' in navigator) {
          (navigator as any).wakeLock.request('screen')
            .then((wl: any) => { wakeLockRef.current = wl; })
            .catch(() => {});
        }
        setTimeout(() => startLiveListeningFnRef.current(), 100);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentChatId, isOpen]);

  // ═══════════════════════════════════════════════════════════════
  // Chat Management
  // ═══════════════════════════════════════════════════════════════

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'chats'), where('userId', '==', user.uid), limit(20));
      const snapshot = await getDocs(q);
      const loaded = snapshot.docs.map((d) => ({
        id: d.id,
        userId: d.data().userId,
        title: d.data().title,
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
        messageCount: d.data().messageCount || 0,
        lastMessage: d.data().lastMessage,
      })) as Chat[];
      loaded.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      setChats(loaded);
      if (loaded.length > 0 && !currentChatId) setCurrentChatId(loaded[0].id);
      else if (loaded.length === 0) createNewChat();
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'chat_messages'),
        where('chatId', '==', chatId),
        where('userId', '==', user.uid),
        limit(100),
      );
      const snapshot = await getDocs(q);
      const loaded = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          actionExecuted: data.metadata?.actionExecuted || false,
          actionType: data.metadata?.actionType,
        } as Message;
      });
      loaded.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setMessages(loaded);

      // Smart greeting for empty/new chats
      if (loaded.length === 0 && greetingShown !== chatId) {
        setGreetingShown(chatId);
        try {
          const greeting = await getSmartGreeting();
          if (greeting) {
            setMessages([{
              id: 'greeting-' + Date.now(),
              role: 'assistant',
              content: greeting,
              timestamp: new Date(),
            }]);
          }
        } catch { /* ignore greeting errors */ }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewChat = async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: 'Nueva conversación',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        messageCount: 0,
      });
      const chatObj: Chat = {
        id: docRef.id,
        userId: user.uid,
        title: 'Nueva conversación',
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
      };
      setChats((prev) => [chatObj, ...prev]);
      setCurrentChatId(docRef.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      const q = query(collection(db, 'chat_messages'), where('chatId', '==', chatId), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) await deleteDoc(doc(db, 'chat_messages', d.id));
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (currentChatId === chatId) {
        const remaining = chats.filter((c) => c.id !== chatId);
        if (remaining[0]) setCurrentChatId(remaining[0].id);
        else createNewChat();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Context Gathering
  // ═══════════════════════════════════════════════════════════════

  const getAgendaContext = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const smartContext = await buildSmartContext(user.uid);
      return contextToPromptString(smartContext);
    } catch (error) {
      console.error('Error building smart context:', error);
      return null;
    }
  };

  const getSmartGreeting = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const smartContext = await buildSmartContext(user.uid);
      return generateSmartGreeting(smartContext, userProfileState?.name);
    } catch (error) {
      console.error('Error generating greeting:', error);
      return null;
    }
  };

  const getUserProfile = async () => {
    if (!user) return null;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) return userDoc.data();
    } catch (e) {
      console.error('Error loading user profile:', e);
    }
    return null;
  };

  // ═══════════════════════════════════════════════════════════════
  // Action Execution
  // ═══════════════════════════════════════════════════════════════

  const getDateFromDayOfWeek = (dayOfWeek: string): Date => {
    const today = startOfDay(new Date());
    const dayMap: Record<string, (date: Date) => Date> = {
      lunes: nextMonday, martes: nextTuesday, miercoles: nextWednesday, 'miércoles': nextWednesday,
      jueves: nextThursday, viernes: nextFriday, sabado: nextSaturday, 'sábado': nextSaturday, domingo: nextSunday,
    };
    const normalized = dayOfWeek.toLowerCase();
    if (normalized === 'hoy') return today;
    if (normalized === 'mañana' || normalized === 'manana') return addDays(today, 1);
    return dayMap[normalized]?.(today) ?? today;
  };

  const createEvent = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.title) return false;
    try {
      const eventDate = data.date ? new Date(data.date) : data.day_of_week ? getDateFromDayOfWeek(data.day_of_week) : new Date();
      const [sH, sM] = (data.start_time || '09:00').split(':').map(Number);
      const [eH, eM] = (data.end_time || '10:00').split(':').map(Number);
      const start = new Date(eventDate); start.setHours(sH, sM, 0, 0);
      const end = new Date(eventDate); end.setHours(eH, eM, 0, 0);
      await addDoc(collection(db, 'events'), {
        userId: user.uid, title: data.title, description: data.description || '', type: data.type || 'personal',
        startDate: Timestamp.fromDate(start), endDate: Timestamp.fromDate(end),
        location: '', category: 'general', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });
      return true;
    } catch (error) { console.error('Error creating event:', error); return false; }
  };

  const createTask = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.title) return false;
    try {
      const dueDate = data.date ? new Date(data.date) : data.day_of_week ? getDateFromDayOfWeek(data.day_of_week) : null;
      await addDoc(collection(db, 'tasks'), {
        userId: user.uid, title: data.title, description: data.description || '',
        status: data.status || 'pending', priority: data.priority || 'medium', category: 'general',
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });
      return true;
    } catch (error) { console.error('Error creating task:', error); return false; }
  };

  const createTransaction = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.description || !data?.amount) return false;
    try {
      const txDate = data.date ? new Date(data.date) : data.day_of_week ? getDateFromDayOfWeek(data.day_of_week) : new Date();
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid, type: data.transaction_type || 'expense', category: data.category || 'otro',
        amount: data.amount, description: data.description, date: Timestamp.fromDate(txDate),
        account: data.account || 'principal', createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      });
      return true;
    } catch (error) { console.error('Error creating transaction:', error); return false; }
  };

  const completeTask = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.taskId) return false;
    try {
      const taskRef = doc(db, 'tasks', data.taskId);
      const snap = await getDoc(taskRef);
      if (!snap.exists() || snap.data().userId !== user.uid) return false;
      await updateDoc(taskRef, {
        status: 'completed',
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return true;
    } catch (error) { console.error('Error completing task:', error); return false; }
  };

  const deleteTask = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.taskId) return false;
    try {
      const taskRef = doc(db, 'tasks', data.taskId);
      const snap = await getDoc(taskRef);
      if (!snap.exists() || snap.data().userId !== user.uid) return false;
      await deleteDoc(taskRef);
      return true;
    } catch (error) { console.error('Error deleting task:', error); return false; }
  };

  const deleteEvent = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.eventId) return false;
    try {
      const eventRef = doc(db, 'events', data.eventId);
      const snap = await getDoc(eventRef);
      if (!snap.exists() || snap.data().userId !== user.uid) return false;
      await deleteDoc(eventRef);
      return true;
    } catch (error) { console.error('Error deleting event:', error); return false; }
  };

  const handleExecuteAction = async (action: AIAction): Promise<string> => {
    let success = false;
    let result = '';
    switch (action.action) {
      case 'create_event':
        success = await createEvent(action.data);
        result = success ? '✅ Evento creado correctamente' : '❌ No se pudo crear el evento';
        break;
      case 'create_task':
        success = await createTask(action.data);
        result = success ? '✅ Tarea creada correctamente' : '❌ No se pudo crear la tarea';
        break;
      case 'create_transaction':
        success = await createTransaction(action.data);
        result = success ? '✅ Transacción registrada correctamente' : '❌ No se pudo registrar la transacción';
        break;
      case 'complete_task':
        success = await completeTask(action.data);
        result = success ? '✅ Tarea completada' : '❌ No se pudo completar la tarea (ID no encontrado)';
        break;
      case 'delete_task':
        success = await deleteTask(action.data);
        result = success ? '✅ Tarea eliminada' : '❌ No se pudo eliminar la tarea';
        break;
      case 'delete_event':
        success = await deleteEvent(action.data);
        result = success ? '✅ Evento eliminado' : '❌ No se pudo eliminar el evento';
        break;
      case 'remember':
        if (action.data?.note && user) {
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const snap = await getDoc(userDocRef);
            const notes = snap.exists() ? (snap.data().notes || []) : [];
            await setDoc(userDocRef, { notes: [...notes, action.data.note], updatedAt: Timestamp.now() }, { merge: true });
            // Auto-save user name if provided
            if (action.data.userName) {
              await updateName(user.uid, action.data.userName);
            }
            success = true;
          } catch { success = false; }
        }
        result = success ? '✅ Nota guardada en tu perfil' : '❌ No se pudo guardar la nota';
        break;
      case 'get_weather':
      case 'get_news':
      case 'search_web':
        try {
          const integrationId = action.action === 'get_weather' ? 'weather'
            : action.action === 'get_news' ? 'news' : 'webSearch';
          const res = await fetch('/api/integrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              integrationId,
              params: action.data || {},
              userIntegrations,
            }),
          });
          const data = await res.json();
          if (data.success && data.data) {
            result = typeof data.data === 'string' ? data.data : JSON.stringify(data.data, null, 2);
            success = true;
          } else {
            result = data.error || '❌ No se pudo obtener la información';
          }
        } catch {
          result = '❌ Error al consultar el servicio externo';
        }
        break;
      default:
        result = '';
    }
    return result;
  };

  // ═══════════════════════════════════════════════════════════════
  // Message Sending
  // ═══════════════════════════════════════════════════════════════

  const sendMessageText = async (text: string): Promise<string | null> => {
    if (!text.trim() || !currentChatId || !user) return null;
    setLoading(true);
    const userMessage = text.trim();

    try {
      const userMessageDoc = await addDoc(collection(db, 'chat_messages'), {
        chatId: currentChatId, userId: user.uid, role: 'user', content: userMessage, timestamp: Timestamp.now(),
      });
      setMessages((prev) => [...prev, { id: userMessageDoc.id, role: 'user', content: userMessage, timestamp: new Date() }]);

      const [agendaContext, userProfile] = await Promise.all([getAgendaContext(), getUserProfile()]);
      const conversationHistory = [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userMessage }];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory, chatId: currentChatId, userId: user.uid, agendaContext, userProfile, userIntegrations }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data?.error || `Error del servidor (${response.status})`;
        throw new Error(errorMsg);
      }

      if (data.success) {
        let finalMessage = '';
        let actionExecuted = false;
        let actionType: 'event' | 'task' | undefined;

        if (data.action) {
          const action = data.action as AIAction;
          let actionResult = '';
          if (action.action !== 'none') {
            actionResult = await handleExecuteAction(action);
            actionExecuted = true;
            const eventActions = ['create_event', 'delete_event'];
            const taskActions = ['create_task', 'complete_task', 'delete_task'];
            actionType = eventActions.includes(action.action) ? 'event'
              : taskActions.includes(action.action) ? 'task'
              : action.action === 'create_transaction' ? 'task' : undefined;
          }
          finalMessage = actionResult ? `${action.message}\n\n${actionResult}` : action.message;
        } else {
          finalMessage = data.message || 'Lo siento, no pude generar una respuesta.';
        }

        const messageData: any = {
          chatId: currentChatId, userId: user.uid, role: 'assistant', content: finalMessage,
          timestamp: Timestamp.now(), metadata: { actionExecuted },
        };
        if (actionType) messageData.metadata.actionType = actionType;
        const assistantDoc = await addDoc(collection(db, 'chat_messages'), messageData);

        setMessages((prev) => [...prev, {
          id: assistantDoc.id, role: 'assistant', content: finalMessage, timestamp: new Date(), actionExecuted, actionType,
        }]);

        await updateDoc(doc(db, 'chats', currentChatId), {
          updatedAt: Timestamp.now(),
          messageCount: increment(2),
          lastMessage: userMessage.substring(0, 50),
          title: chats.find(c => c.id === currentChatId)?.messageCount === 0
            ? userMessage.substring(0, 40) + (userMessage.length > 40 ? '...' : '')
            : chats.find(c => c.id === currentChatId)?.title,
        });

        // Auto-read response if enabled (in text mode, not live voice)
        if (autoReadEnabled && !liveVoiceModeRef.current && synthSupported) {
          speakTextAutoRead(finalMessage);
        }

        return finalMessage;
      }
      return null;
    } catch (error) {
      console.error('Error sending message:', error);
      const errorText = error instanceof Error ? error.message : 'Error desconocido';
      setMessages((prev) => [...prev, {
        id: 'error-' + Date.now(), role: 'assistant',
        content: `❌ ${errorText}`,
        timestamp: new Date(),
      }]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !currentChatId || !user) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessageText(userMessage);
  };

  // ═══════════════════════════════════════════════════════════════
  // Voice Note
  // ═══════════════════════════════════════════════════════════════

  const formatVoiceDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startVoiceNote = () => {
    setVoiceNoteMode(true);
    setVoiceNoteDuration(0);
    setVoiceNoteTranscript('');
    setVoiceNoteEditing(false);
    setVoiceNoteError('');
    voiceNoteActiveRef.current = true;

    recognitionRef.current?.abort?.();
    liveVoiceRecognitionRef.current?.abort?.();
    setIsListening(false);

    voiceNoteTimerRef.current = setInterval(() => setVoiceNoteDuration(prev => prev + 1), 1000);

    if (typeof window === 'undefined') return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceNoteError('Tu navegador no soporta reconocimiento de voz');
      setVoiceNoteEditing(true);
      return;
    }

    voiceNoteRecognitionRef.current?.abort?.();
    const recognition = new Recognition();
    voiceNoteRecognitionRef.current = recognition;
    recognition.lang = 'es-ES';
    // continuous=false is CRITICAL on Android: with continuous=true the engine
    // re-delivers the cumulative transcript from the start on every internal
    // restart, which — combined with our segment accumulation — produces the
    // "Crea Crea una Crea una tarea..." staircase. With continuous=false each
    // session is one clean utterance; we stitch utterances together ourselves.
    recognition.continuous = false;
    recognition.interimResults = true;

    // `committed` holds finalized text from previous utterance segments.
    // `sessionText` is the best transcript for the CURRENT segment.
    let committed = '';
    let sessionText = '';
    let gotResults = false;

    recognition.onresult = (event: any) => {
      // Ignore events from a stale/aborted recognizer (prevents overlap)
      if (voiceNoteRecognitionRef.current !== recognition) return;
      gotResults = true;
      setVoiceNoteError('');
      // Take ONLY the last result. Android Chrome emits cumulative snapshots as
      // SEPARATE results (["puedes", "puedes escuchar", "puedes escuchar todo"]);
      // summing them produces the "puedes puedes escuchar..." staircase. The
      // last result already holds the full utterance on every platform.
      const last = event.results[event.results.length - 1];
      sessionText = (last?.[0]?.transcript || '').trim();
      setVoiceNoteTranscript((committed + ' ' + sessionText).replace(/\s+/g, ' ').trim());
    };

    recognition.onerror = (event: any) => {
      if (voiceNoteRecognitionRef.current !== recognition) return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceNoteError('Permiso de micrófono denegado');
        setVoiceNoteEditing(true);
      } else if (event.error === 'audio-capture') {
        setVoiceNoteError('No se detecta micrófono');
        setVoiceNoteEditing(true);
      }
    };

    recognition.onend = () => {
      // Only the active recognizer may commit text and restart
      if (voiceNoteRecognitionRef.current !== recognition) return;
      if (voiceNoteActiveRef.current) {
        // Commit this segment's text, then listen for the next one
        if (sessionText.trim()) {
          committed = (committed + ' ' + sessionText).replace(/\s+/g, ' ').trim();
          sessionText = '';
        }
        if (!gotResults) {
          setTimeout(() => {
            if (voiceNoteActiveRef.current && !gotResults) {
              setVoiceNoteError('No se captó voz, escribe tu mensaje');
              setVoiceNoteEditing(true);
            }
          }, 500);
        }
        // Small delay avoids a tight restart loop when there is silence
        setTimeout(() => {
          if (voiceNoteActiveRef.current && voiceNoteRecognitionRef.current === recognition) {
            try { recognition.start(); } catch { /* ignore */ }
          }
        }, 250);
      }
    };

    try { recognition.start(); } catch (e) {
      console.error('Failed to start voice note recognition:', e);
      setVoiceNoteError('Error al iniciar micrófono');
      setVoiceNoteEditing(true);
    }
  };

  const cancelVoiceNote = () => {
    voiceNoteActiveRef.current = false;
    voiceNoteRecognitionRef.current?.abort?.();
    if (voiceNoteTimerRef.current) { clearInterval(voiceNoteTimerRef.current); voiceNoteTimerRef.current = null; }
    setVoiceNoteMode(false);
    setVoiceNoteDuration(0);
    setVoiceNoteTranscript('');
    setVoiceNoteEditing(false);
    setVoiceNoteError('');
  };

  const sendVoiceNote = async () => {
    voiceNoteActiveRef.current = false;
    try { voiceNoteRecognitionRef.current?.stop?.(); } catch { /* ignore */ }
    if (voiceNoteTimerRef.current) { clearInterval(voiceNoteTimerRef.current); voiceNoteTimerRef.current = null; }
    const transcript = voiceNoteTranscript.trim();
    setVoiceNoteMode(false);
    setVoiceNoteDuration(0);
    setVoiceNoteTranscript('');
    setVoiceNoteEditing(false);
    setVoiceNoteError('');
    if (transcript) await sendMessageTextFnRef.current(transcript);
  };

  // ═══════════════════════════════════════════════════════════════
  // Live Voice Conversation
  // ═══════════════════════════════════════════════════════════════

  // Auto-read in text mode (non-blocking, cancellable)
  const speakTextAutoRead = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '')
      .replace(/[\u2705\u274C\uD83D\uDCC5\uD83D\uDCCB\uD83C\uDFAF\uD83D\uDC4B\uD83D\uDE0A\uD83D\uDD34\u26A1\uD83D\uDCA1\uD83D\uDCCA\uD83C\uDF89\u2728\uD83D\uDCAA\uD83C\uDFC6\uD83D\uDCDD\uD83D\uDDD3\uFE0F\u23F0\uD83D\uDD14\uD83D\uDCBC\uD83C\uDFE0\uD83C\uDF93]/gu, '')
      .replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;
    const voiceSpeed = userProfileState?.voiceSettings?.speed || 1.0;
    const voicePitch = userProfileState?.voiceSettings?.pitch || 1.0;
    const chunks = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    let i = 0;
    const speakNext = () => {
      if (i >= chunks.length) return;
      const u = new SpeechSynthesisUtterance(chunks[i].trim());
      u.lang = 'es-ES';
      if (spanishVoiceRef.current) u.voice = spanishVoiceRef.current;
      u.rate = voiceSpeed;
      u.pitch = voicePitch;
      u.volume = 1.0;
      u.onend = () => { i++; speakNext(); };
      u.onerror = () => { i++; speakNext(); };
      window.speechSynthesis.speak(u);
    };
    speakNext();
  };

  const speakText = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();
      const cleanText = text
        .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '')
        .replace(/[\u2705\u274C\uD83D\uDCC5\uD83D\uDCCB\uD83C\uDFAF\uD83D\uDC4B\uD83D\uDE0A\uD83D\uDD34\u26A1\uD83D\uDCA1\uD83D\uDCCA\uD83C\uDF89\u2728\uD83D\uDCAA\uD83C\uDFC6\uD83D\uDCDD\uD83D\uDDD3\uFE0F\u23F0\uD83D\uDD14\uD83D\uDCBC\uD83C\uDFE0\uD83C\uDF93]/gu, '')
        .replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();
      if (!cleanText) { resolve(); return; }

      const chunks = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
      let i = 0;
      const speakNext = () => {
        if (i >= chunks.length || !liveVoiceModeRef.current) { resolve(); return; }
        const u = new SpeechSynthesisUtterance(chunks[i].trim());
        u.lang = 'es-ES';
        if (spanishVoiceRef.current) u.voice = spanishVoiceRef.current;
        u.rate = userProfileState?.voiceSettings?.speed || 1.0;
        u.pitch = userProfileState?.voiceSettings?.pitch || 1.0;
        u.volume = 1.0;
        u.onend = () => { i++; speakNext(); };
        u.onerror = () => { i++; speakNext(); };
        window.speechSynthesis.speak(u);
      };
      speakNext();
    });
  };

  const startLiveVoice = async () => {
    setLiveVoiceMode(true);
    liveVoiceModeRef.current = true;
    setLiveVoiceState('listening');
    setLiveVoiceTranscript('');
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
    } catch { /* Wake lock not available */ }
    setTimeout(() => startLiveListeningFnRef.current(), 100);
  };

  const startLiveListening = () => {
    if (typeof window === 'undefined' || !liveVoiceModeRef.current) return;
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;

    liveVoiceRecognitionRef.current?.abort?.();
    const recognition = new Recognition();
    liveVoiceRecognitionRef.current = recognition;
    recognition.lang = 'es-ES';
    // continuous=false avoids Android's cumulative-snapshot behavior; each
    // utterance is one clean session that ends on a natural pause.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let lastText = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (lastText.trim() && liveVoiceModeRef.current) {
          try { recognition.stop(); } catch { /* ignore */ }
        }
      }, 2000);
    };

    recognition.onresult = (event: any) => {
      // Ignore a stale/aborted recognizer (prevents overlapping transcripts)
      if (liveVoiceRecognitionRef.current !== recognition) return;
      // Take ONLY the last result. Android emits cumulative snapshots as
      // separate results; summing them produces a duplicated staircase. The
      // last result already holds the full utterance.
      const last = event.results[event.results.length - 1];
      lastText = (last?.[0]?.transcript || '').trim();
      setLiveVoiceTranscript(lastText);
      resetSilenceTimer();
    };

    recognition.onerror = (event: any) => {
      // A stale recognizer being aborted must NOT schedule a restart, otherwise
      // each abort cascades into a new recognizer and they overlap.
      if (liveVoiceRecognitionRef.current !== recognition) return;
      if (!liveVoiceModeRef.current) return;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setTimeout(() => { if (liveVoiceModeRef.current) startLiveListeningFnRef.current(); }, 200);
      } else if (event.error === 'network') {
        setTimeout(() => { if (liveVoiceModeRef.current) startLiveListeningFnRef.current(); }, 1000);
      }
    };

    recognition.onend = () => {
      if (liveVoiceRecognitionRef.current !== recognition) return;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (!liveVoiceModeRef.current) return;
      if (lastText.trim()) handleLiveVoiceMessageFnRef.current(lastText.trim());
      else {
        setLiveVoiceTranscript('');
        setTimeout(() => { if (liveVoiceModeRef.current) startLiveListeningFnRef.current(); }, 200);
      }
    };

    setLiveVoiceState('listening');
    setLiveVoiceTranscript('');
    try { recognition.start(); } catch {
      setTimeout(() => {
        if (liveVoiceModeRef.current) { try { new Recognition().start(); } catch { /* give up */ } }
      }, 500);
    }
  };

  const handleLiveVoiceMessage = async (text: string) => {
    setLiveVoiceState('processing');
    setLiveVoiceTranscript('');
    const response = await sendMessageTextFnRef.current(text);
    if (response && liveVoiceModeRef.current) {
      setLiveVoiceState('speaking');
      await speakText(response);
    }
    if (liveVoiceModeRef.current) startLiveListeningFnRef.current();
  };

  const stopLiveVoice = () => {
    liveVoiceModeRef.current = false;
    setLiveVoiceMode(false);
    setLiveVoiceState('idle');
    setLiveVoiceTranscript('');
    liveVoiceRecognitionRef.current?.abort?.();
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    wakeLockRef.current?.release?.().catch(() => {});
    wakeLockRef.current = null;
  };

  // Keep function refs updated for stable callbacks
  sendMessageTextFnRef.current = sendMessageText;
  handleLiveVoiceMessageFnRef.current = handleLiveVoiceMessage;
  startLiveListeningFnRef.current = startLiveListening;

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  if (!isOpen) {
    return (
      <ChatFAB
        speechSupported={speechSupported}
        synthSupported={synthSupported}
        onOpenChat={() => setIsOpen(true)}
        onOpenVoice={() => {
          autoStartVoiceRef.current = true;
          setIsOpen(true);
        }}
      />
    );
  }

  if (isMinimized) {
    return (
      <ChatMinimized
        onMaximize={() => setIsMinimized(false)}
        onClose={() => setIsOpen(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-6 w-full h-full sm:w-[400px] sm:h-[600px] bg-white dark:bg-surface sm:rounded-2xl shadow-2xl shadow-brand-orange/10 dark:shadow-black/30 z-50 flex flex-col border-0 sm:border border-gray-100 dark:border-border-custom animate-scale-in overflow-hidden">
      <ChatHeader
        chatsCount={chats.length}
        showChatsList={showChatsList}
        onToggleChatsList={() => setShowChatsList(!showChatsList)}
        onMinimize={() => setIsMinimized(true)}
        onClose={() => setIsOpen(false)}
        autoReadEnabled={autoReadEnabled}
        onToggleAutoRead={() => {
          const newVal = !autoReadEnabled;
          setAutoReadEnabled(newVal);
          if (user) {
            updateVoiceSettings(user.uid, { autoRead: newVal }).catch(() => {});
          }
          // Cancel current speech when disabling
          if (!newVal && typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
          }
        }}
      />

      {showChatsList && (
        <ChatList
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={(id) => { setCurrentChatId(id); setShowChatsList(false); }}
          onCreateChat={createNewChat}
          onDeleteChat={deleteChat}
        />
      )}

      <MessageList
        messages={messages}
        loading={loading}
        currentChatId={currentChatId}
        messagesEndRef={messagesEndRef}
        onSendSuggestion={sendMessageText}
      />

      <ChatInput
        input={input}
        loading={loading}
        textareaRef={textareaRef}
        onInputChange={setInput}
        onSend={handleSend}
        voiceNoteMode={voiceNoteMode}
        voiceNoteEditing={voiceNoteEditing}
        voiceNoteTranscript={voiceNoteTranscript}
        voiceNoteDuration={voiceNoteDuration}
        voiceNoteError={voiceNoteError}
        voiceNoteInputRef={voiceNoteInputRef}
        onVoiceNoteTranscriptChange={setVoiceNoteTranscript}
        onStartVoiceNote={startVoiceNote}
        onCancelVoiceNote={cancelVoiceNote}
        onSendVoiceNote={sendVoiceNote}
        onEditVoiceNote={() => {
          setVoiceNoteEditing(true);
          setTimeout(() => voiceNoteInputRef.current?.focus(), 50);
        }}
        formatVoiceDuration={formatVoiceDuration}
        speechSupported={speechSupported}
        synthSupported={synthSupported}
        onStartLiveVoice={startLiveVoice}
      />

      {liveVoiceMode && (
        <LiveVoiceOverlay
          liveVoiceState={liveVoiceState}
          liveVoiceTranscript={liveVoiceTranscript}
          messages={messages}
          messagesEndRef={messagesEndRef}
          onStop={stopLiveVoice}
        />
      )}
    </div>
  );
}
