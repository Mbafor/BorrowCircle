import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getUnreadCount } from '../api/notifications';
import { useAuth } from '../auth/useAuth';
import { NotificationsContext } from './NotificationsContext';

// Polled, not hammered: once on login, then every 30s while logged in, plus
// an on-demand refresh() call after mark-read/mark-all-read actions.
const POLL_INTERVAL_MS = 30000;

export default function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(() => {
    if (!user) return;
    getUnreadCount()
      .then((res) => setUnreadCount(res.count))
      .catch(() => {
        // Non-fatal — the badge just keeps its last known value.
      });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    refreshUnreadCount();
    const interval = window.setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [user, refreshUnreadCount]);

  const value = useMemo(() => ({ unreadCount, refreshUnreadCount }), [unreadCount, refreshUnreadCount]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
