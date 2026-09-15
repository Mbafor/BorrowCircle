import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    setMessage(msg);
    timeoutRef.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);

  return { message, showToast };
}

interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
      <div className="flex max-w-[90vw] items-center gap-2.5 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(22,24,46,0.3)]">
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent text-ink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        {message}
      </div>
    </div>
  );
}
