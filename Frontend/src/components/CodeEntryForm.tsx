import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../api/client';

interface CodeEntryFormProps {
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (code: string) => Promise<void>;
}

export default function CodeEntryForm({ label, placeholder, submitLabel, onSubmit }: CodeEntryFormProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(code.trim());
      setCode('');
    } catch (err) {
      if (err instanceof ApiError) {
        // The backend's ValidationError message is a generic "Validation
        // failed" — the useful text ("Incorrect code") is in `fields`.
        const fieldMessage = err.fields ? Object.values(err.fields)[0] : undefined;
        setError(fieldMessage ?? err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2">
      <label className="text-xs font-semibold text-ink/70">{label}</label>
      <div className="flex flex-wrap gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={placeholder}
          inputMode="numeric"
          maxLength={6}
          className="min-w-[140px] flex-1 rounded-full border border-ink/12 bg-bg px-4 py-2.5 text-sm font-mono tracking-[0.15em] text-ink"
        />
        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Checking…' : submitLabel}
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-danger-text">{error}</p>}
    </form>
  );
}
