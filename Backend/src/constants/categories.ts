// Fixed list of item categories. Shared source of truth for listing creation
// and (later) browse/filter.
export const CATEGORIES = ['Electronics', 'Academic', 'Fashion', 'Sports', 'Creative Tools'] as const;

export type Category = (typeof CATEGORIES)[number];
