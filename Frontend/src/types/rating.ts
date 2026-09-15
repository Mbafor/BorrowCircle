export interface Rating {
  id: string;
  borrowRequestId: string;
  reviewerId: string;
  revieweeId: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

// GET /api/users/:id/reviews — a rating joined with the reviewer's name,
// scoped to reviews received (revieweeId === the profile being viewed).
export interface PublicReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

// GET /api/ratings/my-pending — a completed (RETURNED) borrow request the
// current user hasn't rated the other participant for yet.
export interface PendingRating {
  borrowRequestId: string;
  itemTitle: string;
  otherParticipantName: string;
}
