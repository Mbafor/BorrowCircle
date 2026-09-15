import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import ModalShell from './ModalShell';
import { createRequest } from '../api/requests';
import { ApiError } from '../api/client';
import type { Item } from '../types/item';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`).getTime();
  const end = new Date(`${endIso}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86400000));
}

interface RequestModalProps {
  item: Item;
  ownerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RequestModal({ item, ownerName, onClose, onSuccess }: RequestModalProps) {
  const initialPickup = addDays(todayIso(), 1);

  const [pickupDate, setPickupDate] = useState(initialPickup);
  const [returnDate, setReturnDate] = useState(addDays(initialPickup, 3));
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isFree = item.borrowType === 'FREE' || !item.pricePerDay;
  const days = daysBetween(pickupDate, returnDate);
  const total = isFree ? 'GHS 0' : `GHS ${(days * Number.parseFloat(item.pricePerDay ?? '0')).toFixed(0)}`;

  function finish() {
    onClose();
    onSuccess();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createRequest({ itemId: item.id, pickupDate, returnDate, message: message.trim() || undefined });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <ModalShell onClose={finish}>
        <div className="py-1 text-center">
          <div className="mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-success-bg text-success-text">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h3 className="mb-2 text-[22px]">Request sent</h3>
          <p className="mb-5 text-[14.5px] text-ink/65">
            {ownerName} has 24 hours to respond before the request expires. You&rsquo;ll find it under Items I&rsquo;ve
            Borrowed.
          </p>
          <div className="flex gap-2.5">
            <Link
              to="/dashboard"
              onClick={finish}
              className="flex-1 rounded-full bg-primary py-3 text-center text-sm font-bold text-white hover:bg-primary-hover"
            >
              Go to dashboard
            </Link>
            <button type="button" onClick={finish} className="rounded-full border border-ink/15 px-5 py-3 text-sm font-bold text-ink">
              Close
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 className="mb-1.5 text-2xl">Request to borrow</h3>
      <p className="mb-4 text-sm text-ink/60">{ownerName} gets a notification and can accept or decline.</p>

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-bg p-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{item.title}</p>
          <p className="text-xs text-ink/55">
            {item.category} · {item.location}
          </p>
        </div>
        <p className="flex-none text-sm font-bold text-primary">{isFree ? 'Free' : `GHS ${item.pricePerDay}/day`}</p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3.5">
        {error && <p className="rounded-2xl bg-danger-bg px-4 py-2.5 text-sm font-medium text-danger-text">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pickupDate" className="mb-1.5 block text-xs font-semibold text-ink/70">
              Pickup date
            </label>
            <input
              id="pickupDate"
              type="date"
              required
              value={pickupDate}
              min={todayIso()}
              onChange={(event) => {
                const value = event.target.value;
                setPickupDate(value);
                if (returnDate <= value) setReturnDate(addDays(value, 1));
              }}
              className="w-full rounded-full border border-ink/12 bg-bg px-4 py-2.5 text-sm text-ink"
            />
          </div>
          <div>
            <label htmlFor="returnDate" className="mb-1.5 block text-xs font-semibold text-ink/70">
              Return date
            </label>
            <input
              id="returnDate"
              type="date"
              required
              value={returnDate}
              min={addDays(pickupDate, 1)}
              onChange={(event) => setReturnDate(event.target.value)}
              className="w-full rounded-full border border-ink/12 bg-bg px-4 py-2.5 text-sm text-ink"
            />
          </div>
        </div>

        <div>
          <label htmlFor="message" className="mb-1.5 block text-xs font-semibold text-ink/70">
            Message (optional)
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Hi! I need this for the Thursday quiz."
            rows={3}
            className="w-full resize-y rounded-2xl border border-ink/12 bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink/35"
          />
        </div>

        <div className="flex items-baseline justify-between border-t border-ink/[0.09] pt-3.5">
          <span className="text-sm text-ink/60">
            {days} {days === 1 ? 'day' : 'days'}
            {isFree ? ' · free to borrow' : ` × GHS ${item.pricePerDay}/day`}
          </span>
          <span className="font-heading text-xl text-primary">{total}</span>
        </div>

        <div className="flex gap-2.5">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send request'}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-ink/15 px-5 py-3 text-sm font-bold text-ink">
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
