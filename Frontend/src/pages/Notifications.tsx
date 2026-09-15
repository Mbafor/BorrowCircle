import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markRead as markOneRead, markAllRead as markAllOfThemRead } from '../api/notifications';
import { useAuth } from '../auth/useAuth';
import { useNotifications } from '../notifications/useNotifications';
import type { Notification, NotificationType } from '../types/notification';
import type { Pagination } from '../types/pagination';
import EmptyState from '../components/EmptyState';

const PAGE_SIZE = 20;

const TYPE_STYLE: Record<NotificationType, { bg: string; fg: string; path: string }> = {
  REQUEST_SENT: { bg: '#E8EAF6', fg: '#1E2A78', path: 'M3 13h5l2 3h4l2-3h5|M5 5h14l2 8v6H3v-6l2-8Z' },
  REQUEST_ACCEPTED: { bg: '#DCFCE7', fg: '#166534', path: 'M20 6 9 17l-5-5' },
  REQUEST_DECLINED: { bg: '#FEE2E2', fg: '#B42318', path: 'M18 6 6 18M6 6l12 12' },
  REQUEST_CANCELLED: { bg: '#FEE2E2', fg: '#B42318', path: 'M18 6 6 18M6 6l12 12' },
  REQUEST_EXPIRED: { bg: '#EFEFF3', fg: '#4B4F63', path: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0|M12 7v5l3.5 2' },
  ITEM_CANCELLED: { bg: '#EFEFF3', fg: '#4B4F63', path: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 0 1-3.46 0' },
  HANDOVER_CONFIRMED: { bg: '#DCFCE7', fg: '#166534', path: 'M20 6 9 17l-5-5' },
  RETURN_CONFIRMED: { bg: '#DCFCE7', fg: '#166534', path: 'M20 6 9 17l-5-5' },
  OVERDUE: { bg: '#FEF3C7', fg: '#8C4A17', path: 'M12 9v4M12 17h.01|M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' },
  RATING_RECEIVED: { bg: '#DCFCE7', fg: '#166534', path: 'm12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9 2.9-6Z' },
  ACCOUNT_SUSPENDED: { bg: '#FEE2E2', fg: '#B42318', path: 'M12 9v4M12 17h.01|M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' },
};

function notificationHref(n: Notification, currentUserId: string): string {
  if (n.targetType === 'ITEM') return `/items/${n.targetId}`;
  if (n.targetType === 'USER') return `/profile/${n.targetId}`;
  // BORROW_REQUEST: route by what the notification is about, since there's
  // no single "request detail" page — REQUEST_SENT is something the owner
  // needs to act on (accept/decline lives on /requests); a rating prompt
  // points at the recipient's own profile; everything else (accepted,
  // declined, handover/return confirmations, overdue) is visible on
  // /dashboard for either role.
  if (n.type === 'REQUEST_SENT') return '/requests';
  if (n.type === 'RATING_RECEIVED') return `/profile/${currentUserId}`;
  return '/dashboard';
}

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshUnreadCount } = useNotifications();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  function load(page: number) {
    setLoading(true);
    getNotifications({ page, limit: PAGE_SIZE })
      .then((res) => {
        setNotifications((prev) => (page === 1 ? res.notifications : [...prev, ...res.notifications]));
        setPagination(res.pagination);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick(notification: Notification) {
    if (!notification.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      try {
        await markOneRead(notification.id);
        refreshUnreadCount();
      } catch {
        // Non-fatal — navigation still proceeds either way.
      }
    }
    if (user) navigate(notificationHref(notification, user.id));
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await markAllOfThemRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshUnreadCount();
    } finally {
      setMarkingAll(false);
    }
  }

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <main className="mx-auto max-w-[780px] px-5 py-7">
      <div className="mb-5 flex flex-wrap items-center gap-3.5">
        <h2 className="text-[32px]">Notifications</h2>
        {unread > 0 && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-ink">{unread} new</span>}
        <div className="flex-1" />
        {unread > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={markingAll}
            className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-bold transition-colors hover:bg-ink/5 disabled:opacity-60"
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <p className="text-sm text-ink/50">Loading…</p>
      ) : notifications.length === 0 ? (
        <EmptyState title="You're all caught up" description="Requests, handovers and returns will show up here." />
      ) : (
        <div className="grid gap-2.5">
          {notifications.map((notification) => {
            const style = TYPE_STYLE[notification.type];
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleClick(notification)}
                className={`flex items-start gap-3.5 rounded-tile border p-4 text-left transition-colors ${
                  notification.isRead ? 'border-ink/[0.07] bg-[#FAFAFC]' : 'border-primary/15 bg-white'
                }`}
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full" style={{ background: style.bg, color: style.fg }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    {style.path.split('|').map((p) => (
                      <path key={p} d={p} />
                    ))}
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[14.5px] leading-snug ${notification.isRead ? 'font-medium text-ink/80' : 'font-bold text-ink'}`}>{notification.message}</p>
                  <p className="mt-0.5 text-xs text-ink/48">{formatWhen(notification.createdAt)}</p>
                </div>
                {!notification.isRead && <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full bg-accent" />}
              </button>
            );
          })}
          {pagination && notifications.length < pagination.totalItems && (
            <button
              type="button"
              onClick={() => load(Math.floor(notifications.length / PAGE_SIZE) + 1)}
              disabled={loading}
              className="mx-auto rounded-full border border-ink/15 bg-white px-6 py-2.5 text-sm font-bold hover:bg-ink/5 disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
