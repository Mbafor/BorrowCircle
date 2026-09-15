export type NotificationType =
  | 'REQUEST_SENT'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_DECLINED'
  | 'REQUEST_CANCELLED'
  | 'REQUEST_EXPIRED'
  | 'ITEM_CANCELLED'
  | 'HANDOVER_CONFIRMED'
  | 'RETURN_CONFIRMED'
  | 'OVERDUE'
  | 'RATING_RECEIVED'
  | 'ACCOUNT_SUSPENDED';

export type NotificationTargetType = 'ITEM' | 'BORROW_REQUEST' | 'USER';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  targetType: NotificationTargetType;
  targetId: string;
  isRead: boolean;
  createdAt: string;
}
