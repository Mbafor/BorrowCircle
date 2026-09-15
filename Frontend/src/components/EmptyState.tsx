import type { ReactNode } from 'react';

const DEFAULT_ICON = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}

export default function EmptyState({ title, description, actionLabel, onAction, icon, className = '' }: EmptyStateProps) {
  return (
    <div className={`rounded-card border border-dashed border-ink/20 px-6 py-14 text-center text-ink/35 ${className}`}>
      <div className="mx-auto mb-4 flex h-[70px] w-[70px] items-center justify-center rounded-full bg-ink/5 text-ink/35">
        {icon ?? DEFAULT_ICON}
      </div>
      <p className="mb-1.5 font-heading text-xl text-ink">{title}</p>
      {description && <p className="mx-auto mb-5 max-w-[330px] text-sm text-ink/60">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
