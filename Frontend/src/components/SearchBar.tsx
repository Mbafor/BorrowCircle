interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <div className="flex min-w-[210px] flex-1 items-center gap-2.5 rounded-full border border-ink/12 bg-white px-4 py-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(22,24,46,.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="w-full border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink/45"
      />
    </div>
  );
}
