export type BorrowRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'BORROWED'
  | 'RETURNED'
  | 'OVERDUE';

export interface BorrowRequest {
  id: string;
  itemId: string;
  borrowerId: string;
  pickupDate: string;
  returnDate: string;
  message: string | null;
  pickupCode: string | null;
  returnCode: string | null;
  status: BorrowRequestStatus;
  declineReason: string | null;
  expiresAt: string;
  lastOverdueNotifiedAt: string | null;
  returnedAt: string | null;
  createdAt: string;
}
