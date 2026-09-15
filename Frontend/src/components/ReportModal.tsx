import { useState } from 'react';
import type { FormEvent } from 'react';
import ModalShell from './ModalShell';
import { createReport } from '../api/reports';
import { ApiError } from '../api/client';
import type { ReportTargetType } from '../types/report';

const REASONS = [
  'Item is not as described',
  'Suspected scam or fake listing',
  'Prohibited item',
  'Rude or inappropriate behaviour',
  'Something else',
];

interface ReportModalProps {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReportModal({ targetType, targetId, onClose, onSuccess }: ReportModalProps) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function finish() {
    onClose();
    onSuccess();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createReport({ targetType, targetId, reason, note: note.trim() || undefined });
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
        <div className="py-1.5 text-center">
          <div className="mx-auto mb-3.5 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-success-bg text-success-text">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h3 className="mb-2 text-[22px]">Thanks, our team will review this</h3>
          <p className="mb-4 text-[14.5px] text-ink/65">We usually get back within 24 hours.</p>
          <button
            type="button"
            onClick={finish}
            className="rounded-full bg-primary px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
          >
            Done
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 className="mb-1.5 text-2xl">{targetType === 'USER' ? 'Report this user' : 'Report this listing'}</h3>
      <p className="mb-4 text-sm text-ink/60">Reports are private. We only contact you if we need more detail.</p>

      <form onSubmit={handleSubmit} className="grid gap-3.5">
        {error && <p className="rounded-2xl bg-danger-bg px-4 py-2.5 text-sm font-medium text-danger-text">{error}</p>}

        <div>
          <label htmlFor="reason" className="mb-1.5 block text-xs font-semibold text-ink/70">
            Reason
          </label>
          <select
            id="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-full border border-ink/12 bg-bg px-4 py-2.5 text-sm text-ink"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="note" className="mb-1.5 block text-xs font-semibold text-ink/70">
            Note (optional)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add anything that would help us review this."
            rows={3}
            className="w-full resize-y rounded-2xl border border-ink/12 bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink/35"
          />
        </div>

        <div className="flex gap-2.5">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>
          <button type="button" onClick={onClose} className="rounded-full border border-ink/15 px-5 py-3 text-sm font-bold text-ink">
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
