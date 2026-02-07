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
  MessageSquare, Trash2, ChevronRight, ChevronLeft, Minimize2, Maximize2
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
  action: 'create_event' | 'create_task' | 'update_task' | 'delete_task' | 'list_events' | 'list_tasks' | 'remember' | 'none';
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
  };
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
  const [showChatsList, setShowChatsList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

      return { events, tasks };
    } catch (error) {
      console.error('Error getting agenda context:', error);
      return { events: [], tasks: [] };
    }
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
      
      default:
        resultMessage = '';
    }

    return resultMessage;
  };

  const handleSend = async () => {
    if (!input.trim() || !currentChatId || !user) return;
    
    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    
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

      // Obtener contexto
      const agendaContext = await getAgendaContext();

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
            actionType = action.action === 'create_event' ? 'event' : action.action === 'create_task' ? 'task' : undefined;
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
      }
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
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-2xl shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 z-50 group animate-fade-in"
        title="Abrir Chat IA"
      >
        <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-bounce-soft">
          <Sparkles className="w-3 h-3" />
        </span>
        {/* Pulse effect */}
        <span className="absolute inset-0 rounded-2xl bg-purple-500 animate-ping opacity-20"></span>
      </button>
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
    <div className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-white rounded-2xl shadow-2xl shadow-purple-500/10 z-50 flex flex-col border border-gray-100 animate-scale-in overflow-hidden">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/50 to-white">
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
                "Agregar tarea: Comprar víveres"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50 transition-all"
                >
                  "{suggestion}"
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
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white text-sm transition-all placeholder:text-gray-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-2.5 rounded-xl hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transition-all active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
