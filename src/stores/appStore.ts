import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Doctor, Pharmacy, DashboardStats, Notification, Product } from '@/types';



interface AppState {
  stats:                DashboardStats;
  isLoadingStats:       boolean;
  fetchStats:           () => Promise<void>;

  doctors:              Doctor[];
  isLoadingDoctors:     boolean;
  fetchDoctors:         () => Promise<void>;

  pharmacies:           Pharmacy[];
  isLoadingPharmacies:  boolean;
  fetchPharmacies:      () => Promise<void>;

  notifications:        Notification[];
  isLoadingNotifications: boolean;
  fetchNotifications:   () => Promise<void>;

  products:             (Product & { pharmacyCount?: number })[];
  isLoadingProducts:    boolean;
  productTotal:         number;
  productPage:          number;
  productTotalPages:    number;
  fetchProducts:        (page?: number, limit?: number, search?: string, sort?: string, dir?: string) => Promise<void>;

  searchQuery:          string;
  setSearchQuery:       (q: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  stats:                  { doctorCount: 0, pharmacyCount: 0, unreadNotifications: 0 },
  isLoadingStats:         false,
  doctors:                [],
  isLoadingDoctors:       false,
  pharmacies:             [],
  isLoadingPharmacies:    false,
  notifications:          [],
  isLoadingNotifications: false,
  products:               [],
  isLoadingProducts:      false,
  productTotal:           0,
  productPage:            1,
  productTotalPages:      1,
  searchQuery:            '',

  fetchStats: async () => {
    set({ isLoadingStats: true });
    try {
      const r = await api.get<DashboardStats>('/api/stats/dashboard');
      if (r.success && r.data) set({ stats: r.data });
    } catch (e) { console.error('fetchStats', e); }
    finally { set({ isLoadingStats: false }); }
  },

  fetchDoctors: async () => {
    set({ isLoadingDoctors: true });
    try {
      const r = await api.get<Doctor[]>('/api/doctors');
      if (r.success && r.data) set({ doctors: r.data });
    } catch (e) { console.error('fetchDoctors', e); }
    finally { set({ isLoadingDoctors: false }); }
  },

  fetchPharmacies: async () => {
    set({ isLoadingPharmacies: true });
    try {
      const r = await api.get<Pharmacy[]>('/api/pharmacies');
      if (r.success && r.data) set({ pharmacies: r.data });
    } catch (e) { console.error('fetchPharmacies', e); }
    finally { set({ isLoadingPharmacies: false }); }
  },

  fetchNotifications: async () => {
    set({ isLoadingNotifications: true });
    try {
      const r = await api.get<Notification[]>('/api/notifications');
      if (r.success && r.data) set({ notifications: r.data });
    } catch (e) { console.error('fetchNotifications', e); }
    finally { set({ isLoadingNotifications: false }); }
  },

  fetchProducts: async (page = 1, limit = 100, search = '', sort = 'createdAt', dir = 'desc') => {
    set({ isLoadingProducts: true });
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (sort) params.set('sort', sort);
      if (dir) params.set('dir', dir);

      const r = await api.get<any>(`/api/products?${params.toString()}`);
      if (r.success) {
        set({
          products:          r.data ?? [],
          productTotal:      (r as any).total ?? 0,
          productPage:       (r as any).page ?? 1,
          productTotalPages: (r as any).totalPages ?? 1,
        });
      }
    } catch (e) { console.error('fetchProducts', e); }
    finally { set({ isLoadingProducts: false }); }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
}));
