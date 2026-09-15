import { createContext } from 'react';
import type { LoginPayload, PublicUser, RegisterPayload } from '../types/auth';

export interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
