import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSummary, getLending, getBorrowing } from '../api/dashboard';
import { updateItemStatus } from '../api/items';
import { getMyRequests, confirmReturn } from '../api/requests';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import type { BorrowingRequestItem, DashboardSummary, LendingItem } from '../types/dashboard';
import type { BorrowRequest } from '../types/borrowRequest';
import type { Pagination } from '../types/pagination';
import StatusBadge from '../components/StatusBadge';
import UserAvatar from '../components/UserAvatar';
import EmptyState from '../components/EmptyState';
import ConfirmationModal from '../components/ConfirmationModal';
import HandoverCodeCard from '../components/HandoverCodeCard';
import CodeEntryForm from '../components/CodeEntryForm';
import Toast, { useToast } from '../components/Toast';
import { CategoryIcon, getCategoryTint } from '../components/categoryVisuals';

const PAGE_SIZE = 10;

const STATUS_ACCENTS: Record<string, string> = {
  AVAILABLE: '#12B76A',
  RESERVED: '#F59E0B',
  BORROWED: '#1E2A78',
  OVERDUE: '#F04438',
  PAUSED: '#C8CBD6',
  CANCELLED: '#C8CBD6',
  REMOVED: '#C8CBD6',
};

function cancelWarning(item: LendingItem): string {
  if (item.pendingRequestCount === 0) {
    return 'The listing disappears from Explore straight away. You can always list it again later.';
  }
  if (item.activeRequest?.status === 'PENDING' && item.pendingRequestCount === 1) {
    return `${item.activeRequest.borrowerName} has a pending request for this item. They'll be notified and their request will be cancelled.`;
  }
  return `${item.pendingRequestCount} pending request${item.pendingRequestCount === 1 ? '' : 's'} for this item will be cancelled, and the borrowers notified.`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message: toastMessage, showToast } = useToast();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const [lending, setLending] = useState<LendingItem[]>([]);
  const [lendingPagination, setLendingPagination] = useState<Pagination | null>(null);
  const [lendingLoading, setLendingLoading] = useState(true);

  const [borrowing, setBorrowing] = useState<BorrowingRequestItem[]>([]);
  const [borrowingPagination, setBorrowingPagination] = useState<Pagination | null>(null);
  const [borrowingLoading, setBorrowingLoading] = useState(true);
  // GET /api/dashboard/borrowing doesn't include pickup/return codes or the
  // message — GET /api/requests/mine does (borrower view), so it's fetched
  // separately and joined by request id for the handover UI below.
  const [myRequestsById, setMyRequestsById] = useState<Record<string, BorrowRequest>>({});

  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LendingItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [pausingId, setPausingId] = useState<string | null>(null);

  function loadLending(page: number) {
    setLendingLoading(true);
    getLending({ page, limit: PAGE_SIZE })
      .then((res) => {
        setLending((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        setLendingPagination(res.pagination);
      })
      .catch((err: unknown) => {
        showToast(err instanceof ApiError ? err.message : 'Could not load your listings.');
      })
      .finally(() => setLendingLoading(false));
  }

  function loadBorrowing(page: number) {
    setBorrowingLoading(true);
    getBorrowing({ page, limit: PAGE_SIZE })
      .then((res) => {
        setBorrowing((prev) => (page === 1 ? res.requests : [...prev, ...res.requests]));
        setBorrowingPagination(res.pagination);
      })
      .catch((err: unknown) => {
        showToast(err instanceof ApiError ? err.message : 'Could not load your borrows.');
      })
      .finally(() => setBorrowingLoading(false));
  }

  function loadMyRequests() {
    getMyRequests()
      .then((res) => setMyRequestsById(Object.fromEntries(res.requests.map((r) => [r.id, r]))))
      .catch(() => {
        // Non-fatal — handover/return actions just won't render without codes.
      });
  }

  useEffect(() => {
    getSummary()
      .then(setSummary)
      .catch(() => {
        // Non-fatal — stat tiles just stay hidden.
      });
    loadLending(1);
    loadBorrowing(1);
    loadMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function togglePause(item: LendingItem) {
    setMenuForId(null);
    setPausingId(item.id);
    try {
      await updateItemStatus(item.id, item.status === 'PAUSED' ? 'AVAILABLE' : 'PAUSED');
      showToast(item.status === 'PAUSED' ? 'Listing resumed' : 'Listing paused');
      loadLending(1);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update this listing.');
    } finally {
      setPausingId(null);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await updateItemStatus(cancelTarget.id, 'CANCELLED');
      showToast('Listing cancelled');
      setCancelTarget(null);
      loadLending(1);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not cancel this listing.');
    } finally {
      setCancelling(false);
    }
  }

  const stats: Array<[string, string]> = summary
    ? [
        ['Active borrows', String(summary.activeBorrows)],
        ['Items listed', String(summary.itemsListed)],
        ['Pending requests', String(summary.pendingRequestsToReview)],
        ['Average rating', Number.parseFloat(summary.averageRating).toFixed(1)],
      ]
    : [];

  return (
    <main className="mx-auto max-w-6xl px-5 py-7">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-[32px]">Welcome back{user ? `, ${user.fullName.split(' ')[0]}` : ''}.</h2>
          <p className="mt-1 text-ink/60">Here&rsquo;s what&rsquo;s moving around campus today.</p>
        </div>
        <div className="flex-1" />
        <Link
          to="/create-listing"
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          List New Item
        </Link>
      </div>

      {stats.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-tile border border-ink/10 bg-white p-4">
              <p className="mb-1.5 text-xs font-semibold text-ink/60">{label}</p>
              <p className="font-heading text-[26px] leading-none text-ink">{value}</p>
            </div>
          ))}
        </div>
      )}

      <section className="mb-9">
        <div className="mb-3.5 flex items-center gap-2.5">
          <h3 className="text-xl">Items I&rsquo;m Lending</h3>
          {lendingPagination && (
            <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-bold text-ink/60">{lendingPagination.totalItems}</span>
          )}
        </div>

        {lendingLoading && lending.length === 0 ? (
          <p className="text-sm text-ink/50">Loading…</p>
        ) : lending.length === 0 ? (
          <EmptyState
            title="You haven't listed anything yet"
            description="A spare calculator or lab coat can earn you a few cedis this semester."
            actionLabel="List your first item"
            onAction={() => navigate('/create-listing')}
          />
        ) : (
          <div className="grid gap-3">
            {lending.map((item) => {
              const tint = getCategoryTint(item.category);
              const canManage = item.status === 'AVAILABLE' || item.status === 'PAUSED';
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3.5 rounded-tile border border-ink/10 bg-white p-4"
                  style={{ borderLeft: `4px solid ${STATUS_ACCENTS[item.status] ?? '#C8CBD6'}` }}
                >
                  <div
                    className="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-tile"
                    style={{ background: tint.bg }}
                  >
                    <CategoryIcon category={item.category} size={24} color={tint.fg} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{item.title}</p>
                      <StatusBadge status={item.status} />
                      {item.pendingRequestCount > 0 && (
                        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning-text">
                          {item.pendingRequestCount} pending
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink/60">
                      {item.category} · {item.location}
                    </p>
                    {item.activeRequest && (
                      <div className="mt-2 flex w-fit max-w-full items-center gap-2 rounded-full bg-bg px-3 py-1.5">
                        <UserAvatar fullName={item.activeRequest.borrowerName} size={22} />
                        <span className="truncate text-xs font-semibold text-ink">{item.activeRequest.borrowerName}</span>
                        <StatusBadge status={item.activeRequest.status} variant="request" />
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="relative flex-none">
                      <button
                        type="button"
                        onClick={() => setMenuForId(menuForId === item.id ? null : item.id)}
                        aria-label="Item actions"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-bg"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>
                      {menuForId === item.id && (
                        <div className="absolute right-0 top-9 z-20 w-[168px] rounded-2xl border border-ink/10 bg-white p-1.5 shadow-[0_18px_44px_rgba(22,24,46,0.16)]">
                          <button
                            type="button"
                            disabled={pausingId === item.id}
                            onClick={() => togglePause(item)}
                            className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-bg disabled:opacity-60"
                          >
                            {item.status === 'PAUSED' ? 'Resume listing' : 'Pause listing'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelTarget(item);
                              setMenuForId(null);
                            }}
                            className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-danger-text hover:bg-danger-bg"
                          >
                            Cancel listing
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {lendingPagination && lending.length < lendingPagination.totalItems && (
              <button
                type="button"
                onClick={() => loadLending(Math.floor(lending.length / PAGE_SIZE) + 1)}
                disabled={lendingLoading}
                className="mx-auto rounded-full border border-ink/15 bg-white px-6 py-2.5 text-sm font-bold hover:bg-ink/5 disabled:opacity-60"
              >
                {lendingLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3.5 flex items-center gap-2.5">
          <h3 className="text-xl">Items I&rsquo;ve Borrowed</h3>
          {borrowingPagination && (
            <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-bold text-ink/60">{borrowingPagination.totalItems}</span>
          )}
        </div>

        {borrowingLoading && borrowing.length === 0 ? (
          <p className="text-sm text-ink/50">Loading…</p>
        ) : borrowing.length === 0 ? (
          <EmptyState
            title="You haven't borrowed anything yet"
            description="Explore items nearby and send your first request."
            actionLabel="Explore items"
            onAction={() => navigate('/explore')}
          />
        ) : (
          <div className="grid gap-3">
            {borrowing.map((request) => {
              const tint = getCategoryTint(request.itemCategory);
              const full = myRequestsById[request.id];
              const lenderFirstName = request.lenderName.split(' ')[0];
              return (
                <div key={request.id} className="flex items-start gap-3.5 rounded-tile border border-ink/10 bg-white p-4">
                  <div className="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-tile" style={{ background: tint.bg }}>
                    <CategoryIcon category={request.itemCategory} size={24} color={tint.fg} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/items/${request.itemId}`} className="font-bold text-ink hover:underline">
                        {request.itemTitle}
                      </Link>
                      <StatusBadge status={request.status} variant="request" />
                    </div>
                    <p className="mt-1 text-sm text-ink/60">
                      from {request.lenderName} · {request.pickupDate} → {request.returnDate}
                    </p>

                    {request.status === 'OVERDUE' && (
                      <p className="mt-2.5 rounded-2xl bg-[#FED7AA] px-3.5 py-2 text-sm font-semibold text-[#9A3412]">
                        This is overdue for return.
                      </p>
                    )}

                    {request.status === 'ACCEPTED' && full?.pickupCode && (
                      <div className="mt-3">
                        <HandoverCodeCard
                          label={`Pickup code — show this to ${lenderFirstName} at handover`}
                          code={full.pickupCode}
                          caption={`${lenderFirstName} will type this in to confirm you've picked up "${request.itemTitle}".`}
                        />
                      </div>
                    )}

                    {(request.status === 'BORROWED' || request.status === 'OVERDUE') && (
                      <CodeEntryForm
                        label={`Confirm return — enter the code ${lenderFirstName} reads out to you`}
                        placeholder="123456"
                        submitLabel="Confirm return"
                        onSubmit={async (code) => {
                          await confirmReturn(request.id, code);
                          showToast('Return confirmed — item is available again');
                          loadBorrowing(1);
                          loadMyRequests();
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {borrowingPagination && borrowing.length < borrowingPagination.totalItems && (
              <button
                type="button"
                onClick={() => loadBorrowing(Math.floor(borrowing.length / PAGE_SIZE) + 1)}
                disabled={borrowingLoading}
                className="mx-auto rounded-full border border-ink/15 bg-white px-6 py-2.5 text-sm font-bold hover:bg-ink/5 disabled:opacity-60"
              >
                {borrowingLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </section>

      {cancelTarget && (
        <ConfirmationModal
          title="Cancel this listing?"
          message={cancelWarning(cancelTarget)}
          confirmLabel="Cancel listing"
          cancelLabel="Keep it"
          danger
          loading={cancelling}
          onConfirm={confirmCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}

      <Toast message={toastMessage} />
    </main>
  );
}
