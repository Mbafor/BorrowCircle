export type ItemStatus = 'AVAILABLE' | 'RESERVED' | 'BORROWED' | 'OVERDUE' | 'PAUSED' | 'CANCELLED' | 'REMOVED';

export type BorrowType = 'FREE' | 'PAID';

export interface Item {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  location: string;
  imageUrls: string[] | null;
  borrowType: BorrowType;
  pricePerDay: string | null;
  status: ItemStatus;
  createdAt: string;
}

// The shape GET /api/items (browse) actually returns per row — a lighter,
// owner-joined summary, not the full Item row. Browse only ever returns
// AVAILABLE items, so `status` here is always 'AVAILABLE' in practice.
export interface BrowseItem {
  id: string;
  title: string;
  category: string;
  location: string;
  borrowType: BorrowType;
  pricePerDay: string | null;
  status: ItemStatus;
  imageUrl: string | null;
  ownerId: string;
  ownerName: string;
  ownerAverageRating: string;
}
