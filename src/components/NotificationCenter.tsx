'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Calendar, ListTodo, DollarSign, Sparkles, Info, X, Clock } from 'lucide-react';
import { useNotificationsStore, type AppNotification, type NotificationType } from '@/stores/notificationsStore';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'event_reminder':
      return <Calendar className="w-4 h-4 text-blue-500" />;
    case 'task_due':
      return <Clock className="w-4 h-4 text-orange-500" />;
    case 'task_overdue':
      return <ListTodo className="w-4 h-4 text-red-500" />;
    case 'finance_alert':
      return <DollarSign className="w-4 h-4 text-green-500" />;
    case 'ai_insight':
      return <Sparkles className="w-4 h-4 text-purple-500" />;
    case 'system':
    default:
      return <Info className="w-4 h-4 text-gray-500" />;
  }
}

function getNotificationBg(type: NotificationType, read: boolean) {
  if (read) return 'bg-white dark:bg-surface';
  switch (type) {
    case 'event_reminder':
      return 'bg-blue-50/80 dark:bg-blue-900/15';
    case 'task_due':
      return 'bg-orange-50/80 dark:bg-orange-900/15';
    case 'task_overdue':
      return 'bg-red-50/80 dark:bg-red-900/15';
    case 'finance_alert':
      return 'bg-green-50/80 dark:bg-green-900/15';
    case 'ai_insight':
      return 'bg-purple-50/80 dark:bg-purple-900/15';
    default:
      return 'bg-gray-50/80 dark:bg-gray-800/30';
  }
}

function NotificationItem({ notification, onMarkRead, onRemove }: {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const timeAgo = formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: es });

  return (
    <div
      className={`group relative flex gap-3 px-4 py-3 border-b border-gray-100 dark:border-border-custom last:border-0 transition-all hover:bg-gray-50 dark:hover:bg-surface-secondary ${
        getNotificationBg(notification.type, notification.read)
      }`}
    >
      {/* Unread dot */}
      {!notification.read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
      )}

      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-white dark:bg-surface border border-gray-100 dark:border-border-custom flex items-center justify-center shadow-sm">
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${
          notification.read 
            ? 'text-gray-600 dark:text-gray-400' 
            : 'text-gray-900 dark:text-foreground font-medium'
        }`}>
          {notification.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-text-tertiary mt-0.5 line-clamp-2">
          {notification.body}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {timeAgo}
        </p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.read && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 transition-colors"
            title="Marcar como leído"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(notification.id); }}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 transition-colors"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { notifications, unreadCount, subscribe, markRead, markAllRead, remove, clearRead } = useNotificationsStore();

  // Subscribe to notifications on mount
  useEffect(() => {
    if (user?.uid) {
      subscribe(user.uid);
    }
  }, [user?.uid, subscribe]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try { await markRead(id); } catch (e) { console.error(e); }
  };

  const handleRemove = async (id: string) => {
    try { await remove(id); } catch (e) { console.error(e); }
  };

  const handleMarkAllRead = async () => {
    try { await markAllRead(); } catch (e) { console.error(e); }
  };

  const handleClearRead = async () => {
    try { await clearRead(); } catch (e) { console.error(e); }
  };

  const readCount = notifications.filter((n) => n.read).length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-foreground hover:bg-gray-100 dark:hover:bg-surface-secondary transition-all"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg animate-bounce-in ring-2 ring-white dark:ring-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white dark:bg-surface rounded-2xl shadow-2xl border border-gray-200 dark:border-border-custom overflow-hidden z-50 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-border-custom bg-gray-50/50 dark:bg-surface-secondary/50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-navy dark:text-brand-blue" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-foreground">
                Notificaciones
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  Leer todo
                </button>
              )}
              {readCount > 0 && (
                <button
                  onClick={handleClearRead}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-secondary rounded-lg transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpiar
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-foreground hover:bg-gray-100 dark:hover:bg-surface-secondary rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-surface-secondary flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Sin notificaciones</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Te avisaremos cuando algo importante ocurra</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                  onRemove={handleRemove}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
