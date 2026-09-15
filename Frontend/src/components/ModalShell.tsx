import type { MouseEvent, ReactNode } from 'react';

interface ModalShellProps {
  onClose: () => void;
  children: ReactNode;
}

export default function ModalShell({ onClose, children }: ModalShellProps) {
  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-ink/50 backdrop-blur-[3px]" onClick={onClose} />
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-5" style={{ pointerEvents: 'none' }}>
        <div
          onClick={stop}
          style={{ pointerEvents: 'auto' }}
          className="max-h-[88vh] w-full max-w-[460px] overflow-auto rounded-card bg-white p-6 shadow-[0_18px_44px_rgba(22,24,46,0.26)]"
        >
          {children}
        </div>
      </div>
    </>
  );
}
