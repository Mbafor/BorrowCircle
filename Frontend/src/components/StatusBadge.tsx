import type { ItemStatus } from '../types/item';
import type { BorrowRequestStatus } from '../types/borrowRequest';

const ITEM_STYLES: Record<ItemStatus, string> = {
  AVAILABLE: 'bg-success-bg text-success-text',
  RESERVED: 'bg-warning-bg text-warning-text',
  BORROWED: 'bg-info-bg text-info-text',
  OVERDUE: 'bg-danger-bg text-danger-text',
  PAUSED: 'bg-neutral-bg text-neutral-text',
  CANCELLED: 'bg-neutral-bg text-neutral-text',
  REMOVED: 'bg-neutral-bg text-neutral-text',
};

const REQUEST_STYLES: Record<BorrowRequestStatus, string> = {
  PENDING: 'bg-warning-bg text-warning-text',
  ACCEPTED: 'bg-success-bg text-success-text',
  DECLINED: 'bg-danger-bg text-danger-text',
  EXPIRED: 'bg-neutral-bg text-neutral-text',
  CANCELLED: 'bg-neutral-bg text-neutral-text',
  BORROWED: 'bg-info-bg text-info-text',
  RETURNED: 'bg-neutral-bg text-neutral-text',
  OVERDUE: 'bg-danger-bg text-danger-text',
};

function toTitleCase(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

interface StatusBadgeProps {
  status: ItemStatus | BorrowRequestStatus;
  variant?: 'item' | 'request';
}

export default function StatusBadge({ status, variant = 'item' }: StatusBadgeProps) {
  const styles = variant === 'request' ? REQUEST_STYLES : ITEM_STYLES;
  const className = (styles as Record<string, string>)[status] ?? 'bg-neutral-bg text-neutral-text';

  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>
      {toTitleCase(status)}
    </span>
  );
}
