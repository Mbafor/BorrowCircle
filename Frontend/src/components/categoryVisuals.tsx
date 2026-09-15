export const CATEGORY_TINTS: Record<string, { bg: string; fg: string }> = {
  Electronics: { bg: '#E8EAF6', fg: '#1E2A78' },
  Academic: { bg: '#E0F2FE', fg: '#075985' },
  Fashion: { bg: '#FCE7F3', fg: '#9D174D' },
  Sports: { bg: '#DCFCE7', fg: '#166534' },
  'Creative Tools': { bg: '#FEF3C7', fg: '#8C4A17' },
};

const ICON_PATHS: Record<string, string> = {
  Electronics: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  Academic: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5ZM8 7h8',
  Fashion: 'M8 3 4 5.5 6 10l2-1v12h8V9l2 1 2-4.5L16 3l-4 2.5L8 3Z',
  Sports: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0|M12 6.5 8 9.5l1.5 4.5h5L16 9.5 12 6.5Z',
  'Creative Tools': 'M3 15 15 3l6 6L9 21l-6-6Z|M7 11l2 2M11 7l2 2',
};

export function getCategoryTint(category: string): { bg: string; fg: string } {
  return CATEGORY_TINTS[category] ?? CATEGORY_TINTS.Electronics;
}

interface CategoryIconProps {
  category: string;
  size?: number;
  color?: string;
}

export function CategoryIcon({ category, size = 24, color }: CategoryIconProps) {
  const tint = getCategoryTint(category);
  const d = ICON_PATHS[category] ?? ICON_PATHS.Electronics;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? tint.fg}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
    >
      {d.split('|').map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
