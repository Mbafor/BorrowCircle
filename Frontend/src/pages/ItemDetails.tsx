import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getItem, browseItems } from '../api/items';
import { getPublicProfile } from '../api/users';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import type { BrowseItem, Item } from '../types/item';
import type { PublicProfile } from '../types/user';
import StatusBadge from '../components/StatusBadge';
import UserAvatar from '../components/UserAvatar';
import RatingDisplay from '../components/RatingDisplay';
import ItemCard from '../components/ItemCard';
import EmptyState from '../components/EmptyState';
import RequestModal from '../components/RequestModal';
import ReportModal from '../components/ReportModal';
import Toast, { useToast } from '../components/Toast';
import { CategoryIcon, getCategoryTint } from '../components/categoryVisuals';

const LENDING_GUIDELINES = [
  'Pickup and return happen in person, on campus, at a time you both agree on.',
  "Return the item in the same condition — small scratches are fine, missing parts aren't.",
  'Every handover is confirmed with a code, so nothing is marked returned on trust alone.',
];

function priceParts(item: Item): { big: string; unit: string } {
  if (item.borrowType === 'FREE' || !item.pricePerDay) {
    return { big: 'Free', unit: 'to borrow' };
  }
  return { big: `GHS ${Number.parseFloat(item.pricePerDay).toFixed(0)}`, unit: 'per day' };
}

