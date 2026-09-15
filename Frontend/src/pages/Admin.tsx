import { useEffect, useState } from 'react';
import { getAdminUsers, getAdminItems, getAdminStats, suspendUser, reactivateUser, removeItem } from '../api/admin';
import { getReports, reviewReport, removeReportedItem, suspendReportedUser } from '../api/reports';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import type { AdminStats, AdminUserSummary } from '../types/admin';
import type { Item, ItemStatus } from '../types/item';
import type { Report, ReportStatus } from '../types/report';
import type { UserStatus } from '../types/auth';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import ConfirmationModal from '../components/ConfirmationModal';
import ModalShell from '../components/ModalShell';
import { TextareaField } from '../components/FormField';
import Toast, { useToast } from '../components/Toast';

type Tab = 'Reports' | 'Users' | 'Items';

export default function Admin() {
  const { user } = useAuth();
  const { message: toastMessage, showToast } = useToast();

  const [tab, setTab] = useState<Tab>('Reports');
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Shared lookups (fetched once) so report rows can show a reporter/target
  // name and item rows can show an owner name — the admin endpoints
  // themselves are unenriched raw rows.
  const [usersById, setUsersById] = useState<Record<string, AdminUserSummary>>({});
  const [itemsById, setItemsById] = useState<Record<string, Item>>({});

  const [reportStatus, setReportStatus] = useState<ReportStatus>('OPEN');
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportActionId, setReportActionId] = useState<string | null>(null);
  const [suspendReportTarget, setSuspendReportTarget] = useState<Report | null>(null);
  const [removeReportTarget, setRemoveReportTarget] = useState<Report | null>(null);

  const [userStatus, setUserStatus] = useState<UserStatus | ''>('');
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [suspendUserTarget, setSuspendUserTarget] = useState<AdminUserSummary | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);

  const [itemStatus, setItemStatus] = useState<ItemStatus | ''>('');
  const [itemSearch, setItemSearch] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [removeItemTarget, setRemoveItemTarget] = useState<Item | null>(null);
  const [removingItem, setRemovingItem] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  function loadLookups() {
    Promise.all([getAdminUsers({ limit: 50 }), getAdminItems({ limit: 50 })])
      .then(([usersRes, itemsRes]) => {
        setUsersById(Object.fromEntries(usersRes.users.map((u) => [u.id, u])));
        setItemsById(Object.fromEntries(itemsRes.items.map((i) => [i.id, i])));
      })
      .catch(() => {
        // Non-fatal — report rows just fall back to showing raw ids.
      });
  }

  function loadReports() {
    setReportsLoading(true);
    getReports({ status: reportStatus, limit: 50 })
      .then((res) => setReports(res.reports))
      .catch((err: unknown) => showToast(err instanceof ApiError ? err.message : 'Could not load reports.'))
      .finally(() => setReportsLoading(false));
  }

  function loadUsers() {
    setUsersLoading(true);
    getAdminUsers({ status: userStatus || undefined, search: userSearch || undefined, limit: 50 })
      .then((res) => setUsers(res.users))
      .catch((err: unknown) => showToast(err instanceof ApiError ? err.message : 'Could not load users.'))
      .finally(() => setUsersLoading(false));
  }

  function loadItems() {
    setItemsLoading(true);
    getAdminItems({ status: itemStatus || undefined, search: itemSearch || undefined, limit: 50 })
      .then((res) => setItems(res.items))
      .catch((err: unknown) => showToast(err instanceof ApiError ? err.message : 'Could not load items.'))
      .finally(() => setItemsLoading(false));
  }

  useEffect(() => {
    if (!isAdmin) return;
    getAdminStats()
      .then(setStats)
      .catch(() => {
        // Non-fatal — stat tiles just stay hidden.
      });
    loadLookups();
    loadReports();
    loadUsers();
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStatus]);

  useEffect(() => {
    if (isAdmin) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userStatus]);

  useEffect(() => {
    if (isAdmin) loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemStatus]);

  // Frontend gating only decides what renders — the backend's requireAdmin
  // middleware is the real enforcement, independently verified against the
  // live API (see the phase verification notes).
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        <EmptyState title="Not authorized" description="This page is only available to BorrowCircle admins." />
      </main>
    );
  }

  async function handleReview(report: Report) {
    setReportActionId(report.id);
    try {
      await reviewReport(report.id);
      showToast('Report marked reviewed');
      loadReports();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update this report.');
    } finally {
      setReportActionId(null);
    }
  }

  async function confirmRemoveReportedItem() {
    if (!removeReportTarget) return;
    setReportActionId(removeReportTarget.id);
    try {
      await removeReportedItem(removeReportTarget.id);
      showToast('Item removed');
      setRemoveReportTarget(null);
      loadReports();
      loadItems();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not remove this item.');
    } finally {
      setReportActionId(null);
    }
  }

  async function confirmSuspendReportedUser() {
    if (!suspendReportTarget) return;
    setReportActionId(suspendReportTarget.id);
    try {
      await suspendReportedUser(suspendReportTarget.id);
      showToast('User suspended');
      setSuspendReportTarget(null);
      loadReports();
      loadUsers();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not suspend this user.');
    } finally {
      setReportActionId(null);
    }
  }

  async function confirmSuspendUser() {
    if (!suspendUserTarget || !suspendReason.trim()) return;
    setSuspending(true);
    try {
      await suspendUser(suspendUserTarget.id, suspendReason.trim());
      showToast('User suspended');
      setSuspendUserTarget(null);
      setSuspendReason('');
      loadUsers();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not suspend this user.');
    } finally {
      setSuspending(false);
    }
  }

  async function handleReactivateUser(u: AdminUserSummary) {
    try {
      await reactivateUser(u.id);
      showToast('User reactivated');
      loadUsers();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not reactivate this user.');
    }
  }

  async function confirmRemoveItem() {
    if (!removeItemTarget) return;
    setRemovingItem(true);
    try {
      await removeItem(removeItemTarget.id);
      showToast('Item removed');
      setRemoveItemTarget(null);
      loadItems();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not remove this item.');
    } finally {
      setRemovingItem(false);
    }
  }

  const totalItemsCount = stats ? Object.values(stats.totalItemsByStatus).reduce((a, b) => a + b, 0) : 0;

  return (
    <main className="mx-auto max-w-6xl px-5 py-7">
      <h2 className="mb-6 text-[32px]">Admin</h2>

      {stats && (
        <div className="mb-7 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {[
            ['Total users', String(stats.totalUsers)],
            ['Open reports', String(stats.openReports)],
            ['Completed (30d)', String(stats.requestsCompletedLast30Days)],
            ['Total items', String(totalItemsCount)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-tile border border-ink/10 bg-white p-4">
              <p className="mb-1.5 text-xs font-semibold text-ink/60">{label}</p>
              <p className="font-heading text-[26px] leading-none text-ink">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 flex gap-1.5">
        {(['Reports', 'Users', 'Items'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === t ? 'bg-primary text-white' : 'border border-ink/10 bg-white text-ink/70'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Reports' && (
        <div>
          <div className="mb-4 flex gap-2">
            {(['OPEN', 'REVIEWED'] as ReportStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReportStatus(s)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                  reportStatus === s ? 'bg-primary text-white' : 'bg-bg text-ink/70'
                }`}
              >
                {s === 'OPEN' ? 'Open' : 'Reviewed'}
              </button>
            ))}
          </div>

          {reportsLoading ? (
            <p className="text-sm text-ink/50">Loading…</p>
          ) : reports.length === 0 ? (
            <EmptyState title="No reports here" />
          ) : (
            <div className="grid gap-3">
              {reports.map((report) => {
                const reporter = usersById[report.reporterId];
                const targetLabel =
                  report.targetType === 'ITEM'
                    ? itemsById[report.targetId]?.title ?? 'an item'
                    : usersById[report.targetId]?.fullName ?? 'a user';
                return (
                  <div key={report.id} className="rounded-tile border border-ink/10 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-bold text-info-text">{report.targetType}</span>
                      <span className="font-bold text-ink">{targetLabel}</span>
                      <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-semibold text-ink/60">{report.status}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink/70">
                      Reported by <strong>{reporter?.fullName ?? 'a student'}</strong> · {report.reason}
                    </p>
                    {report.note && <p className="mt-1.5 rounded-2xl bg-bg px-3.5 py-2 text-sm text-ink/70">{report.note}</p>}
                    {report.status === 'OPEN' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={reportActionId === report.id}
                          onClick={() => handleReview(report)}
                          className="rounded-full border border-ink/15 px-4 py-1.5 text-sm font-bold hover:bg-ink/5 disabled:opacity-60"
                        >
                          Mark reviewed
                        </button>
                        {report.targetType === 'ITEM' && (
                          <button
                            type="button"
                            onClick={() => setRemoveReportTarget(report)}
                            className="rounded-full bg-danger-text px-4 py-1.5 text-sm font-bold text-white hover:opacity-90"
                          >
                            Remove item
                          </button>
                        )}
                        {report.targetType === 'USER' && (
                          <button
                            type="button"
                            onClick={() => setSuspendReportTarget(report)}
                            className="rounded-full bg-danger-text px-4 py-1.5 text-sm font-bold text-white hover:opacity-90"
                          >
                            Suspend user
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'Users' && (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              placeholder="Search name or email…"
              className="min-w-[220px] flex-1 rounded-full border border-ink/12 bg-white px-4 py-2 text-sm"
            />
            <select
              value={userStatus}
              onChange={(e) => setUserStatus(e.target.value as UserStatus | '')}
              className="rounded-full border border-ink/12 bg-white px-4 py-2 text-sm font-semibold"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DELETED">Deleted</option>
            </select>
            <button type="button" onClick={loadUsers} className="rounded-full border border-ink/15 px-4 py-2 text-sm font-bold hover:bg-ink/5">
              Search
            </button>
          </div>

          {usersLoading ? (
            <p className="text-sm text-ink/50">Loading…</p>
          ) : users.length === 0 ? (
            <EmptyState title="No users match" />
          ) : (
            <div className="grid gap-2.5">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-tile border border-ink/10 bg-white p-4">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-bold text-ink">
                      {u.fullName} {u.role === 'ADMIN' && <span className="ml-1 text-xs text-primary">ADMIN</span>}
                    </p>
                    <p className="text-xs text-ink/55">
                      {u.email} · {u.location}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      u.status === 'ACTIVE' ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'
                    }`}
                  >
                    {u.status}
                  </span>
                  {u.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => setSuspendUserTarget(u)}
                      className="rounded-full bg-danger-text px-4 py-1.5 text-sm font-bold text-white hover:opacity-90"
                    >
                      Suspend
                    </button>
                  ) : u.status === 'SUSPENDED' ? (
                    <button
                      type="button"
                      onClick={() => handleReactivateUser(u)}
                      className="rounded-full border border-ink/15 px-4 py-1.5 text-sm font-bold hover:bg-ink/5"
                    >
                      Reactivate
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'Items' && (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadItems()}
              placeholder="Search title or description…"
              className="min-w-[220px] flex-1 rounded-full border border-ink/12 bg-white px-4 py-2 text-sm"
            />
            <select
              value={itemStatus}
              onChange={(e) => setItemStatus(e.target.value as ItemStatus | '')}
              className="rounded-full border border-ink/12 bg-white px-4 py-2 text-sm font-semibold"
            >
              <option value="">All statuses</option>
              {(['AVAILABLE', 'RESERVED', 'BORROWED', 'OVERDUE', 'PAUSED', 'CANCELLED', 'REMOVED'] as ItemStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="button" onClick={loadItems} className="rounded-full border border-ink/15 px-4 py-2 text-sm font-bold hover:bg-ink/5">
              Search
            </button>
          </div>

          {itemsLoading ? (
            <p className="text-sm text-ink/50">Loading…</p>
          ) : items.length === 0 ? (
            <EmptyState title="No items match" />
          ) : (
            <div className="grid gap-2.5">
              {items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-tile border border-ink/10 bg-white p-4">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-bold text-ink">{item.title}</p>
                    <p className="text-xs text-ink/55">
                      {item.category} · {item.location} · owner: {usersById[item.ownerId]?.fullName ?? item.ownerId}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  {item.status !== 'REMOVED' && (
                    <button
                      type="button"
                      onClick={() => setRemoveItemTarget(item)}
                      className="rounded-full bg-danger-text px-4 py-1.5 text-sm font-bold text-white hover:opacity-90"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {removeReportTarget && (
        <ConfirmationModal
          title="Remove this item?"
          message="The listing is removed immediately and any pending requests on it are cancelled. This can't be undone."
          confirmLabel="Remove item"
          cancelLabel="Cancel"
          danger
          loading={reportActionId === removeReportTarget.id}
          onConfirm={confirmRemoveReportedItem}
          onClose={() => setRemoveReportTarget(null)}
        />
      )}

      {suspendReportTarget && (
        <ConfirmationModal
          title="Suspend this user?"
          message="Their account is suspended immediately, using the report's own reason. This can't be undone from here."
          confirmLabel="Suspend user"
          cancelLabel="Cancel"
          danger
          loading={reportActionId === suspendReportTarget.id}
          onConfirm={confirmSuspendReportedUser}
          onClose={() => setSuspendReportTarget(null)}
        />
      )}

      {removeItemTarget && (
        <ConfirmationModal
          title="Remove this item?"
          message={`"${removeItemTarget.title}" will be removed immediately and any pending requests on it cancelled.`}
          confirmLabel="Remove item"
          cancelLabel="Cancel"
          danger
          loading={removingItem}
          onConfirm={confirmRemoveItem}
          onClose={() => setRemoveItemTarget(null)}
        />
      )}

      {suspendUserTarget && (
        <ModalShell onClose={() => setSuspendUserTarget(null)}>
          <h3 className="mb-1.5 text-2xl">Suspend {suspendUserTarget.fullName}?</h3>
          <p className="mb-4 text-sm text-ink/60">A reason is required and is not shown to the user directly.</p>
          <TextareaField
            label="Reason"
            id="suspendReason"
            rows={3}
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="e.g. Repeated no-shows reported by multiple borrowers."
          />
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={confirmSuspendUser}
              disabled={suspending || !suspendReason.trim()}
              className="flex-1 rounded-full bg-danger-text py-3 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {suspending ? 'Suspending…' : 'Suspend user'}
            </button>
            <button type="button" onClick={() => setSuspendUserTarget(null)} className="rounded-full border border-ink/15 px-5 py-3 text-sm font-bold">
              Cancel
            </button>
          </div>
        </ModalShell>
      )}

      <Toast message={toastMessage} />
    </main>
  );
}
