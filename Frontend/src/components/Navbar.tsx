import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useNotifications } from '../notifications/useNotifications';
import UserAvatar from './UserAvatar';

function navLinkClass(isActive: boolean): string {
  return `rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'text-primary' : 'text-ink/60 hover:text-ink'
  }`;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <Link to="/" className="flex flex-none items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <span className="h-3 w-3 rounded-full border-[3px] border-accent" />
          </span>
          <span className="font-heading text-lg tracking-tight">BorrowCircle</span>
        </Link>

        <nav className="ml-1 hidden items-center gap-1 md:flex">
          <NavLink to="/explore" className={({ isActive }) => navLinkClass(isActive)}>
            Explore
          </NavLink>
          <NavLink to="/create-listing" className={({ isActive }) => navLinkClass(isActive)}>
            List an item
          </NavLink>
          {user && (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => navLinkClass(isActive)}>
                Dashboard
              </NavLink>
              <NavLink to="/requests" className={({ isActive }) => navLinkClass(isActive)}>
                Requests
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex-1" />

        {user ? (
          <div className="flex flex-none items-center gap-3">
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink/5 text-ink/70 transition-colors hover:bg-ink/10"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-accent px-1 text-[11px] font-bold text-ink">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <Link to={`/profile/${user.id}`} aria-label="Your profile" className="flex-none">
              <UserAvatar fullName={user.fullName} imageUrl={user.profileImageUrl} size={36} tone="solid" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex-none rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex flex-none items-center gap-2">
            <Link to="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-ink/60 hover:text-ink">
              Log in
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
