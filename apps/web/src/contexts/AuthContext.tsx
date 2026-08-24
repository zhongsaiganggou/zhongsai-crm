import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getTokens, setTokens } from '../lib/api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (account: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const next = await api<User>('/users/me');
    setUser(next);
  };

  useEffect(() => {
    if (!getTokens()) {
      setLoading(false);
      return;
    }
    refreshUser().catch(() => setTokens(null)).finally(() => setLoading(false));
  }, []);

  const login = async (account: string, password: string) => {
    const result = await api<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password, deviceInfo: navigator.userAgent }),
    });
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    const profile = await api<User>('/users/me');
    setUser(profile);
    return profile;
  };

  const logout = async () => {
    const tokens = getTokens();
    if (tokens) await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: tokens.refreshToken }) }).catch(() => undefined);
    setTokens(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
