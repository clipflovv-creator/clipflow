import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../services/api';

export type UserPlan = 'free' | 'pro' | 'business';

export interface UserProfile {
  id: string;
  userId?: string;
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
  emailVerified: boolean;
  plan: UserPlan;
  storageLimit: number;
  storageUsed: number;
  googleDriveConnected: boolean;
  hasGoogleDrive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPro: boolean;
  hasDriveAccess: boolean;
  googleDriveConnected: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  register: (
    email: string,
    password: string,
    name?: string,
    plan?: UserPlan
  ) => Promise<{ success: boolean; error?: string; message?: string; requiresVerification?: boolean; email?: string }>;
  registerWithEmail: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ success: boolean; error?: string; message?: string; requiresVerification?: boolean; email?: string }>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  verifyEmailWithCode: (code: string, email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string; resetCode?: string; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message?: string; resetCode?: string; error?: string }>;
  resetPassword: (
    tokenOrEmail: string,
    newPasswordOrCode: string,
    maybeNewPassword?: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  selectPlan: (plan: UserPlan) => Promise<{ success: boolean; error?: string }>;
  connectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch current authenticated user info via HttpOnly session cookie
  const fetchCurrentUser = async () => {
    try {
      const res = await api.auth.getMe();

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser({
            ...data.user,
            userId: data.user.id,
            hasGoogleDrive: Boolean(data.user.googleDriveConnected),
          });
          return;
        }
      }
      setUser(null);
    } catch (err: any) {
      console.warn('[Auth] Session check failed:', err.message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.auth.login(email, password);

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Invalid email or password' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
        return { success: true };
      }

      return { success: false, error: 'Login succeeded but no user returned' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login request failed' };
    }
  };

  const register = async (
    email: string,
    password: string,
    name?: string,
    plan: UserPlan = 'free'
  ) => {
    try {
      const res = await api.auth.register({ email, password, name, plan });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      // Server no longer auto-logs in after register.
      // User must verify email via OTP first.
      if (data.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          email: data.email as string,
          message: data.message || 'Check your email for the 6-digit verification code.',
        };
      }

      // Fallback: if server returns user directly (shouldn't happen but guard it)
      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
        return { success: true, message: data.message };
      }

      return { success: false, error: 'Unexpected response from server' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration request failed' };
    }
  };


  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (_) {}
    setUser(null);
  };

  const verifyEmail = async (token: string) => {
    try {
      const res = await api.auth.verifyEmail(token);

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Verification failed' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
      }
      return { success: true, message: data.message || 'Email successfully verified!' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification request failed' };
    }
  };

  const verifyEmailWithCode = async (code: string, email: string) => {
    try {
      const res = await api.auth.verifyEmailWithCode(code, email);

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Invalid or expired code' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
      }
      return { success: true, message: data.message || 'Email verified! Welcome to ClipFlow.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification request failed' };
    }
  };


  const resendVerification = async (email: string) => {
    try {
      const res = await api.auth.resendVerification(email);

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to resend verification' };
      }

      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend verification' };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await api.auth.forgotPassword(email);

      const data = await res.json();
      return {
        success: true,
        message: data.message || 'If an account exists, a reset link was sent.',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to request password reset' };
    }
  };

  const resetPassword = async (
    tokenOrEmail: string,
    newPasswordOrCode: string,
    maybeNewPassword?: string
  ) => {
    const token = maybeNewPassword ? newPasswordOrCode : tokenOrEmail;
    const newPassword = maybeNewPassword || newPasswordOrCode;
    try {
      const res = await api.auth.resetPassword(token, newPassword);

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to reset password' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
      }
      return { success: true, message: data.message || 'Password successfully reset!' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error resetting password' };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await api.auth.changePassword(currentPassword, newPassword);

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to change password' };
      }

      return { success: true, message: data.message || 'Password updated successfully!' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error changing password' };
    }
  };

  const selectPlan = async (plan: UserPlan) => {
    try {
      const res = await api.auth.selectPlan(plan);

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to update plan' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating plan' };
    }
  };

  const connectGoogleDrive = async () => {
    try {
      const res = await api.google.getConnectUrlJson();
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        window.location.href = api.google.getConnectUrl();
      }
    } catch {
      window.location.href = api.google.getConnectUrl();
    }
  };

  const disconnectGoogleDrive = async () => {
    try {
      const res = await api.google.disconnect();
      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to disconnect Cloud Storage' };
      }
      await fetchCurrentUser();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to disconnect Cloud Storage' };
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const value: AuthContextType = {
    user,
    token: null,
    isAuthenticated: !!user,
    isLoading,
    isPro: user?.plan === 'pro' || user?.plan === 'business',
    hasDriveAccess: Boolean(user?.googleDriveConnected),
    googleDriveConnected: Boolean(user?.googleDriveConnected),
    login,
    loginWithEmail: login,
    loginWithGoogle: connectGoogleDrive,
    register,
    registerWithEmail: (email: string, pass: string, name?: string) =>
      register(email, pass, name, 'free'),
    logout,
    verifyEmail,
    verifyEmailWithCode,
    resendVerification,
    forgotPassword,
    requestPasswordReset: forgotPassword,
    resetPassword,
    changePassword,
    selectPlan,
    connectGoogleDrive,
    disconnectGoogleDrive,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
