import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <main className="mx-auto flex max-w-6xl justify-center px-5 py-10">
      <div className="w-full max-w-[440px] rounded-card border border-ink/10 bg-white p-8 shadow-[0_4px_14px_rgba(22,24,46,0.06)]">
        <h2 className="mb-1.5 text-3xl">{title}</h2>
        {subtitle && <p className="mb-5 text-sm text-ink/60">{subtitle}</p>}
        {children}
      </div>
    </main>
  );
}
