import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api } from './api';
import { useAuth } from './auth';

type Ctx = {
  count: number;
  refresh: () => Promise<void>;
};

const NotifContext = createContext<Ctx>({ count: 0, refresh: async () => {} });

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const timer = useRef<any>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const r = await api.unreadCount();
      setCount(r?.count || 0);
    } catch {
      // ignore
    }
  }, [user]);

  // Poll every 30s while signed in & app is foregrounded
  useEffect(() => {
    refresh();
    if (timer.current) clearInterval(timer.current);
    if (user) {
      timer.current = setInterval(refresh, 30000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [user, refresh]);

  // Also refresh when the app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return <NotifContext.Provider value={{ count, refresh }}>{children}</NotifContext.Provider>;
}

export function useNotifications() {
  return useContext(NotifContext);
}
