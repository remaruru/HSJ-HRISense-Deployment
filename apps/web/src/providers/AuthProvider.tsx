import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthService, UserPayload, LoginPayload } from '../services/auth.service';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/lib/router';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { tokenStorage, isPublicPath } from '@/lib/tokenStorage';

// ─── Token Helpers (Remember Me aware — see lib/tokenStorage.ts) ─────────────
export const getStoredToken = (): string | null => tokenStorage.getAccessToken();
export const storeToken = (accessToken: string): void => {
  tokenStorage.setAccessToken(accessToken);
};
export const clearStoredSession = (): void => {
  tokenStorage.clear();
};

// ─── Context Shape ─────────────────────────────────────────────────────────────
export interface AuthContextType {
  user: UserPayload | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  login: (credentials: LoginPayload) => Promise<UserPayload>;
  /** Google Sign-In with the ID token from Google's button; same session as `login`. */
  loginWithGoogle: (credential: string, rememberMe: boolean) => Promise<UserPayload>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<UserPayload | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState(false);

  // ─── Fetch / restore current authenticated user ─────────────────────────────
  const fetchCurrentUser = useCallback(async (): Promise<UserPayload | null> => {
    try {
      const data = await AuthService.getMe();
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      if (!err.response || err.response.status >= 500) {
        throw err; // Rethrow network errors so callers can handle them
      }
      setUser(null);
      return null;
    }
  }, []);

  // ─── Core Logout Sequence ───────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const refreshToken = tokenStorage.getRefreshToken();
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
    } catch {
      // Backend logout error is non-fatal — proceed with frontend session cleanup
    } finally {
      // 1. Clear stored tokens
      clearStoredSession();
      // 2. Clear user & auth state
      setUser(null);
      setAuthError(null);
      setIsLoggingIn(false);
      // 3. Clear private query cache
      queryClient.clear();
      // 4. Invalidate router & navigate to login with replace: true
      router.invalidate();
      router.navigate({ to: '/login', replace: true });
    }
  }, []);

  // ─── Session restoration on app load ────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      // Try to restore even without an access token — we may have a valid refresh token.
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        // No refresh token at all — definitely logged out.
        setIsInitializing(false);
        return;
      }

      try {
        const data = await AuthService.getMe();
        setUser(data.user);
        setNetworkError(false);
      } catch (err: any) {
        if (!err.response || err.response.status >= 500) {
          // Network Error or Server Crash! Keep tokens intact, show retry UI.
          setNetworkError(true);
        } else {
          // Actual 401 or auth failure. Session is dead.
          clearStoredSession();
          setUser(null);
          queryClient.clear();
        }
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();

    // Listen for forced logout events fired by API 401 interceptor
    const handleLogoutEvent = (e: Event) => {
      clearStoredSession();
      setUser(null);
      setAuthError(null);
      setIsLoggingIn(false);
      queryClient.clear();
      router.invalidate();
      
      const isPublic = (e as CustomEvent).detail?.isPublic;
      if (!isPublic) {
        router.navigate({ to: '/login', replace: true });
      }
    };

    window.addEventListener('auth_logout', handleLogoutEvent);
    return () => window.removeEventListener('auth_logout', handleLogoutEvent);
  }, []);

  // ─── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginPayload): Promise<UserPayload> => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      // Record the Remember Me choice BEFORE storing tokens so they land in the
      // correct store (localStorage when remembered, sessionStorage otherwise).
      tokenStorage.setRemember(credentials.rememberMe === true);

      const data = await AuthService.login(credentials);
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      setUser(null);
      const msg = getApiErrorMessage(err, 'Invalid email or password');
      setAuthError(msg);
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential: string, rememberMe: boolean): Promise<UserPayload> => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      tokenStorage.setRemember(rememberMe);
      const data = await AuthService.googleLogin(credential);
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      setUser(null);
      setAuthError(getApiErrorMessage(err, 'Google sign-in failed.'));
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  // ─── Loading screen during session initialization ────────────────────────────
  const pathname = window.location.pathname;
  const isPublic = isPublicPath(pathname);

  if (isInitializing && !isPublic) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="text-center space-y-4 flex flex-col items-center">
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="h-16 w-16 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20"
          >
            <Heart className="h-8 w-8 text-white" fill="currentColor" />
          </motion.div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-heading">HRISense</h2>
            <p className="text-sm text-muted-foreground animate-pulse">Checking Session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (networkError && !isPublic) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50 p-4">
        <div className="text-center space-y-4 max-w-sm w-full p-8 bg-surface rounded-2xl border border-border shadow-lg">
          <Heart className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold font-heading">Server Unavailable</h2>
          <p className="text-sm text-muted-foreground">Unable to connect to the HRISense server. Please try again in a moment.</p>
          <button onClick={() => { setNetworkError(false); setIsInitializing(true); fetchCurrentUser().then((u) => { if (!u && !getStoredToken()) { clearStoredSession(); } else if (u) { setNetworkError(false); } else { setNetworkError(true); } setIsInitializing(false); }).catch(() => { setNetworkError(true); setIsInitializing(false); }); }} className="mt-4 px-4 py-3 bg-primary text-primary-foreground hover:bg-primary-600 rounded-lg font-bold w-full transition-colors">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isInitializing,
        isLoggingIn,
        authError,
        login,
        loginWithGoogle,
        logout,
        fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
