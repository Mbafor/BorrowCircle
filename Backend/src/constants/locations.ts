// Fixed list of hostel/campus-area values. Shared across features that need
// to validate or filter by location (profile, and later item listings) so
// there is a single source of truth instead of duplicated lists.
export const LOCATIONS = [
  'Unity Hall',
  'Republic Hall',
  'Ayeduase',
  'Kotei',
  'Kentinkrono',
  'Tech Junction',
  'Commercial Area',
] as const;

export type Location = (typeof LOCATIONS)[number];
