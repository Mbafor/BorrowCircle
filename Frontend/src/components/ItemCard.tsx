import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BrowseItem } from '../types/item';
import StatusBadge from './StatusBadge';
import UserAvatar from './UserAvatar';
import RatingDisplay from './RatingDisplay';
import { CategoryIcon, getCategoryTint } from './categoryVisuals';

function priceLabel(item: BrowseItem): string {
  if (item.borrowType === 'FREE' || !item.pricePerDay) return 'Free';
  return `GHS ${Number.parseFloat(item.pricePerDay).toFixed(0)}/day`;
}

interface ItemCardProps {
  item: BrowseItem;
  /** Used by the Create Listing live preview, which isn't a real, navigable item. */
  disableLink?: boolean;
}

export default function ItemCard({ item, disableLink = false }: ItemCardProps) {
  const tint = getCategoryTint(item.category);
  const free = item.borrowType === 'FREE' || !item.pricePerDay;
  // The backend's image storage is stubbed (returns a placeholder URL that
  // never resolves to a real file), so a real listing's photo can 404 —
  // fall back to the category tile rather than showing a broken image.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!item.imageUrl && !imageFailed;

  const className = 'block overflow-hidden rounded-tile border border-ink/10 bg-white transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(22,24,46,0.11)]';

  const content = (
    <>
      <div
        className="relative flex h-[146px] items-center justify-center"
        style={showImage ? undefined : { background: `linear-gradient(150deg, ${tint.bg} 20%, #FFFFFF 140%)` }}
      >
        {showImage ? (
          <img src={item.imageUrl!} alt={item.title} className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
        ) : (
          <CategoryIcon category={item.category} size={46} />
        )}
        <span className="absolute left-3 top-3">
          <StatusBadge status={item.status} />
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2.5">
          <p className="text-[15px] font-bold leading-tight text-ink">{item.title}</p>
          <p
            className={
              free
                ? 'whitespace-nowrap rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-bold text-success-text'
                : 'whitespace-nowrap text-sm font-bold text-primary'
            }
          >
            {priceLabel(item)}
          </p>
        </div>
        <p className="mt-1.5 text-xs text-ink/55">
          {item.category} · {item.location}
        </p>
        <div className="mt-3 flex items-center gap-2 border-t border-ink/[0.07] pt-3">
          <UserAvatar fullName={item.ownerName} size={24} />
          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{item.ownerName}</p>
          <RatingDisplay rating={item.ownerAverageRating} size={12} />
        </div>
      </div>
    </>
  );

  if (disableLink) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link to={`/items/${item.id}`} className={className}>
      {content}
    </Link>
  );
}
