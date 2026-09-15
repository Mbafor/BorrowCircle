import { useState } from 'react';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

interface UserAvatarProps {
  fullName: string;
  imageUrl?: string | null;
  size?: number;
  /** 'tint' (light bg, primary text) is the default used on cards; 'solid' (primary bg, white text) matches the Navbar's own-user avatar. */
  tone?: 'tint' | 'solid';
  className?: string;
}

export default function UserAvatar({ fullName, imageUrl, size = 36, tone = 'tint', className = '' }: UserAvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  // The backend's photo storage is stubbed (returns a placeholder URL that
  // never resolves to a real file), so a real upload can 404 — fall back to
  // initials rather than showing a broken image.
  const [imageFailed, setImageFailed] = useState(false);

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={fullName}
        style={style}
        className={`flex-none rounded-full object-cover ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  const toneClass = tone === 'solid' ? 'bg-primary text-white' : 'bg-info-bg text-primary';

  return (
    <span
      style={style}
      className={`flex flex-none items-center justify-center rounded-full font-bold ${toneClass} ${className}`}
    >
      {getInitials(fullName)}
    </span>
  );
}