export default function ItemDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message: toastMessage, showToast } = useToast();

  const [item, setItem] = useState<Item | null>(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [itemError, setItemError] = useState<string | null>(null);

  const [owner, setOwner] = useState<PublicProfile | null>(null);
  const [similar, setSimilar] = useState<BrowseItem[]>([]);

  const [requestOpen, setRequestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setItemLoading(true);
    setItemError(null);
    setItem(null);

    getItem(id)
      .then((res) => {
        if (!cancelled) {
          setItem(res.item);
          setImgIdx(0);
          setImageFailed(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setItemError(err instanceof ApiError ? err.message : 'Could not load this item.');
      })
      .finally(() => {
        if (!cancelled) setItemLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    getPublicProfile(item.ownerId)
      .then((res) => {
        if (!cancelled) setOwner(res.user);
      })
      .catch(() => {
        // Non-fatal — the lender card just falls back to a lighter view.
      });
    return () => {
      cancelled = true;
    };
    // Keyed on ownerId, not the whole item object, so this doesn't refire
    // every time item's own fields (status, etc.) change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.ownerId]);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    browseItems({ category: item.category, limit: 4 })
      .then((res) => {
        if (cancelled) return;
        setSimilar(res.items.filter((candidate) => candidate.id !== item.id).slice(0, 3));
      })
      .catch(() => {
        // Non-fatal — similar items are a bonus section.
      });
    return () => {
      cancelled = true;
    };
    // Keyed on category/id, not the whole item object, for the same reason
    // as the owner-profile effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.category, item?.id]);

  if (itemLoading) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16 text-center text-ink/50">
        <p>Loading item…</p>
      </main>
    );
  }

  if (itemError || !item) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        <EmptyState
          title="Item not found"
          description={itemError ?? 'This listing may have been removed or is no longer available.'}
          actionLabel="Back to explore"
          onAction={() => navigate('/explore')}
        />
      </main>
    );
  }

  const tint = getCategoryTint(item.category);
  const price = priceParts(item);
  const isOwner = !!user && user.id === item.ownerId;
  const isAvailable = item.status === 'AVAILABLE';
  const hasImages = !!item.imageUrls && item.imageUrls.length > 0;
  const guarded = (action: () => void) => (!user ? () => navigate('/login') : action);

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <Link to="/explore" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 hover:text-ink">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        Back to explore
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          {hasImages && !imageFailed ? (
            <img
              src={item.imageUrls![imgIdx]}
              alt={item.title}
              className="h-[360px] w-full rounded-card border border-ink/10 object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div
              className="flex h-[360px] items-center justify-center rounded-card border border-ink/10"
              style={{ background: `linear-gradient(150deg, ${tint.bg} 15%, #FFFFFF 135%)` }}
            >
              <CategoryIcon category={item.category} size={110} />
            </div>
          )}

          {hasImages && item.imageUrls!.length > 1 && (
            <div className="mt-3 flex gap-2.5">
              {item.imageUrls!.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    setImgIdx(index);
                    setImageFailed(false);
                  }}
                  className={`h-16 flex-1 rounded-tile border text-xs font-bold ${
                    imgIdx === index ? 'border-primary bg-info-bg text-primary' : 'border-transparent bg-bg text-ink/45'
                  }`}
                >
                  Photo {index + 1}
                </button>
              ))}
            </div>
          )}

          <div className="mt-7">
            <h4 className="mb-2 text-lg">Description</h4>
            <p className="whitespace-pre-wrap text-[14.5px] text-ink/70">{item.description}</p>
          </div>

          <div className="mt-5">
            <h4 className="mb-2.5 text-lg">Borrowing guidelines</h4>
            <div className="grid gap-2">
              {LENDING_GUIDELINES.map((rule) => (
                <div key={rule} className="flex items-start gap-2.5 text-sm text-ink/70">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-info-bg text-primary">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 self-start lg:sticky lg:top-[76px]">
          <div className="rounded-card border border-ink/10 bg-white p-6">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="rounded-full bg-info-bg px-2.5 py-1 text-xs font-bold text-info-text">{item.category}</span>
              <StatusBadge status={item.status} />
            </div>
            <h2 className="mb-2 text-[28px]">{item.title}</h2>
            <div className="mb-4 flex items-center gap-1.5 text-sm text-ink/60">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
              {item.location}
            </div>
            <div className="mb-5 flex items-baseline gap-1.5">
              <span className="font-heading text-[32px] text-primary">{price.big}</span>
              <span className="text-sm text-ink/55">{price.unit}</span>
            </div>

            {isOwner ? (
              <p className="rounded-full bg-bg px-4 py-3 text-center text-sm font-semibold text-ink/60">This is your own listing</p>
            ) : !user ? (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full rounded-full bg-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Log in to request
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!isAvailable}
                  onClick={guarded(() => setRequestOpen(true))}
                  className="w-full rounded-full bg-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40"
                >
                  {isAvailable ? 'Request to Borrow' : 'Not available right now'}
                </button>
                <p className="mt-2.5 text-center text-xs text-ink/50">
                  {isAvailable
                    ? 'Free to ask — nothing is charged until the lender accepts.'
                    : `This item is ${item.status.toLowerCase()}. Check back later or explore similar items below.`}
                </p>
              </>
            )}
          </div>

          <div className="rounded-card border border-ink/10 bg-white p-5">
            {owner ? (
              <>
                <div className="flex items-center gap-3">
                  <UserAvatar fullName={owner.fullName} imageUrl={owner.profileImageUrl} size={50} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[15.5px] font-bold text-ink">{owner.fullName}</p>
                    <RatingDisplay rating={owner.averageRating} size={13} />
                  </div>
                </div>
                <div className="mt-3.5 flex items-center gap-2 rounded-2xl bg-success-bg px-3 py-2 text-xs font-semibold text-success-text">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3 5 6v5c0 5 3.2 8.3 7 10 3.8-1.7 7-5 7-10V6Z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  Verified KNUST Student
                </div>
                <Link
                  to={`/profile/${owner.id}`}
                  className="mt-3.5 block rounded-full bg-bg py-2.5 text-center text-sm font-bold text-ink/70 transition-colors hover:bg-ink/10"
                >
                  View profile
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-[50px] w-[50px] flex-none animate-pulse rounded-full bg-ink/10" />
                <div className="flex-1">
                  <div className="mb-1.5 h-3.5 w-2/3 animate-pulse rounded-full bg-ink/10" />
                  <div className="h-3 w-1/3 animate-pulse rounded-full bg-ink/10" />
                </div>
              </div>
            )}
            <div className="mt-3.5 text-center">
              <button
                type="button"
                onClick={guarded(() => setReportOpen(true))}
                className="text-xs text-ink/50 underline hover:text-ink/70"
              >
                Report this listing
              </button>
            </div>
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-11">
          <h3 className="mb-4 text-2xl">Similar items nearby</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {similar.map((candidate) => (
              <ItemCard key={candidate.id} item={candidate} />
            ))}
          </div>
        </section>
      )}

      {requestOpen && owner && (
        <RequestModal item={item} ownerName={owner.fullName} onClose={() => setRequestOpen(false)} onSuccess={() => showToast('Request sent')} />
      )}

      {reportOpen && (
        <ReportModal
          targetType="ITEM"
          targetId={item.id}
          onClose={() => setReportOpen(false)}
          onSuccess={() => showToast('Report submitted')}
        />
      )}

      <Toast message={toastMessage} />
    </main>
  );
}
