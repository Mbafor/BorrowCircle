import { createContext } from 'react';

export interface NotificationsContextValue {
  unreadCount: number;
  refreshUnreadCount: () => void;
}

export const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);
