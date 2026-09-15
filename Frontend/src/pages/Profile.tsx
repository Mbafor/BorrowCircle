import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicProfile, updateMe, uploadProfilePhoto, getReviews } from '../api/users';
import { getMyPendingRatings, createRating } from '../api/ratings';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { LOCATIONS } from '../constants/locations';
import type { PublicProfile, PublicProfileItem } from '../types/user';
import type { PublicReview, PendingRating } from '../types/rating';
import type { Pagination } from '../types/pagination';
import type { BrowseItem } from '../types/item';
import UserAvatar from '../components/UserAvatar';
import RatingDisplay from '../components/RatingDisplay';
import ItemCard from '../components/ItemCard';
import EmptyState from '../components/EmptyState';
import ReportModal from '../components/ReportModal';
import ModalShell from '../components/ModalShell';
import { TextField, SelectField, TextareaField, PrimaryButton } from '../components/FormField';
import Toast, { useToast } from '../components/Toast';

type Tab = 'Listings' | 'Reviews' | 'About';

function toBrowseItem(item: PublicProfileItem, owner: PublicProfile): BrowseItem {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    location: item.location,
    borrowType: item.borrowType,
    pricePerDay: item.pricePerDay,
    status: item.status,
    imageUrl: item.imageUrls?.[0] ?? null,
    ownerId: owner.id,
    ownerName: owner.fullName,
    ownerAverageRating: owner.averageRating,
  };
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function StarPicker({ value, onChange }: { value: number; onChange: (score: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill={n <= value ? '#F59E0B' : 'none'} stroke="#F59E0B" strokeWidth="1.5">
            <path d="m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9 2.9-6Z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { message: toastMessage, showToast } = useToast();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('Listings');
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewsPagination, setReviewsPagination] = useState<Pagination | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [pending, setPending] = useState<PendingRating[]>([]);
  const [ratingTarget, setRatingTarget] = useState<PendingRating | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState<string>(LOCATIONS[0]);
  const [editBio, setEditBio] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);

  const isOwn = !!user && !!id && user.id === id;

  function loadReviews(page: number) {
    if (!id) return;
    setReviewsLoading(true);
    getReviews(id, { page, limit: 10 })
      .then((res) => {
        setReviews((prev) => (page === 1 ? res.reviews : [...prev, ...res.reviews]));
        setReviewsPagination(res.pagination);
      })
      .catch(() => {
        // Non-fatal — the Reviews tab just stays empty.
      })
      .finally(() => setReviewsLoading(false));
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPublicProfile(id)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.user);
        setEditFullName(res.user.fullName);
        setEditPhone(res.user.phoneNumber ?? '');
        setEditLocation(res.user.location);
        setEditBio(res.user.bio ?? '');
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this profile.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    loadReviews(1);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isOwn) {
      setPending([]);
      return;
    }
    getMyPendingRatings()
      .then((res) => setPending(res.pending))
      .catch(() => {
        // Non-fatal — the rating prompt just won't show.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwn]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditFieldErrors({});
    setSaving(true);
    try {
      const res = await updateMe({
        fullName: editFullName.trim(),
        phoneNumber: editPhone.trim(),
        location: editLocation,
        bio: editBio.trim() || null,
      });
      setProfile(res.user);
      setEditing(false);
      showToast('Profile updated');
    } catch (err) {
      if (err instanceof ApiError) {
        setEditFieldErrors(err.fields ?? {});
        showToast(err.message);
      } else {
        showToast('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showToast('Only JPEG, PNG, WEBP, or GIF images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be 5MB or smaller');
      return;
    }

    setUploadingPhoto(true);
    try {
      const res = await uploadProfilePhoto(file);
      setProfile(res.user);
      showToast('Profile photo updated');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not upload that photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function openRatingModal(target: PendingRating) {
    setRatingTarget(target);
    setRatingScore(5);
    setRatingComment('');
    setRatingError(null);
  }

  async function submitRating() {
    if (!ratingTarget) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      await createRating({ borrowRequestId: ratingTarget.borrowRequestId, score: ratingScore, comment: ratingComment.trim() || undefined });
      setPending((prev) => prev.filter((p) => p.borrowRequestId !== ratingTarget.borrowRequestId));
      setRatingTarget(null);
      showToast('Rating submitted');
    } catch (err) {
      setRatingError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setRatingSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-[940px] px-5 py-16 text-center text-ink/50">
        <p>Loading profile…</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="mx-auto max-w-[940px] px-5 py-10">
        <EmptyState title="Profile not found" description={error ?? 'This user could not be found.'} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[940px] px-5 py-7">
      <div className="mb-5 rounded-card border border-ink/10 bg-white p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="relative flex-none">
            <UserAvatar fullName={profile.fullName} imageUrl={profile.profileImageUrl} size={82} />
            {isOwn && (
              <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-white ring-2 ring-white">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M8 8l4-4 4 4" />
                  <path d="M4 18v2h16v-2" />
                </svg>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploadingPhoto} onChange={handlePhotoChange} />
              </label>
            )}
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[28px]">{profile.fullName}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-info-bg px-2.5 py-1 text-xs font-bold text-primary">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 5 6v5c0 5 3.2 8.3 7 10 3.8-1.7 7-5 7-10V6Z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                KNUST verified
              </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/60">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
              {profile.location}
            </p>
            {profile.bio && <p className="mt-3 max-w-[470px] text-[14.5px] text-ink/72">{profile.bio}</p>}
            <div className="mt-4 flex flex-wrap gap-6">
              <div>
                <RatingDisplay rating={profile.averageRating} size={16} className="font-heading text-lg" />
                <p className="text-xs text-ink/55">from {reviewsPagination?.totalItems ?? 0} reviews</p>
              </div>
              <div>
                <p className="font-heading text-lg text-ink">{profile.items.length}</p>
                <p className="text-xs text-ink/55">items listed</p>
              </div>
            </div>
          </div>
          {isOwn && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="flex-none rounded-full bg-bg px-5 py-2.5 text-sm font-bold text-ink/70 transition-colors hover:bg-ink/10"
            >
              {editing ? 'Close' : 'Edit profile'}
            </button>
          )}
        </div>
      </div>

      {isOwn && editing && (
        <div className="mb-5 rounded-card border border-ink/10 bg-white p-6">
          <h4 className="mb-3.5 text-lg">Edit profile</h4>
          <form onSubmit={handleSave} className="grid gap-3.5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <TextField label="Full name" id="fullName" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} error={editFieldErrors.fullName} />
              <TextField label="Phone number" id="phoneNumber" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} error={editFieldErrors.phoneNumber} />
              <SelectField label="Hostel / location" id="location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} error={editFieldErrors.location}>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextareaField label="Bio" id="bio" rows={3} value={editBio} onChange={(e) => setEditBio(e.target.value)} error={editFieldErrors.bio} />
            <div className="flex gap-2.5">
              <PrimaryButton type="submit" loading={saving}>
                Save changes
              </PrimaryButton>
              <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-ink/15 px-6 py-3 text-sm font-bold">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isOwn && pending.length > 0 && (
        <div className="mb-5 rounded-card border border-accent/40 bg-warning-bg p-5">
          <p className="mb-3 font-bold text-warning-text">
            You have {pending.length} completed borrow{pending.length === 1 ? '' : 's'} to rate
          </p>
          <div className="grid gap-2">
            {pending.map((p) => (
              <div key={p.borrowRequestId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-2.5">
                <span className="text-sm text-ink/80">
                  <strong>{p.itemTitle}</strong> with {p.otherParticipantName}
                </span>
                <button
                  type="button"
                  onClick={() => openRatingModal(p)}
                  className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
                >
                  Rate {p.otherParticipantName.split(' ')[0]}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-1.5">
        {(['Listings', 'Reviews', 'About'] as Tab[]).map((t) => (
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

      {tab === 'Listings' &&
        (profile.items.length === 0 ? (
          <EmptyState title="No listings yet" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {profile.items.map((item) => (
              <ItemCard key={item.id} item={toBrowseItem(item, profile)} />
            ))}
          </div>
        ))}

      {tab === 'Reviews' &&
        (reviewsLoading && reviews.length === 0 ? (
          <p className="text-sm text-ink/50">Loading…</p>
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet" />
        ) : (
          <div className="grid gap-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-tile border border-ink/10 bg-white p-5">
                <div className="mb-2.5 flex items-center gap-3">
                  <UserAvatar fullName={review.reviewerName} size={36} />
                  <div className="flex-1">
                    <p className="font-bold text-ink">{review.reviewerName}</p>
                    <p className="text-xs text-ink/55">{formatMonthYear(review.createdAt)}</p>
                  </div>
                  <RatingDisplay rating={review.score} size={13} />
                </div>
                {review.comment && <p className="text-[14.5px] text-ink/75">{review.comment}</p>}
              </div>
            ))}
            {reviewsPagination && reviews.length < reviewsPagination.totalItems && (
              <button
                type="button"
                onClick={() => loadReviews(Math.floor(reviews.length / 10) + 1)}
                disabled={reviewsLoading}
                className="mx-auto rounded-full border border-ink/15 bg-white px-6 py-2.5 text-sm font-bold hover:bg-ink/5 disabled:opacity-60"
              >
                {reviewsLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        ))}

      {tab === 'About' && (
        <div className="rounded-tile border border-ink/10 bg-white p-6">
          <div className="grid gap-3.5">
            <div className="flex gap-4 border-b border-ink/[0.07] pb-3">
              <span className="w-40 flex-none text-xs font-bold uppercase tracking-wider text-ink/45">Location</span>
              <span className="text-sm">{profile.location}</span>
            </div>
            <div className="flex gap-4 border-b border-ink/[0.07] pb-3">
              <span className="w-40 flex-none text-xs font-bold uppercase tracking-wider text-ink/45">Member since</span>
              <span className="text-sm">{formatMonthYear(profile.createdAt)}</span>
            </div>
            <div className="flex gap-4">
              <span className="w-40 flex-none text-xs font-bold uppercase tracking-wider text-ink/45">Verification</span>
              <span className="text-sm">KNUST student email confirmed</span>
            </div>
          </div>
        </div>
      )}

      {!isOwn && (
        <div className="mt-5 text-center">
          <button type="button" onClick={() => setReportOpen(true)} className="text-xs text-ink/50 underline hover:text-ink/70">
            Report this user
          </button>
        </div>
      )}

      {reportOpen && (
        <ReportModal targetType="USER" targetId={profile.id} onClose={() => setReportOpen(false)} onSuccess={() => showToast('Report submitted')} />
      )}

      {ratingTarget && (
        <ModalShell onClose={() => setRatingTarget(null)}>
          <h3 className="mb-1.5 text-2xl">Rate {ratingTarget.otherParticipantName.split(' ')[0]}</h3>
          <p className="mb-4 text-sm text-ink/60">
            For borrowing <strong>{ratingTarget.itemTitle}</strong>.
          </p>
          {ratingError && <p className="mb-3 rounded-2xl bg-danger-bg px-4 py-2.5 text-sm font-medium text-danger-text">{ratingError}</p>}
          <div className="mb-4">
            <StarPicker value={ratingScore} onChange={setRatingScore} />
          </div>
          <TextareaField
            label="Comment (optional)"
            id="ratingComment"
            rows={3}
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder="How did it go?"
          />
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={submitRating}
              disabled={ratingSubmitting}
              className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {ratingSubmitting ? 'Submitting…' : 'Submit rating'}
            </button>
            <button type="button" onClick={() => setRatingTarget(null)} className="rounded-full border border-ink/15 px-5 py-3 text-sm font-bold">
              Cancel
            </button>
          </div>
        </ModalShell>
      )}

      <Toast message={toastMessage} />
    </main>
  );
}
