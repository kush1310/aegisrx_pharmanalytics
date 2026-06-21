import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Doctor, Pharmacy, DashboardStats, Notification, Product } from '@/types';



interface AppState {
  stats:                DashboardStats;
  isLoadingStats:       boolean;
  fetchStats:           () => Promise<void>;

  doctors:              Doctor[];
  isLoadingDoctors:     boolean;
  hasLoadedDoctors:     boolean;
  doctorTotal:          number;
  doctorPage:           number;
  doctorTotalPages:     number;
  fetchDoctors:         (page?: number, limit?: number, search?: string) => Promise<void>;

  pharmacies:           Pharmacy[];
  isLoadingPharmacies:  boolean;
  pharmacyTotal:        number;
  pharmacyPage:         number;
  pharmacyTotalPages:   number;
  fetchPharmacies:      (page?: number, limit?: number, search?: string) => Promise<void>;

  notifications:        Notification[];
  isLoadingNotifications: boolean;
  hasLoadedNotifications:boolean;
  fetchNotifications:   () => Promise<void>;

  products:             (Product & { pharmacyCount?: number })[];
  isLoadingProducts:    boolean;
  hasLoadedProducts:    boolean;
  productTotal:         number;
  productPage:          number;
  productTotalPages:    number;
  fetchProducts:        (page?: number, limit?: number, search?: string, sort?: string, dir?: string) => Promise<void>;

  searchQuery:          string;
  setSearchQuery:       (q: string) => void;

  hasLoadedHistory:     boolean;
  setHasLoadedHistory:  (val: boolean) => void;
  selectedAnalyticsUploadId: string | null;
  setSelectedAnalyticsUploadId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  stats:                  { doctorCount: 0, pharmacyCount: 0, unreadNotifications: 0 },
  isLoadingStats:         false,
  doctors:                [],
  isLoadingDoctors:       false,
  hasLoadedDoctors:       false,
  doctorTotal:            0,
  doctorPage:             1,
  doctorTotalPages:       1,

  pharmacies:             [],
  isLoadingPharmacies:    false,
  pharmacyTotal:          0,
  pharmacyPage:           1,
  pharmacyTotalPages:     1,
  notifications:          [],
  isLoadingNotifications: false,
  hasLoadedNotifications: false,
  products:               [],
  isLoadingProducts:      false,
  hasLoadedProducts:      false,
  productTotal:           0,
  productPage:            1,
  productTotalPages:      1,
  searchQuery:            '',
  hasLoadedHistory:       false,
  setHasLoadedHistory: (val) => set({ hasLoadedHistory: val }),
  selectedAnalyticsUploadId: null,
  setSelectedAnalyticsUploadId: (id) => set({ selectedAnalyticsUploadId: id }),

  fetchStats: async () => {
    set({ isLoadingStats: true });
    try {
      const r = await api.get<DashboardStats>('/api/stats/dashboard');
      if (r.success && r.data) set({ stats: r.data });
    } catch (e) { console.error('fetchStats', e); }
    finally { set({ isLoadingStats: false }); }
  },

  /**
   * fetchDoctors
   *
   * Fetches a paginated page of doctors from the server-side paginated API.
   * On success, updates doctors, doctorTotal, doctorPage, doctorTotalPages in state.
   *
   * @param page   - 1-based page number; defaults to 1.
   * @param limit  - Records per page; defaults to 50, max 200.
   * @param search - Optional search string for server-side LIKE filter on name/contact/specialization.
   */
  fetchDoctors: async (page = 1, limit = 30, search = '') => {
    set({ isLoadingDoctors: true });
    try {
      const params = new URLSearchParams();
      params.set('page',  String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);

      const r = await api.get<any>(`/api/doctors?${params.toString()}`);
      if (r.success) {
        set({
          doctors:          r.data ?? [],
          doctorTotal:      (r as any).total      ?? 0,
          doctorPage:       (r as any).page       ?? 1,
          doctorTotalPages: (r as any).totalPages ?? 1,
          hasLoadedDoctors: true,
        });
      }
    } catch (e) { console.error('fetchDoctors', e); }
    finally { set({ isLoadingDoctors: false }); }
  },

  /**
   * fetchPharmacies
   *
   * Fetches a paginated page of pharmacies from the server-side paginated API.
   * Replaces the former "fetch all 2000+ rows" approach with a bounded 100-record page.
   * On success, updates pharmacies, pharmacyTotal, pharmacyPage, pharmacyTotalPages in state.
   *
   * @param page   - 1-based page number; defaults to 1.
   * @param limit  - Records per page; defaults to 100, max 500.
   * @param search - Optional search string for server-side LIKE filter on name/owner/contact.
   */
  fetchPharmacies: async (page = 1, limit = 30, search = '') => {
    set({ isLoadingPharmacies: true });
    try {
      const params = new URLSearchParams();
      params.set('page',  String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);

      const r = await api.get<any>(`/api/pharmacies?${params.toString()}`);
      if (r.success) {
        set({
          pharmacies:          r.data ?? [],
          pharmacyTotal:       (r as any).total      ?? 0,
          pharmacyPage:        (r as any).page       ?? 1,
          pharmacyTotalPages:  (r as any).totalPages ?? 1,
        });
      }
    } catch (e) { console.error('fetchPharmacies', e); }
    finally { set({ isLoadingPharmacies: false }); }
  },

  fetchNotifications: async () => {
    set({ isLoadingNotifications: true });
    try {
      const r = await api.get<Notification[]>('/api/notifications');
      if (r.success && r.data) set({ notifications: r.data, hasLoadedNotifications: true });
    } catch (e) { console.error('fetchNotifications', e); }
    finally { set({ isLoadingNotifications: false }); }
  },

  fetchProducts: async (page = 1, limit = 25, search = '', sort = 'createdAt', dir = 'desc') => {
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
          hasLoadedProducts: true,
        });
      }
    } catch (e) { console.error('fetchProducts', e); }
    finally { set({ isLoadingProducts: false }); }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
}));
