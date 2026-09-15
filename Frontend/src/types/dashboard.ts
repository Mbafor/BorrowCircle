import type { ItemStatus } from './item';
import type { BorrowRequestStatus } from './borrowRequest';

export interface LendingActiveRequest {
  id: string;
  borrowerId: string;
  borrowerName: string;
  status: BorrowRequestStatus;
  pickupDate: string;
  returnDate: string;
}

export interface LendingItem {
  id: string;
  title: string;
  category: string;
  location: string;
  status: ItemStatus;
  createdAt: string;
  activeRequest: LendingActiveRequest | null;
  pendingRequestCount: number;
}

export interface BorrowingRequestItem {
  id: string;
  itemId: string;
  itemTitle: string;
  itemCategory: string;
  lenderId: string;
  lenderName: string;
  status: BorrowRequestStatus;
  pickupDate: string;
  returnDate: string;
  createdAt: string;
}

export interface DashboardSummary {
  activeBorrows: number;
  itemsListed: number;
  pendingRequestsToReview: number;
  averageRating: string;
}
