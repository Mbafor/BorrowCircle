import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const inputClass =
  'w-full rounded-full border border-ink/12 bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60';

const textareaClass =
  'w-full resize-y rounded-2xl border border-ink/12 bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
}

export function TextField({ label, id, error, ...props }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink/70">
        {label}
      </label>
      <input id={id} className={inputClass} {...props} />
      {error && <p className="mt-1.5 text-xs font-medium text-danger-text">{error}</p>}
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  id: string;
  error?: string;
}

export function SelectField({ label, id, error, children, ...props }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink/70">
        {label}
      </label>
      <select id={id} className={inputClass} {...props}>
        {children}
      </select>
      {error && <p className="mt-1.5 text-xs font-medium text-danger-text">{error}</p>}
    </div>
  );
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id: string;
  error?: string;
}

export function TextareaField({ label, id, error, ...props }: TextareaFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink/70">
        {label}
      </label>
      <textarea id={id} className={textareaClass} {...props} />
      {error && <p className="mt-1.5 text-xs font-medium text-danger-text">{error}</p>}
    </div>
  );
}

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function PrimaryButton({ loading, disabled, children, ...props }: PrimaryButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className="mt-1 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
