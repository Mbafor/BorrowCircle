// Fixed list of hostel/campus-area values. Shared across features that need
// to validate or filter by location (profile, and later item listings) so
// there is a single source of truth instead of duplicated lists.
export const LOCATIONS = [
  'Africa Hall',
  'Republic Hall',
  'Unity Hall',
  'Independence Hall',
  "Queen's Hall",
  'University Hall (Katanga)',
  'Bantama Hostel',
  'SRC Hostel',
  'Off-Campus',
] as const;

export type Location = (typeof LOCATIONS)[number];
