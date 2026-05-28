import { create } from 'zustand';
import { api, setToken, clearToken } from '@/lib/api';

interface AuthState {
  isAuthenticated: boolean;
  username:        string | null;
  role:            string | null;
  firstName:       string | null;
  lastName:        string | null;
  email:           string | null;
  login:           (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup:          (body: unknown) => Promise<{ success: boolean; error?: string }>;
  logout:          () => void;
  checkSession:    () => boolean;
  updateActivity:  () => void;
}

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: sessionStorage.getItem('sp_token') !== null,
  username:        sessionStorage.getItem('sp_username'),
  role:            sessionStorage.getItem('sp_role'),
  firstName:       sessionStorage.getItem('sp_firstName'),
  lastName:        sessionStorage.getItem('sp_lastName'),
  email:           sessionStorage.getItem('sp_email'),

  login: async (emailAddress: string, password: string) => {
    const result = await api.login(emailAddress, password);
    if (result.success && result.data) {
      const { token, username: uname, role, firstName, lastName, email } = result.data;
      setToken(token);
      sessionStorage.setItem('sp_username', uname);
      sessionStorage.setItem('sp_role', role);
      sessionStorage.setItem('sp_firstName', firstName || '');
      sessionStorage.setItem('sp_lastName', lastName || '');
      sessionStorage.setItem('sp_email', email || '');
      sessionStorage.setItem('sp_login_time', Date.now().toString());
      set({ 
        isAuthenticated: true, 
        username: uname, 
        role,
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || ''
      });
      return { success: true };
    }
    return { success: false, error: result.error || 'Login failed' };
  },

  signup: async (body: unknown) => {
    const result = await api.signup(body);
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.error || 'Registration failed' };
  },

  logout: () => {
    clearToken();
    sessionStorage.removeItem('sp_username');
    sessionStorage.removeItem('sp_role');
    sessionStorage.removeItem('sp_firstName');
    sessionStorage.removeItem('sp_lastName');
    sessionStorage.removeItem('sp_email');
    sessionStorage.removeItem('sp_login_time');
    set({ isAuthenticated: false, username: null, role: null, firstName: null, lastName: null, email: null });
  },

  checkSession: () => {
    const loginTime = Number(sessionStorage.getItem('sp_login_time') || '0');
    const token = sessionStorage.getItem('sp_token');
    if (!token || !loginTime) { get().logout(); return false; }
    if (Date.now() - loginTime > SESSION_TIMEOUT_MS) { get().logout(); return false; }
    return true;
  },

  updateActivity: () => {
    sessionStorage.setItem('sp_login_time', Date.now().toString());
  },
}));
