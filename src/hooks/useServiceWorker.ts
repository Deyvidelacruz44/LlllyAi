'use client';

import { useEffect, useState, useCallback } from 'react';

interface CustomNotificationOptions {
  title: string;
  body: string;
  url?: string;
}

export function useServiceWorker() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      setIsSupported(true);
      
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          setRegistration(reg);
          
          // Check if already subscribed
          reg.pushManager.getSubscription().then((sub) => {
            setIsSubscribed(!!sub);
          });
        })
        .catch((error) => {
          console.error('Error registrando Service Worker:', error);
        });
    }
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error solicitando permiso de notificaciones:', error);
      return false;
    }
  }, [isSupported]);

  const showLocalNotification = useCallback(
    async ({ title, body, url }: CustomNotificationOptions) => {
      if (!registration) return;
      
      const permission = await requestNotificationPermission();
      if (!permission) return;

      registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        data: { url: url || '/dashboard' },
      });
    },
    [registration, requestNotificationPermission]
  );

  const scheduleNotification = useCallback(
    async (options: CustomNotificationOptions, delayMs: number) => {
      if (!isSupported) return null;
      
      const permission = await requestNotificationPermission();
      if (!permission) return null;

      const timeoutId = setTimeout(() => {
        showLocalNotification(options);
      }, delayMs);

      return timeoutId;
    },
    [isSupported, requestNotificationPermission, showLocalNotification]
  );

  return {
    isSupported,
    isSubscribed,
    registration,
    requestNotificationPermission,
    showLocalNotification,
    scheduleNotification,
  };
}

// Hook para gestionar recordatorios de eventos
export function useEventReminders() {
  const { showLocalNotification, isSupported } = useServiceWorker();
  const [scheduledReminders, setScheduledReminders] = useState<Map<string, NodeJS.Timeout>>(new Map());

  const scheduleReminder = useCallback(
    (eventId: string, eventTitle: string, eventDate: Date, minutesBefore: number = 15) => {
      if (!isSupported) return;

      const reminderTime = new Date(eventDate.getTime() - minutesBefore * 60 * 1000);
      const now = new Date();
      const delay = reminderTime.getTime() - now.getTime();

      // Only schedule if the reminder is in the future
      if (delay > 0) {
        const timeoutId = setTimeout(() => {
          showLocalNotification({
            title: '⏰ Recordatorio',
            body: `"${eventTitle}" comienza en ${minutesBefore} minutos`,
            url: '/dashboard',
          });
          scheduledReminders.delete(eventId);
        }, delay);

        setScheduledReminders((prev) => {
          const newMap = new Map(prev);
          // Clear existing reminder for this event
          const existing = newMap.get(eventId);
          if (existing) clearTimeout(existing);
          newMap.set(eventId, timeoutId);
          return newMap;
        });
      }
    },
    [isSupported, showLocalNotification, scheduledReminders]
  );

  const cancelReminder = useCallback((eventId: string) => {
    const timeoutId = scheduledReminders.get(eventId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      setScheduledReminders((prev) => {
        const newMap = new Map(prev);
        newMap.delete(eventId);
        return newMap;
      });
    }
  }, [scheduledReminders]);

  const cancelAllReminders = useCallback(() => {
    scheduledReminders.forEach((timeoutId) => clearTimeout(timeoutId));
    setScheduledReminders(new Map());
  }, [scheduledReminders]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scheduledReminders.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, [scheduledReminders]);

  return {
    scheduleReminder,
    cancelReminder,
    cancelAllReminders,
    activeReminders: scheduledReminders.size,
  };
}
