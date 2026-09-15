interface RatingDisplayProps {
  /** Backend sends averageRating as a decimal string, e.g. "4.80". */
  rating: string | number;
  size?: number;
  className?: string;
}

export default function RatingDisplay({ rating, size = 13, className = '' }: RatingDisplayProps) {
  const value = typeof rating === 'string' ? Number.parseFloat(rating) : rating;
  const label = Number.isFinite(value) ? value.toFixed(1) : '0.0';

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold text-ink ${className}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#F59E0B" stroke="none" className="flex-none">
        <path d="m12 2.6 2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9 2.9-6Z" />
      </svg>
      {label}
    </span>
  );
}
