import { useState } from 'react';

interface HandoverCodeCardProps {
  label: string;
  code: string;
  caption?: string;
}

export default function HandoverCodeCard({ label, code, caption }: HandoverCodeCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied by the browser — the code is still visible to read manually.
    }
  }

  return (
    <div className="rounded-2xl bg-ink p-4 text-white">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-2xl font-bold tracking-[0.18em] text-accent">{code}</span>
        <button type="button" onClick={copy} className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold transition-colors hover:bg-white/20">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {caption && <p className="mt-2 text-xs text-white/50">{caption}</p>}
    </div>
  );
}
