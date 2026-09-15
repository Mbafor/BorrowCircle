import type { ReactNode } from 'react';
import { CATEGORIES } from '../constants/categories';
import { LOCATIONS } from '../constants/locations';

interface FilterPanelProps {
  category: string;
  location: string;
  borrowType: string;
  onCategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onBorrowTypeChange: (value: string) => void;
  onClear: () => void;
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        active ? 'bg-primary text-white' : 'bg-bg text-ink/70 hover:bg-ink/10'
      }`}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-ink/45">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function FilterPanel({
  category,
  location,
  borrowType,
  onCategoryChange,
  onLocationChange,
  onBorrowTypeChange,
  onClear,
}: FilterPanelProps) {
  return (
    <div>
      <div className="mb-3.5 flex items-center">
        <span className="text-[15px] font-bold">Filters</span>
        <div className="flex-1" />
        <button type="button" onClick={onClear} className="text-xs font-bold text-primary">
          Clear
        </button>
      </div>

      <Section title="Category">
        <Chip active={category === ''} label="All" onClick={() => onCategoryChange('')} />
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} label={c} onClick={() => onCategoryChange(category === c ? '' : c)} />
        ))}
      </Section>

      <Section title="Location">
        <Chip active={location === ''} label="All" onClick={() => onLocationChange('')} />
        {LOCATIONS.map((l) => (
          <Chip key={l} active={location === l} label={l} onClick={() => onLocationChange(location === l ? '' : l)} />
        ))}
      </Section>

      <Section title="Price">
        <Chip active={borrowType === ''} label="All" onClick={() => onBorrowTypeChange('')} />
        <Chip active={borrowType === 'FREE'} label="Free" onClick={() => onBorrowTypeChange(borrowType === 'FREE' ? '' : 'FREE')} />
        <Chip active={borrowType === 'PAID'} label="Paid" onClick={() => onBorrowTypeChange(borrowType === 'PAID' ? '' : 'PAID')} />
      </Section>
    </div>
  );
}
