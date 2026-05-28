import { create } from 'zustand';
import { api, setToken, clearToken } from '@/lib/api';

interface AuthState {
  isAuthenticated: boolean;
  username:        string | null;
  role:            string | null;
  login:           (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout:          () => void;
  checkSession:    () => boolean;
  updateActivity:  () => void;
}

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: sessionStorage.getItem('sp_token') !== null,
  username:        sessionStorage.getItem('sp_username'),
  role:            sessionStorage.getItem('sp_role'),

  login: async (username: string, password: string) => {
    const result = await api.login(username, password);
    if (result.success && result.data) {
      const { token, username: uname, role } = result.data;
      setToken(token);
      sessionStorage.setItem('sp_username', uname);
      sessionStorage.setItem('sp_role', role);
      sessionStorage.setItem('sp_login_time', Date.now().toString());
      set({ isAuthenticated: true, username: uname, role });
      return { success: true };
    }
    return { success: false, error: result.error || 'Login failed' };
  },

  logout: () => {
    clearToken();
    sessionStorage.removeItem('sp_username');
    sessionStorage.removeItem('sp_role');
    sessionStorage.removeItem('sp_login_time');
    set({ isAuthenticated: false, username: null, role: null });
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
