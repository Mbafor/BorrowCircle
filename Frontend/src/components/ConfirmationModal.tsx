import ModalShell from './ModalShell';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmationModal({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep it',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  return (
    <ModalShell onClose={onClose}>
      <div className={`mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-full ${danger ? 'bg-danger-bg text-danger-text' : 'bg-info-bg text-primary'}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          {danger ? (
            <>
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </>
          ) : (
            <path d="M20 6 9 17l-5-5" />
          )}
        </svg>
      </div>
      <h3 className="mb-2 text-[23px]">{title}</h3>
      <p className="mb-4 text-[14.5px] text-ink/70">{message}</p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 rounded-full py-3 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            danger ? 'bg-danger-text hover:opacity-90' : 'bg-primary hover:bg-primary-hover'
          }`}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </button>
        <button type="button" onClick={onClose} className="rounded-full border border-ink/15 px-5 py-3 text-sm font-bold text-ink">
          {cancelLabel}
        </button>
      </div>
    </ModalShell>
  );
}
