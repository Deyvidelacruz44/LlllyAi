'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, 
  doc, orderBy, limit, Timestamp, getDoc, setDoc, increment 
} from 'firebase/firestore';
import { 
  Send, Loader2, Sparkles, CheckCircle, Calendar, ListTodo, 
  MessageSquare, Trash2, ChevronRight, ChevronLeft, Minimize2, Maximize2, Mic, MicOff,
  Phone, PhoneOff, X, Volume2
} from 'lucide-react';
import { format, addDays, startOfDay, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday } from 'date-fns';
import { es } from 'date-fns/locale';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actionExecuted?: boolean;
  actionType?: 'event' | 'task';
}

interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

interface AIAction {
  action: 'create_event' | 'create_task' | 'create_transaction' | 'update_task' | 'delete_task' | 'list_events' | 'list_tasks' | 'remember' | 'none';
  message: string;
  data?: {
    title?: string;
    description?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
    day_of_week?: string;
    type?: string;
    priority?: string;
    status?: string;
    taskId?: string;
    note?: string;
    // Finance fields
    amount?: number;
    category?: string;
    transaction_type?: 'income' | 'expense';
    account?: string;
  };
}

// Simple markdown: renders **bold** text
function renderContent(content: string) {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function FloatingChat() {
  const { user } = useAuth();
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

  // Voice note states
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [voiceNoteMode, setVoiceNoteMode] = useState(false);
  const [voiceNoteDuration, setVoiceNoteDuration] = useState(0);
  const [voiceNoteTranscript, setVoiceNoteTranscript] = useState('');
  const [voiceNoteEditing, setVoiceNoteEditing] = useState(false);
  const [voiceNoteError, setVoiceNoteError] = useState('');
  const voiceNoteInputRef = useRef<HTMLInputElement>(null);

  // Live voice conversation states
  const [liveVoiceMode, setLiveVoiceMode] = useState(false);
  const [liveVoiceState, setLiveVoiceState] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [liveVoiceTranscript, setLiveVoiceTranscript] = useState('');
  const [synthSupported, setSynthSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputBaseRef = useRef('');
  const voiceNoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceNoteRecognitionRef = useRef<any>(null);
  const voiceNoteActiveRef = useRef(false);
  const liveVoiceRecognitionRef = useRef<any>(null);
  const liveVoiceModeRef = useRef(false);
  const micMenuRef = useRef<HTMLDivElement>(null);
  const sendMessageTextFnRef = useRef<(text: string) => Promise<string | null>>(async () => null);
  const handleLiveVoiceMessageFnRef = useRef<(text: string) => Promise<void>>(async () => {});
  const startLiveListeningFnRef = useRef<() => void>(() => {});
  const wakeLockRef = useRef<any>(null);
  const spanishVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const autoStartVoiceRef = useRef(false);

  useEffect(() => {
    if (user && isOpen) {
      loadChats();
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (currentChatId && isOpen) {
      loadMessages(currentChatId);
    }
  }, [currentChatId, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
    setSpeechSupported(supported);
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

  useEffect(() => {
    return () => {
      if (recognitionRef.current?.abort) {
        recognitionRef.current.abort();
      }
      if (voiceNoteRecognitionRef.current?.abort) {
        voiceNoteRecognitionRef.current.abort();
      }
      if (liveVoiceRecognitionRef.current?.abort) {
        liveVoiceRecognitionRef.current.abort();
      }
      if (voiceNoteTimerRef.current) {
        clearInterval(voiceNoteTimerRef.current);
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
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

  // Close mic menu on outside click
  useEffect(() => {
    if (!showMicMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (micMenuRef.current && !micMenuRef.current.contains(e.target as Node)) {
        setShowMicMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMicMenu]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    if (!user) return;
    
    try {
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('userId', '==', user.uid),
        limit(20)
      );
      const snapshot = await getDocs(q);
      
      const loadedChats = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        userId: docSnap.data().userId,
        title: docSnap.data().title,
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
        messageCount: docSnap.data().messageCount || 0,
        lastMessage: docSnap.data().lastMessage,
      })) as Chat[];
      
      // Ordenar en memoria por updatedAt
      loadedChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      
      setChats(loadedChats);
      
      if (loadedChats.length > 0 && !currentChatId) {
        setCurrentChatId(loadedChats[0].id);
      } else if (loadedChats.length === 0) {
        createNewChat();
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!user) return;
    
    try {
      const messagesRef = collection(db, 'chat_messages');
      const q = query(
        messagesRef,
        where('chatId', '==', chatId),
        where('userId', '==', user.uid),
        limit(100)
      );
      const snapshot = await getDocs(q);
      
      const loadedMessages = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          actionExecuted: data.metadata?.actionExecuted || false,
          actionType: data.metadata?.actionType,
        } as Message;
      });
      
      // Ordenar en memoria por timestamp
      loadedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewChat = async () => {
    if (!user) return;
    
    try {
      const newChat = {
        userId: user.uid,
        title: 'Nueva conversación',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        messageCount: 0,
      };
      
      const docRef = await addDoc(collection(db, 'chats'), newChat);
      
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
      
      const messagesRef = collection(db, 'chat_messages');
      const q = query(messagesRef, where('chatId', '==', chatId));
      const snapshot = await getDocs(q);
      
      for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(db, 'chat_messages', docSnap.id));
      }
      
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      
      if (currentChatId === chatId) {
        const remainingChats = chats.filter((c) => c.id !== chatId);
        if (remainingChats[0]) {
          setCurrentChatId(remainingChats[0].id);
        } else {
          createNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const getAgendaContext = async () => {
    if (!user) return null;

    try {
      // Queries optimizadas sin orderBy múltiple
      const [eventsSnapshot, tasksSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'events'), where('userId', '==', user.uid), limit(20))),
        getDocs(query(collection(db, 'tasks'), where('userId', '==', user.uid), limit(20))),
      ]);

      const events = eventsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title,
          type: data.type,
          startDate: data.startDate?.toDate().toISOString(),
        };
      }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).slice(0, 20);

      const tasks = tasksSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title,
          status: data.status,
          priority: data.priority,
        };
      });

      // Transactions query separada para no bloquear eventos/tareas si falla
      let transactions: Array<{ id: string; description: string; type: string; amount: number; category: string; date: string }> = [];
      try {
        const transactionsSnapshot = await getDocs(
          query(collection(db, 'transactions'), where('userId', '==', user.uid), limit(20))
        );
        transactions = transactionsSnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            description: data.description,
            type: data.type,
            amount: data.amount,
            category: data.category,
            date: data.date?.toDate().toISOString(),
          };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15);
      } catch {
        // Transactions collection may not have rules deployed yet
      }

      const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      return {
        events,
        tasks,
        finances: {
          recentTransactions: transactions,
          summary: { totalIncome: income, totalExpenses: expenses, balance: income - expenses },
        },
      };
    } catch (error) {
      console.error('Error getting agenda context:', error);
      return { events: [], tasks: [], finances: { recentTransactions: [], summary: { totalIncome: 0, totalExpenses: 0, balance: 0 } } };
    }
  };

  const getUserProfile = async () => {
    if (!user) return null;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
    } catch (e) {
      console.error('Error loading user profile:', e);
    }
    return null;
  };

  const getDateFromDayOfWeek = (dayOfWeek: string): Date => {
    const today = startOfDay(new Date());
    const dayMap: Record<string, (date: Date) => Date> = {
      'lunes': nextMonday,
      'martes': nextTuesday,
      'miercoles': nextWednesday,
      'miércoles': nextWednesday,
      'jueves': nextThursday,
      'viernes': nextFriday,
      'sabado': nextSaturday,
      'sábado': nextSaturday,
      'domingo': nextSunday,
    };
    
    const normalizedDay = dayOfWeek.toLowerCase();
    if (normalizedDay === 'hoy') return today;
    if (normalizedDay === 'mañana' || normalizedDay === 'manana') return addDays(today, 1);
    
    const getNextDay = dayMap[normalizedDay];
    if (getNextDay) return getNextDay(today);
    
    return today;
  };

  const createEvent = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.title) return false;
    
    try {
      let eventDate: Date;
      
      if (data.date) {
        eventDate = new Date(data.date);
      } else if (data.day_of_week) {
        eventDate = getDateFromDayOfWeek(data.day_of_week);
      } else {
        eventDate = new Date();
      }
      
      const startTime = data.start_time || '09:00';
      const endTime = data.end_time || '10:00';
      
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const startDateTime = new Date(eventDate);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      const endDateTime = new Date(eventDate);
      endDateTime.setHours(endHour, endMin, 0, 0);
      
      await addDoc(collection(db, 'events'), {
        userId: user.uid,
        title: data.title,
        description: data.description || '',
        type: data.type || 'personal',
        startDate: Timestamp.fromDate(startDateTime),
        endDate: Timestamp.fromDate(endDateTime),
        location: '',
        category: 'general',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      return true;
    } catch (error) {
      console.error('Error creating event:', error);
      return false;
    }
  };

  const createTask = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.title) return false;
    
    try {
      let dueDate: Date | null = null;
      
      if (data.date) {
        dueDate = new Date(data.date);
      } else if (data.day_of_week) {
        dueDate = getDateFromDayOfWeek(data.day_of_week);
      }
      
      await addDoc(collection(db, 'tasks'), {
        userId: user.uid,
        title: data.title,
        description: data.description || '',
        status: data.status || 'pending',
        priority: data.priority || 'medium',
        category: 'general',
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      return true;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  };

  const createTransaction = async (data: AIAction['data']): Promise<boolean> => {
    if (!user || !data?.description || !data?.amount) return false;
    
    try {
      let transactionDate: Date = new Date();
      
      if (data.date) {
        transactionDate = new Date(data.date);
      } else if (data.day_of_week) {
        transactionDate = getDateFromDayOfWeek(data.day_of_week);
      }
      
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: data.transaction_type || 'expense',
        category: data.category || 'otro',
        amount: data.amount,
        description: data.description,
        date: Timestamp.fromDate(transactionDate),
        account: data.account || 'principal',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      return true;
    } catch (error) {
      console.error('Error creating transaction:', error);
      return false;
    }
  };

  const handleExecuteAction = async (action: AIAction): Promise<string> => {
    let success = false;
    let resultMessage = '';

    switch (action.action) {
      case 'create_event':
        success = await createEvent(action.data);
        resultMessage = success 
          ? '✅ Evento creado correctamente' 
          : '❌ No se pudo crear el evento';
        break;
      
      case 'create_task':
        success = await createTask(action.data);
        resultMessage = success 
          ? '✅ Tarea creada correctamente' 
          : '❌ No se pudo crear la tarea';
        break;

      case 'create_transaction':
        success = await createTransaction(action.data);
        resultMessage = success 
          ? '✅ Transacción registrada correctamente' 
          : '❌ No se pudo registrar la transacción';
        break;

      case 'remember':
        if (action.data?.note && user) {
          try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const currentNotes = userDocSnap.exists() ? (userDocSnap.data().notes || []) : [];
            await setDoc(userDocRef, {
              notes: [...currentNotes, action.data.note],
              updatedAt: Timestamp.now(),
            }, { merge: true });
            success = true;
          } catch (e) {
            success = false;
          }
        }
        resultMessage = success
          ? '✅ Nota guardada en tu perfil'
          : '❌ No se pudo guardar la nota';
        break;
      
      default:
        resultMessage = '';
    }

    return resultMessage;
  };

  const sendMessageText = async (text: string): Promise<string | null> => {
    if (!text.trim() || !currentChatId || !user) return null;

    setLoading(true);
    const userMessage = text.trim();
    
    try {
      // Guardar mensaje del usuario
      const userMessageDoc = await addDoc(collection(db, 'chat_messages'), {
        chatId: currentChatId,
        userId: user.uid,
        role: 'user',
        content: userMessage,
        timestamp: Timestamp.now(),
      });

      const userMsg: Message = {
        id: userMessageDoc.id,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);

      // Obtener contexto y perfil del usuario
      const [agendaContext, userProfile] = await Promise.all([
        getAgendaContext(),
        getUserProfile(),
      ]);

      // Obtener historial de mensajes para contexto
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      // Agregar el nuevo mensaje del usuario
      conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Llamar a la API de chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          chatId: currentChatId,
          userId: user.uid,
          agendaContext,
          userProfile,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        let finalMessage = '';
        let actionExecuted = false;
        let actionType: 'event' | 'task' | undefined = undefined;

        // Si hay una acción estructurada (JSON)
        if (data.action) {
          const action = data.action as AIAction;
          
          // Ejecutar la acción si es necesaria
          let actionResult = '';
          if (action.action !== 'none') {
            actionResult = await handleExecuteAction(action);
            actionExecuted = true;
            actionType = action.action === 'create_event' ? 'event' : action.action === 'create_task' ? 'task' : action.action === 'create_transaction' ? 'task' : undefined;
          }

          // Combinar mensaje de IA con resultado de acción
          finalMessage = actionResult 
            ? `${action.message}\n\n${actionResult}`
            : action.message;
        } else {
          // Respuesta de texto simple
          finalMessage = data.message || 'Lo siento, no pude generar una respuesta.';
        }

        // Guardar mensaje del asistente
        const messageData: any = {
          chatId: currentChatId,
          userId: user.uid,
          role: 'assistant',
          content: finalMessage,
          timestamp: Timestamp.now(),
          metadata: {
            actionExecuted,
          },
        };

        // Solo agregar actionType si tiene un valor
        if (actionType) {
          messageData.metadata.actionType = actionType;
        }

        const assistantMessageDoc = await addDoc(collection(db, 'chat_messages'), messageData);

        const assistantMsg: Message = {
          id: assistantMessageDoc.id,
          role: 'assistant',
          content: finalMessage,
          timestamp: new Date(),
          actionExecuted,
          actionType,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        // Actualizar el chat
        await updateDoc(doc(db, 'chats', currentChatId), {
          updatedAt: Timestamp.now(),
          messageCount: increment(2),
          lastMessage: userMessage.substring(0, 50),
          title: chats.find(c => c.id === currentChatId)?.messageCount === 0 
            ? userMessage.substring(0, 40) + (userMessage.length > 40 ? '...' : '')
            : chats.find(c => c.id === currentChatId)?.title,
        });

        return finalMessage;
      }
      return null;
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Mostrar mensaje de error al usuario
      const errorMsg: Message = {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: '❌ Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMsg]);
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

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const Recognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;

    if (recognitionRef.current?.abort) {
      recognitionRef.current.abort();
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    inputBaseRef.current = input;
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      const base = inputBaseRef.current.trim();
      const spoken = transcript.trim();
      setInput(base ? `${base} ${spoken}` : spoken);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current?.stop) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (!speechSupported || loading) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // ==================== Voice Note Functions ====================

  const formatVoiceDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startVoiceNote = () => {
    setShowMicMenu(false);
    setVoiceNoteMode(true);
    setVoiceNoteDuration(0);
    setVoiceNoteTranscript('');
    setVoiceNoteEditing(false);
    setVoiceNoteError('');
    voiceNoteActiveRef.current = true;

    // Clean up any other active recognitions to avoid conflicts
    if (recognitionRef.current?.abort) {
      try { recognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }
    if (liveVoiceRecognitionRef.current?.abort) {
      try { liveVoiceRecognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }
    setIsListening(false);

    voiceNoteTimerRef.current = setInterval(() => {
      setVoiceNoteDuration(prev => prev + 1);
    }, 1000);

    if (typeof window === 'undefined') return;
    const Recognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceNoteError('Tu navegador no soporta reconocimiento de voz');
      setVoiceNoteEditing(true);
      return;
    }

    if (voiceNoteRecognitionRef.current?.abort) {
      try { voiceNoteRecognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }

    const recognition = new Recognition();
    voiceNoteRecognitionRef.current = recognition;
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';
    let gotResults = false;

    recognition.onresult = (event: any) => {
      gotResults = true;
      setVoiceNoteError('');
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interimTranscript = t;
        }
      }
      setVoiceNoteTranscript((finalTranscript + interimTranscript).trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceNoteError('Permiso de micrófono denegado');
        setVoiceNoteEditing(true);
      } else if (event.error === 'no-speech') {
        // Normal, will restart
      } else if (event.error === 'audio-capture') {
        setVoiceNoteError('No se detecta micrófono');
        setVoiceNoteEditing(true);
      }
    };

    recognition.onend = () => {
      if (voiceNoteActiveRef.current) {
        // If after 4 seconds still no results, offer editing
        if (!gotResults) {
          setTimeout(() => {
            if (voiceNoteActiveRef.current && !gotResults) {
              setVoiceNoteError('No se captó voz, escribe tu mensaje');
              setVoiceNoteEditing(true);
            }
          }, 500);
        }
        try { recognition.start(); } catch (e) { /* ignore */ }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start voice note recognition:', e);
      setVoiceNoteError('Error al iniciar micrófono');
      setVoiceNoteEditing(true);
    }
  };

  const cancelVoiceNote = () => {
    voiceNoteActiveRef.current = false;
    if (voiceNoteRecognitionRef.current) {
      try { voiceNoteRecognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }
    if (voiceNoteTimerRef.current) {
      clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = null;
    }
    setVoiceNoteMode(false);
    setVoiceNoteDuration(0);
    setVoiceNoteTranscript('');
    setVoiceNoteEditing(false);
    setVoiceNoteError('');
  };

  const sendVoiceNote = async () => {
    voiceNoteActiveRef.current = false;
    if (voiceNoteRecognitionRef.current) {
      try { voiceNoteRecognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }
    if (voiceNoteTimerRef.current) {
      clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = null;
    }
    const transcript = voiceNoteTranscript.trim();
    setVoiceNoteMode(false);
    setVoiceNoteDuration(0);
    setVoiceNoteTranscript('');
    setVoiceNoteEditing(false);
    setVoiceNoteError('');

    if (transcript) {
      await sendMessageTextFnRef.current(transcript);
    }
  };

  // ==================== Live Voice Conversation Functions ====================

  const speakText = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }

      // Cancel any ongoing speech first
      window.speechSynthesis.cancel();

      const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/[\u2705\u274C\uD83D\uDCC5\uD83D\uDCCB\uD83C\uDFAF\uD83D\uDC4B\uD83D\uDE0A\uD83D\uDD34\u26A1\uD83D\uDCA1\uD83D\uDCCA\uD83C\uDF89\u2728\uD83D\uDCAA\uD83C\uDFC6\uD83D\uDCDD\uD83D\uDDD3\uFE0F\u23F0\uD83D\uDD14\uD83D\uDCBC\uD83C\uDFE0\uD83C\uDF93]/gu, '')
        .replace(/\n+/g, '. ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        resolve();
        return;
      }

      // Split into sentences to avoid mobile TTS cutting off long text
      const chunks = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
      let currentChunk = 0;

      const speakNextChunk = () => {
        if (currentChunk >= chunks.length || !liveVoiceModeRef.current) {
          resolve();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[currentChunk].trim());
        utterance.lang = 'es-ES';
        if (spanishVoiceRef.current) {
          utterance.voice = spanishVoiceRef.current;
        }
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.onend = () => { currentChunk++; speakNextChunk(); };
        utterance.onerror = () => { currentChunk++; speakNextChunk(); };
        window.speechSynthesis.speak(utterance);
      };

      speakNextChunk();
    });
  };

  const startLiveVoice = async () => {
    setShowMicMenu(false);
    setLiveVoiceMode(true);
    liveVoiceModeRef.current = true;
    setLiveVoiceState('listening');
    setLiveVoiceTranscript('');

    // Keep screen on during voice conversation (mobile)
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) { /* Wake lock not available - continue */ }

    setTimeout(() => startLiveListeningFnRef.current(), 100);
  };

  const startLiveListening = () => {
    if (typeof window === 'undefined') return;
    if (!liveVoiceModeRef.current) return;

    const Recognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return;

    if (liveVoiceRecognitionRef.current?.abort) {
      try { liveVoiceRecognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }

    const recognition = new Recognition();
    liveVoiceRecognitionRef.current = recognition;
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (finalTranscript.trim() && liveVoiceModeRef.current) {
          try { recognition.stop(); } catch (e) { /* ignore */ }
        }
      }, 2000);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interimTranscript = t;
        }
      }
      setLiveVoiceTranscript((finalTranscript + interimTranscript).trim());
      resetSilenceTimer();
    };

    recognition.onerror = (event: any) => {
      if (!liveVoiceModeRef.current) return;
      if (silenceTimer) clearTimeout(silenceTimer);

      if (event.error === 'no-speech' || event.error === 'aborted') {
        setTimeout(() => {
          if (liveVoiceModeRef.current) startLiveListeningFnRef.current();
        }, 200);
      } else if (event.error === 'network') {
        setTimeout(() => {
          if (liveVoiceModeRef.current) startLiveListeningFnRef.current();
        }, 1000);
      }
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (!liveVoiceModeRef.current) return;

      if (finalTranscript.trim()) {
        handleLiveVoiceMessageFnRef.current(finalTranscript.trim());
      } else {
        setLiveVoiceTranscript('');
        setTimeout(() => {
          if (liveVoiceModeRef.current) startLiveListeningFnRef.current();
        }, 200);
      }
    };

    setLiveVoiceState('listening');
    setLiveVoiceTranscript('');

    try {
      recognition.start();
    } catch (e) {
      setTimeout(() => {
        if (liveVoiceModeRef.current) {
          try { new Recognition().start(); } catch (e2) { /* give up */ }
        }
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

    if (liveVoiceModeRef.current) {
      startLiveListeningFnRef.current();
    }
  };

  const stopLiveVoice = () => {
    liveVoiceModeRef.current = false;
    setLiveVoiceMode(false);
    setLiveVoiceState('idle');
    setLiveVoiceTranscript('');

    if (liveVoiceRecognitionRef.current) {
      try { liveVoiceRecognitionRef.current.abort(); } catch (e) { /* ignore */ }
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Release wake lock
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  // Keep function refs updated for stable callbacks
  sendMessageTextFnRef.current = sendMessageText;
  handleLiveVoiceMessageFnRef.current = handleLiveVoiceMessage;
  startLiveListeningFnRef.current = startLiveListening;

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3 animate-fade-in">
        {/* Quick voice button - one tap to talk */}
        {speechSupported && synthSupported && (
          <button
            onClick={() => {
              autoStartVoiceRef.current = true;
              setIsOpen(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white p-3.5 rounded-2xl shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-110 active:scale-95 group"
            title="Hablar con IA"
          >
            <Phone className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        )}
        {/* Chat button */}
        <button
          onClick={() => setIsOpen(true)}
          className="relative bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-2xl shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 group"
          title="Abrir Chat IA"
        >
          <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-bounce-soft">
            <Sparkles className="w-3 h-3" />
          </span>
          <span className="absolute inset-0 rounded-2xl bg-purple-500 animate-ping opacity-20"></span>
        </button>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl z-50 border border-gray-100 animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 animate-pulse-soft" />
            <span className="font-semibold">Asistente IA</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 w-full h-full sm:w-[400px] sm:h-[600px] bg-white sm:rounded-2xl shadow-2xl shadow-purple-500/10 z-50 flex flex-col border-0 sm:border border-gray-100 animate-scale-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 animate-pulse-soft" />
          </div>
          <div>
            <span className="font-semibold block text-sm">Asistente IA</span>
            <span className="text-[10px] text-white/70">Siempre listo para ayudarte</span>
          </div>
        </div>
        <div className="flex gap-1">
          {chats.length > 0 && (
            <button
              onClick={() => setShowChatsList(!showChatsList)}
              className={`p-2 rounded-lg transition-colors ${showChatsList ? 'bg-white/30' : 'hover:bg-white/20'}`}
              title="Ver conversaciones"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Minimizar"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Cerrar"
          >
            ×
          </button>
        </div>
      </div>

      {/* Chats List */}
      {showChatsList && (
        <div className="border-b border-gray-100 bg-gray-50/80 backdrop-blur p-3 max-h-48 overflow-y-auto animate-fade-in-down">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversaciones</span>
            <button
              onClick={createNewChat}
              className="text-xs bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1.5 rounded-lg hover:shadow-md transition-all active:scale-95"
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
                    ? 'bg-gradient-to-r from-purple-100 to-blue-100 border border-purple-200' 
                    : 'hover:bg-white hover:shadow-sm border border-transparent'
                }`}
                onClick={() => {
                  setCurrentChatId(chat.id);
                  setShowChatsList(false);
                }}
              >
                <span className="text-sm truncate flex-1 text-gray-700">{chat.title}</span>
                {chats.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
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
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/50 to-white overscroll-y-contain">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-12 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-purple-500" />
            </div>
            <p className="font-medium text-gray-700 mb-1">¡Hola! Soy tu asistente IA</p>
            <p className="text-sm text-gray-400 max-w-[200px] mx-auto">Pregúntame sobre tu agenda o pídeme crear eventos y tareas</p>
            
            {/* Quick suggestions */}
            <div className="mt-6 space-y-2">
              <p className="text-xs text-gray-400 mb-2">Prueba diciendo:</p>
              {[
                "¿Qué tengo para hoy?",
                "Crea una reunión mañana a las 3pm",
                "Agregar tarea: Comprar víveres",
                "Recuerda que prefiero reuniones en la mañana"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => sendMessageText(suggestion)}
                  disabled={!currentChatId || loading}
                  className="block w-full text-left text-xs px-3 py-2.5 sm:py-2 bg-white rounded-xl sm:rounded-lg border border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50 transition-all disabled:opacity-50 active:scale-[0.98]"
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
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-md'
                    : 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-md'
                }`}
              >
                {msg.actionExecuted && (
                  <div className={`flex items-center gap-1.5 text-xs mb-1.5 ${msg.role === 'user' ? 'text-white/80' : 'text-green-600'}`}>
                    <CheckCircle className="w-3.5 h-3.5" />
                    {msg.actionType === 'event' && <Calendar className="w-3 h-3" />}
                    {msg.actionType === 'task' && <ListTodo className="w-3 h-3" />}
                    <span>{msg.actionType === 'event' ? 'Evento creado' : 'Tarea creada'}</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.role === 'assistant' ? renderContent(msg.content) : msg.content}</p>
                <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                  {format(msg.timestamp, 'HH:mm')}
                </p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span className="text-sm text-gray-500">Pensando...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 bg-white">
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
                    onClick={cancelVoiceNote}
                    className="p-2.5 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-xl transition-all active:scale-95 shrink-0"
                    title="Cancelar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <input
                    ref={voiceNoteInputRef}
                    type="text"
                    value={voiceNoteTranscript}
                    onChange={(e) => setVoiceNoteTranscript(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        sendVoiceNote();
                      }
                    }}
                    placeholder="Escribe tu mensaje aquí..."
                    autoFocus
                    className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 focus:bg-white transition-all placeholder:text-gray-400 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={sendVoiceNote}
                    disabled={!voiceNoteTranscript.trim()}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-2.5 rounded-xl hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
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
                  onClick={cancelVoiceNote}
                  className="p-2.5 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded-xl transition-all active:scale-95 shrink-0"
                  title="Cancelar"
                >
                  <X className="w-5 h-5" />
                </button>
                <div
                  onClick={() => {
                    setVoiceNoteEditing(true);
                    setTimeout(() => voiceNoteInputRef.current?.focus(), 50);
                  }}
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
                  onClick={sendVoiceNote}
                  disabled={!voiceNoteTranscript.trim()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-2.5 rounded-xl hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0"
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
              handleSend();
            }}
            className="flex gap-2 items-end"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe tu mensaje..."
              rows={1}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white text-sm transition-all placeholder:text-gray-400 resize-none max-h-[120px] overflow-y-auto"
              disabled={loading}
            />
            {speechSupported && (
              <>
                <button
                  type="button"
                  onClick={startVoiceNote}
                  className="p-2.5 rounded-xl transition-all active:scale-95 bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500 shrink-0"
                  disabled={loading}
                  title="Nota de voz"
                >
                  <Mic className="w-5 h-5" />
                </button>
                {synthSupported && (
                  <button
                    type="button"
                    onClick={startLiveVoice}
                    className="p-2.5 rounded-xl transition-all active:scale-95 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-blue-500/25 shrink-0"
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
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-2.5 rounded-xl hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>

      {/* Live Voice Conversation Overlay */}
      {liveVoiceMode && (
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900 via-blue-900 to-purple-900 sm:rounded-2xl flex flex-col z-20 animate-fade-in">
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden sm:rounded-2xl pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-purple-500/8 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 bg-blue-500/8 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
          </div>

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 py-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/60 text-xs font-medium uppercase tracking-widest">Conversación en vivo</span>
            </div>
            <button
              onClick={stopLiveVoice}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>

          {/* Recent messages */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-2 space-y-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.role === 'assistant' ? renderContent(msg.content) : msg.content}</p>
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
          <div className="relative z-10 flex flex-col items-center gap-4 px-6 py-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            {/* Status orb */}
            <div className="relative">
              <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-500 ${
                liveVoiceState === 'listening'
                  ? 'bg-purple-500/30 shadow-[0_0_60px_rgba(168,85,247,0.5)]'
                  : liveVoiceState === 'processing'
                  ? 'bg-yellow-500/30 shadow-[0_0_60px_rgba(234,179,8,0.5)]'
                  : liveVoiceState === 'speaking'
                  ? 'bg-blue-500/30 shadow-[0_0_60px_rgba(59,130,246,0.5)]'
                  : 'bg-gray-500/30'
              }`}>
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                  liveVoiceState === 'listening'
                    ? 'bg-purple-500 animate-pulse'
                    : liveVoiceState === 'processing'
                    ? 'bg-yellow-500'
                    : liveVoiceState === 'speaking'
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-gray-500'
                }`}>
                  {liveVoiceState === 'listening' && <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
                  {liveVoiceState === 'processing' && <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-spin" />}
                  {liveVoiceState === 'speaking' && <Volume2 className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
                  {liveVoiceState === 'idle' && <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-white" />}
                </div>
              </div>
              {liveVoiceState === 'listening' && (
                <div className="absolute inset-0 rounded-full border-2 border-purple-400/50 animate-ping" />
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
              onClick={stopLiveVoice}
              className="bg-red-500 hover:bg-red-600 text-white px-10 py-3.5 rounded-full flex items-center gap-2.5 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all active:scale-95 text-base"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="font-semibold">Finalizar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
