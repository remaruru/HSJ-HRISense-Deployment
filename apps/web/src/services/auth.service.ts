import { api } from './api';

export interface LoginPayload {
  email: string;
  password?: string;
  /**
   * Client-side only — decides whether the session is stored in localStorage
   * (survives a browser restart) or sessionStorage. Never sent to the API.
   */
  rememberMe?: boolean;
  /** The "I'm not a robot" token — only after repeated failed sign-ins. */
  captchaToken?: string;
}

export interface UserPayload {
  id: string;
  email: string;
  mustChangePassword: boolean;
  permissions: string[];
  permissionTier: 'FULL' | 'SUPERVISOR' | 'STANDARD';
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    jobRole: {
      title: string;
      code: string;
      permissionTier: 'FULL' | 'SUPERVISOR' | 'STANDARD';
    };
  };
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    mustChangePassword: boolean;
    permissions: string[];
    permissionTier: 'FULL' | 'SUPERVISOR' | 'STANDARD';
    employee: {
      id: string;
      employeeNumber: string;
      firstName: string;
      lastName: string;
      photoUrl: string | null;
      jobRole: {
        title: string;
        code: string;
        permissionTier: 'FULL' | 'SUPERVISOR' | 'STANDARD';
      };
    };
  };
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  // NOTE: the API deliberately does NOT return a reset token. The token travels
  // only inside the emailed link.
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export class AuthService {
  static async login(credentials: LoginPayload): Promise<LoginResult> {
    // rememberMe is a client-side storage preference — it must not be posted.
    const { rememberMe: _rememberMe, ...payload } = credentials;
    const response = await api.post('/auth/login', payload);
    return response.data.data;
  }

  /** Whether Google Sign-In is switched on, and the public Client ID it needs. */
  static async googleConfig(): Promise<{ enabled: boolean; clientId: string | null }> {
    const response = await api.get('/auth/google/config');
    return response.data?.data ?? { enabled: false, clientId: null };
  }

  /**
   * Signs in with the ID token Google's button returned. The API verifies it
   * with Google's keys and returns the same session as a password sign-in.
   */
  static async googleLogin(credential: string): Promise<LoginResult> {
    const response = await api.post('/auth/google', { credential }, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    return response.data.data;
  }

  static async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken });
  }

  static async getMe(): Promise<{ user: UserPayload }> {
    const response = await api.get('/auth/me');
    return response.data.data;
  }

  static async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  }

  static async resetPassword(credentials: ResetPasswordPayload): Promise<void> {
    await api.post('/auth/reset-password', credentials);
  }
}
