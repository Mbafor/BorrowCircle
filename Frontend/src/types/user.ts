import type { BorrowType, ItemStatus } from './item';

export interface PublicProfileItem {
  id: string;
  title: string;
  category: string;
  location: string;
  borrowType: BorrowType;
  pricePerDay: string | null;
  status: ItemStatus;
  imageUrls: string[] | null;
  createdAt: string;
}

// GET /api/users/:id — a user's public-facing profile. Excludes email;
// phoneNumber is only present when the viewer has an accepted/handover
// request with this user (backend decides that, not the frontend).
export interface PublicProfile {
  id: string;
  fullName: string;
  location: string;
  profileImageUrl: string | null;
  bio: string | null;
  averageRating: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: string;
  phoneNumber?: string;
  items: PublicProfileItem[];
}
