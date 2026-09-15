import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../api/auth';
import { AuthContext } from './AuthContext';
import type { LoginPayload, PublicUser, RegisterPayload } from '../types/auth';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    authApi
      .getMe()
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await authApi.login(payload);
    setUser(data.user);
  }, []);

  // The backend's /api/auth/register endpoint creates the account but does
  // not set session cookies (only /login does) — chain a login call with the
  // same credentials so a successful sign-up actually leaves the user in an
  // authenticated session, matching what the UI promises on this screen.
  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
    const data = await authApi.login({ email: payload.email, password: payload.password });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
