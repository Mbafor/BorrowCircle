import { useEffect, useState } from 'react';
import { getIncomingRequests, acceptRequest, declineRequest, confirmPickup } from '../api/requests';
import { getItem } from '../api/items';
import { getPublicProfile } from '../api/users';
import { ApiError } from '../api/client';
import type { BorrowRequest, BorrowRequestStatus } from '../types/borrowRequest';
import type { Item } from '../types/item';
import type { PublicProfile } from '../types/user';
import UserAvatar from '../components/UserAvatar';
import RatingDisplay from '../components/RatingDisplay';
import StatusBadge from '../components/StatusBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import HandoverCodeCard from '../components/HandoverCodeCard';
import CodeEntryForm from '../components/CodeEntryForm';
import EmptyState from '../components/EmptyState';
import Toast, { useToast } from '../components/Toast';

// GET /api/requests/incoming takes exactly one status per call (default
// PENDING) — there's no "all active requests" query. To show one coherent
// inbox like the design, fetch every status worth acting on in parallel
// and merge them, newest first.
const INBOX_STATUSES: BorrowRequestStatus[] = ['PENDING', 'ACCEPTED', 'BORROWED', 'OVERDUE'];

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`).getTime();
  const end = new Date(`${endIso}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86400000));
}

export default function Requests() {
  const { message: toastMessage, showToast } = useToast();

  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [itemsById, setItemsById] = useState<Record<string, Item>>({});
  const [borrowersById, setBorrowersById] = useState<Record<string, PublicProfile>>({});
  const [loading, setLoading] = useState(true);

  const [acceptTarget, setAcceptTarget] = useState<BorrowRequest | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all(INBOX_STATUSES.map((status) => getIncomingRequests({ status })))
      .then(async (results) => {
        const merged = results
          .flatMap((r) => r.requests)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRequests(merged);

        const itemIds = [...new Set(merged.map((r) => r.itemId))];
        const borrowerIds = [...new Set(merged.map((r) => r.borrowerId))];

        const [itemResults, borrowerResults] = await Promise.all([
          Promise.all(itemIds.map((id) => getItem(id).then((res) => res.item).catch(() => null))),
          Promise.all(borrowerIds.map((id) => getPublicProfile(id).then((res) => res.user).catch(() => null))),
        ]);

        setItemsById(Object.fromEntries(itemResults.filter((i): i is Item => !!i).map((i) => [i.id, i])));
        setBorrowersById(Object.fromEntries(borrowerResults.filter((u): u is PublicProfile => !!u).map((u) => [u.id, u])));
      })
      .catch((err: unknown) => {
        showToast(err instanceof ApiError ? err.message : 'Could not load your requests.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDecline(request: BorrowRequest) {
    setDecliningId(request.id);
    try {
      await declineRequest(request.id);
      showToast('Request declined');
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not decline this request.');
    } finally {
      setDecliningId(null);
    }
  }

  async function confirmAccept() {
    if (!acceptTarget) return;
    setAccepting(true);
    try {
      await acceptRequest(acceptTarget.id);
      showToast('Request accepted');
      setAcceptTarget(null);
      load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not accept this request.');
    } finally {
      setAccepting(false);
    }
  }

  const otherPendingForSameItem = acceptTarget
    ? requests.filter((r) => r.itemId === acceptTarget.itemId && r.id !== acceptTarget.id && r.status === 'PENDING').length
    : 0;

  return (
    <main className="mx-auto max-w-[940px] px-5 py-7">
      <h2 className="text-[32px]">Incoming requests</h2>
      <p className="mb-6 mt-1 text-ink/60">Students asking to borrow your listings.</p>

      {loading && requests.length === 0 ? (
        <p className="text-sm text-ink/50">Loading…</p>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No borrow requests yet"
          description="Listings with clear photos and a fair daily price get requests fastest."
        />
      ) : (
        <div className="grid gap-3.5">
          {requests.map((request) => {
            const item = itemsById[request.itemId];
            const borrower = borrowersById[request.borrowerId];
            const days = daysBetween(request.pickupDate, request.returnDate);
            const isFree = !item || item.borrowType === 'FREE' || !item.pricePerDay;
            const total = isFree ? 'Free' : `GHS ${(days * Number.parseFloat(item!.pricePerDay ?? '0')).toFixed(0)}`;
            const firstName = borrower?.fullName.split(' ')[0] ?? 'the borrower';

            return (
              <div
                key={request.id}
                className={`rounded-card border p-5 ${
                  request.status === 'OVERDUE' ? 'border-[#FDA29B] bg-[#FFFBFA]' : 'border-ink/10 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start gap-3.5">
                  {borrower && <UserAvatar fullName={borrower.fullName} imageUrl={borrower.profileImageUrl} size={48} />}
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{borrower?.fullName ?? 'A student'}</span>
                      {borrower && <RatingDisplay rating={borrower.averageRating} size={12} />}
                      <StatusBadge status={request.status} variant="request" />
                    </div>
                    <p className="mt-1 text-sm text-ink/65">
                      wants to borrow <span className="font-bold text-ink">{item?.title ?? 'an item'}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-ink/40">Pickup</p>
                        <p className="text-sm font-semibold">{request.pickupDate}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-ink/40">Return</p>
                        <p className="text-sm font-semibold">{request.returnDate}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-ink/40">Total</p>
                        <p className="text-sm font-semibold">{total}</p>
                      </div>
                    </div>

                    {request.message && (
                      <p className="mt-3 rounded-2xl bg-bg px-3.5 py-2.5 text-sm italic text-ink/75">&ldquo;{request.message}&rdquo;</p>
                    )}

                    {request.status === 'OVERDUE' && (
                      <p className="mt-3 rounded-2xl bg-[#FED7AA] px-3.5 py-2.5 text-sm font-semibold text-[#9A3412]">
                        This item is overdue for return.
                      </p>
                    )}

                    {request.status === 'PENDING' && (
                      <div className="mt-3.5 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setAcceptTarget(request)}
                          className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={decliningId === request.id}
                          onClick={() => handleDecline(request)}
                          className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-ink/5 disabled:opacity-60"
                        >
                          {decliningId === request.id ? 'Declining…' : 'Decline'}
                        </button>
                      </div>
                    )}

                    {request.status === 'ACCEPTED' && (
                      <CodeEntryForm
                        label={`Confirm handover — enter the code ${firstName} reads out to you`}
                        placeholder="123456"
                        submitLabel="Confirm handover"
                        onSubmit={async (code) => {
                          await confirmPickup(request.id, code);
                          showToast('Handover confirmed — item is now Borrowed');
                          load();
                        }}
                      />
                    )}

                    {(request.status === 'BORROWED' || request.status === 'OVERDUE') && request.returnCode && (
                      <div className="mt-3.5">
                        <HandoverCodeCard
                          label={`Return code — ask ${firstName} for this at return`}
                          code={request.returnCode}
                          caption={`Read this out to ${firstName} once they bring "${item?.title ?? 'the item'}" back.`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {acceptTarget && (
        <ConfirmationModal
          title={`Accept ${borrowersById[acceptTarget.borrowerId]?.fullName.split(' ')[0] ?? 'this'}'s request?`}
          message={
            otherPendingForSameItem > 0
              ? `Accepting this will automatically decline the other ${otherPendingForSameItem} pending request${otherPendingForSameItem === 1 ? '' : 's'} for the same item.`
              : "Accepting this will generate a pickup code for the borrower to show you at handover."
          }
          confirmLabel="Yes, accept"
          cancelLabel="Back"
          loading={accepting}
          onConfirm={confirmAccept}
          onClose={() => setAcceptTarget(null)}
        />
      )}

      <Toast message={toastMessage} />
    </main>
  );
}
