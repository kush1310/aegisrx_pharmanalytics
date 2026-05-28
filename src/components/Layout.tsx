import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Tooltip, Modal, Button, Text } from '@mantine/core';
import {
  IconLayoutDashboard,
  IconStethoscope,
  IconBuildingStore,
  IconPackage,
  IconBell,
  IconHistory,
  IconSettings,
  IconLogout,
  IconUpload,
  IconChevronLeft,
  IconChevronRight,
  IconChartBar,
  IconSearch,
  IconLoader2,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useAppStore } from '../stores/appStore';
import { api } from '../lib/api';
import PageLoader from './PageLoader';

/**
 * NavSection — a logical grouping of navigation items separated by a divider.
 * Each section has an optional heading label and an array of route items.
 */
interface NavItemDef {
  path: string;
  label: string;
  icon: React.ElementType;
  badgeCount?: number;
}

/**
 * Layout — AegisRx shell with UntitledUI-style light sidebar.
 *
 * Sidebar regions:
 *   1. Brand header — AegisRx wordmark + Analytics badge
 *   2. Navigation body — grouped items separated by hairline dividers
 *   3. User footer — avatar, name, email, logout trigger
 *
 * Global logic preserved:
 *   - Debounced global search with suggestions dropdown
 *   - Session heartbeat validation (60-second interval)
 *   - Navigation history tracking via navigationStore
 *   - Unread notifications badge polling (30-second interval)
 *   - Secure logout with 3-second animated overlay
 */
export default function Layout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { logout, username, firstName, lastName, checkSession, updateActivity } = useAuthStore();
  const { navigate: navNavigate } = useNavigationStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ── Global Search State ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    doctors: any[];
    pharmacies: any[];
    products: any[];
  } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [globalSearchHistory, setGlobalSearchHistory] = useState<string[]>([]);

  const GLOBAL_HISTORY_KEY = 'aegisrx_sh_global';

  // Load persisted global search history on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GLOBAL_HISTORY_KEY);
      if (raw) setGlobalSearchHistory(JSON.parse(raw));
    } catch { /* silent */ }
  }, []);

  // Debounced search — 300 ms delay avoids excessive IPC calls
  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchResults(null);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get<any>(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.success && res.data) setSearchResults(res.data);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Dismiss suggestion dropdown on outside click
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      const container = document.getElementById('global-search-container');
      if (container && !container.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // ── Session validation — redirects to /login if session expired ──
  useEffect(() => {
    const interval = setInterval(() => {
      if (!checkSession()) navigate('/login');
    }, 60000);
    return () => clearInterval(interval);
  }, [checkSession, navigate]);

  // ── Activity tracking + navigation history ───────────────────────
  useEffect(() => {
    updateActivity();
    navNavigate(location.pathname);
    // Clear global search input and suggestions dropdown on route transitions
    setSearchQuery('');
    setSearchResults(null);
    setShowSuggestions(false);
  }, [location.pathname, updateActivity, navNavigate]);

  // ── Unread notification badge — polls every 30 seconds ──────────
  const { fetchNotifications, notifications } = useAppStore();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ── Logout handler — shows 3-second animated overlay ────────────
  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      logout();
      navigate('/login');
    }, 3000);
  };

  const userFullName = firstName && lastName ? `${firstName} ${lastName}` : (username || 'Admin');
  const userInitial  = firstName ? firstName.charAt(0).toUpperCase() : (username ? username.charAt(0).toUpperCase() : 'A');

  // ── Active route resolver ────────────────────────────────────────
  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname === path || location.pathname.startsWith(path + '/');

  /**
   * NavItem — renders a single navigation button in the UntitledUI style.
   * Active state: indigo text + very light indigo background.
   * Hover state: subtle gray background, no border shift.
   * Badge: red pill on the right side for notification count.
   *
   * @param item         - Route definition with icon, label, path, optional badge count
   * @param isCollapsed  - When true, shows icon only and wraps in a Tooltip
   */
  const NavItem = ({ item }: { item: NavItemDef }) => {
    const active   = isActive(item.path);
    const Icon     = item.icon;
    const hasBadge = typeof item.badgeCount === 'number' && item.badgeCount > 0;

    return (
      <Tooltip
        label={item.label}
        position="right"
        disabled={!isCollapsed}
        transitionProps={{ duration: 120 }}
        withArrow
        styles={{ tooltip: { fontSize: '0.8125rem', fontWeight: 500, background: '#1e293b', color: '#f8fafc' } }}
      >
        <button
          id={`nav-${item.path.replace(/\//g, '-').slice(1)}`}
          className={`
            flex items-center gap-3 w-full rounded-lg text-left transition-all duration-150 cursor-pointer
            ${isCollapsed ? 'justify-center px-0 py-2.5 mx-auto w-10 h-10' : 'px-3 py-2.5'}
            ${active
              ? 'bg-indigo-50 text-indigo-700 font-semibold'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
            }
          `}
          onClick={() => navigate(item.path)}
          aria-current={active ? 'page' : undefined}
        >
          <Icon
            size={17}
            className={`shrink-0 transition-colors duration-150 ${active ? 'text-indigo-600' : 'text-gray-400'}`}
            strokeWidth={active ? 2 : 1.75}
          />
          {!isCollapsed && (
            <span className="text-[13.5px] truncate leading-none">{item.label}</span>
          )}
          {!isCollapsed && hasBadge && (
            <span className="ml-auto text-[11px] font-bold text-white bg-red-500 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
              {item.badgeCount}
            </span>
          )}
          {isCollapsed && hasBadge && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
          )}
        </button>
      </Tooltip>
    );
  };

  /**
   * Divider — renders a hairline horizontal rule between nav sections.
   * Matches the UntitledUI section separator style.
   */
  const NavDivider = () => (
    <div className="h-px bg-gray-100 my-1.5 mx-1" />
  );

  // ── Navigation section definitions ──────────────────────────────
  const group1: NavItemDef[] = [
    { path: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
  ];
  const group2: NavItemDef[] = [
    { path: '/doctors',    label: 'Doctors',    icon: IconStethoscope },
    { path: '/pharmacies', label: 'Pharmacies', icon: IconBuildingStore },
    { path: '/products',   label: 'Products',   icon: IconPackage },
    { path: '/analytics',  label: 'Analytics',  icon: IconChartBar },
  ];
  const group3: NavItemDef[] = [
    { path: '/upload',  label: 'Upload Data', icon: IconUpload },
    { path: '/history', label: 'History',     icon: IconHistory },
  ];
  const group4: NavItemDef[] = [
    { path: '/notifications', label: 'Notifications', icon: IconBell, badgeCount: unreadCount },
    { path: '/settings',      label: 'Settings',      icon: IconSettings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">

      {/* ── Secure Logout Full-screen Overlay ───────────────────────── */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md transition-all duration-300">
          <div className="flex flex-col items-center gap-6 p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm text-center">
            <PageLoader size={2.2} message="Ending Session" variant="dark" />
            <Text className="text-slate-400 text-xs leading-relaxed font-medium">
              Securing and closing your active session...
            </Text>
          </div>
        </div>
      )}

      {/* ── AegisRx Sidebar — UntitledUI minimal light style ────────── */}
      <aside
        className={`
          h-screen flex flex-col bg-white border-r border-gray-100
          transition-all duration-300 z-50 shrink-0 relative
          ${isCollapsed ? 'w-[68px]' : 'w-56'}
        `}
      >
        {/* ── Brand Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between h-[60px] px-4 border-b border-gray-100 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[15px] font-extrabold tracking-tight text-gray-900">AegisRx</span>
              <span className="text-[9px] font-bold tracking-widest text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full uppercase leading-none">
                Analytics
              </span>
            </div>
          )}
          {/* Collapse/Expand toggle — subtle icon button */}
          <Tooltip
            label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            position="right"
            withArrow
            transitionProps={{ duration: 120 }}
            styles={{ tooltip: { fontSize: '0.75rem', fontWeight: 500, background: '#1e293b', color: '#f8fafc' } }}
          >
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all duration-150 cursor-pointer shrink-0"
              onClick={() => setIsCollapsed(v => !v)}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed
                ? <IconChevronRight size={14} strokeWidth={2} />
                : <IconChevronLeft  size={14} strokeWidth={2} />
              }
            </button>
          </Tooltip>
        </div>

        {/* ── Navigation Body ──────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-2 pt-3 pb-2 scrollbar-none flex flex-col gap-0.5">

          {/* Group 1: Overview */}
          {group1.map(item => <NavItem key={item.path} item={item} />)}

          <NavDivider />

          {/* Group 2: Records */}
          {!isCollapsed && (
            <p className="px-3 pt-1 pb-0.5 text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest leading-none select-none">
              Records
            </p>
          )}
          {group2.map(item => <NavItem key={item.path} item={item} />)}

          <NavDivider />

          {/* Group 3: Data */}
          {!isCollapsed && (
            <p className="px-3 pt-1 pb-0.5 text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest leading-none select-none">
              Data
            </p>
          )}
          {group3.map(item => <NavItem key={item.path} item={item} />)}

          <NavDivider />

          {/* Group 4: System */}
          {group4.map(item => <NavItem key={item.path} item={item} />)}

        </nav>

        {/* ── User Footer — matches UntitledUI bottom user row ────── */}
        <div className="border-t border-gray-100 shrink-0">
          <Tooltip
            label="Logout"
            position="right"
            withArrow
            disabled={!isCollapsed}
            transitionProps={{ duration: 120 }}
            styles={{ tooltip: { fontSize: '0.75rem', fontWeight: 500, background: '#1e293b', color: '#f8fafc' } }}
          >
            <button
              className={`
                flex items-center gap-3 w-full transition-all duration-150 cursor-pointer group
                hover:bg-gray-50 active:bg-gray-100
                ${isCollapsed ? 'justify-center p-3.5' : 'px-4 py-3.5'}
              `}
              onClick={() => setLogoutModalOpen(true)}
              aria-label="Logout"
            >
              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-[13px] shadow-sm shrink-0 select-none">
                {userInitial}
              </div>

              {!isCollapsed && (
                <>
                  <div className="flex flex-col min-w-0 flex-1 text-left">
                    <span className="text-[13px] font-semibold text-gray-800 truncate leading-tight">
                      {userFullName}
                    </span>
                    <span className="text-[11px] text-gray-400 truncate leading-tight mt-0.5">
                      Administrator
                    </span>
                  </div>
                  {/* Logout icon */}
                  <IconLogout
                    size={16}
                    className="shrink-0 text-gray-400 group-hover:text-red-500 transition-colors duration-150"
                    strokeWidth={1.75}
                  />
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-gray-50">

        {/* Top Header with Global Search */}
        <header className="h-14 border-b border-gray-200/70 bg-white flex items-center justify-between px-8 shrink-0 z-[100] shadow-[0_1px_0_0_rgba(0,0,0,0.04)] relative">
          <div className="w-96 relative" id="global-search-container">
            <div className="relative">
              <input
                type="text"
                placeholder="Search doctors, pharmacies, products..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-9 pr-4 py-2 text-[13.5px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all font-medium text-gray-700 placeholder:text-gray-400"
              />
              <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={1.75} />
              {isSearching && (
                <IconLoader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
              )}
            </div>

            {/* Global Search History Dropdown — shown when input is focused and empty */}
            {showSuggestions && searchQuery.trim().length === 0 && globalSearchHistory.length > 0 && (
              <div className="absolute left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-1.5 overflow-hidden max-h-[280px] overflow-y-auto">
                <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Recent Searches</span>
                  <button
                    type="button"
                    className="text-[10px] text-red-500 font-semibold hover:text-red-600 cursor-pointer bg-transparent border-none"
                    onClick={() => {
                      localStorage.removeItem(GLOBAL_HISTORY_KEY);
                      setGlobalSearchHistory([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
                {globalSearchHistory.map((term, idx) => (
                  <button
                    key={`gh-${idx}`}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2.5 cursor-pointer text-sm text-gray-600 font-medium border-b border-gray-50 last:border-0"
                    onClick={() => {
                      setSearchQuery(term);
                      setShowSuggestions(true);
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {term}
                  </button>
                ))}
              </div>
            )}

            {/* Advanced Search Dropdown */}
            {showSuggestions && searchQuery.trim().length > 0 && searchResults && (
              <div className="absolute left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl mt-1.5 overflow-hidden divide-y divide-gray-50 max-h-[420px] overflow-y-auto">

                {/* Doctors Section */}
                {searchResults.doctors.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-indigo-500 tracking-wider uppercase bg-indigo-50/50 rounded-lg">
                      Doctors
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {searchResults.doctors.map((doc: any) => (
                        <button
                          key={`search-doc-${doc.id}`}
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-start gap-2.5 group cursor-pointer"
                          onClick={() => {
                            // Save the search term to global history before navigating
                            const term = searchQuery.trim();
                            if (term.length >= 2) {
                              const prev = globalSearchHistory.filter(h => h !== term);
                              const updated = [term, ...prev].slice(0, 8);
                              setGlobalSearchHistory(updated);
                              try { localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(updated)); } catch { /* quota */ }
                            }
                            navigate(`/doctors/${doc.id}`);
                            setShowSuggestions(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                            <IconStethoscope size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-700 truncate">{doc.name}</div>
                            <div className="text-xs text-gray-400 font-medium truncate">
                              {doc.specialization} &bull; {doc.qualification}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pharmacies Section */}
                {searchResults.pharmacies.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-amber-600 tracking-wider uppercase bg-amber-50/50 rounded-lg">
                      Pharmacies
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {searchResults.pharmacies.map((ph: any) => (
                        <button
                          key={`search-ph-${ph.id}`}
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-start gap-2.5 group cursor-pointer"
                          onClick={() => {
                            const term = searchQuery.trim();
                            if (term.length >= 2) {
                              const prev = globalSearchHistory.filter(h => h !== term);
                              const updated = [term, ...prev].slice(0, 8);
                              setGlobalSearchHistory(updated);
                              try { localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(updated)); } catch { /* quota */ }
                            }
                            navigate(`/pharmacies/${ph.id}`);
                            setShowSuggestions(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                            <IconBuildingStore size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-700 truncate">{ph.name}</div>
                            <div className="text-xs text-gray-400 font-medium truncate">
                              {ph.ownerName} &bull; {ph.contact}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products Section */}
                {searchResults.products.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-emerald-600 tracking-wider uppercase bg-emerald-50/50 rounded-lg">
                      Products
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {searchResults.products.map((prod: any) => (
                        <button
                          key={`search-prod-${prod.id}`}
                          type="button"
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-start gap-2.5 group cursor-pointer"
                          onClick={() => {
                            const term = searchQuery.trim();
                            if (term.length >= 2) {
                              const prev = globalSearchHistory.filter(h => h !== term);
                              const updated = [term, ...prev].slice(0, 8);
                              setGlobalSearchHistory(updated);
                              try { localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(updated)); } catch { /* quota */ }
                            }
                            navigate(`/products?search=${encodeURIComponent(prod.name)}`);
                            setShowSuggestions(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                            <IconPackage size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-700 truncate">{prod.name}</div>
                            <div className="text-xs text-gray-400 font-medium truncate">
                              Pack: {prod.pack || 'Standard'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.doctors.length === 0 && searchResults.pharmacies.length === 0 && searchResults.products.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 font-medium">
                    No results match your query
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Connection status badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-xs font-semibold text-emerald-700 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>AegisRx Connected</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-8 relative">
          <Outlet />
        </div>
      </main>

      {/* ── Secure Logout Confirmation Modal ─────────────────────────── */}
      <Modal
        opened={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-gray-900 font-bold text-base">
            <IconLogout size={18} className="text-red-500" />
            <span>Confirm Secure Logout</span>
          </div>
        }
        centered
        size="md"
        radius="md"
        overlayProps={{ backgroundOpacity: 0.5, blur: 3, color: '#0f172a' }}
        styles={{
          content: { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', padding: '20px' },
          header:  { borderBottom: '1px solid #f3f4f6', paddingBottom: '12px', backgroundColor: '#ffffff' },
        }}
      >
        <div className="flex flex-col gap-4 mt-2">
          <Text size="sm" className="text-gray-600 leading-relaxed">
            Are you sure you want to log out? You will need to sign in again to access the application.
          </Text>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <div className="shrink-0 text-amber-600 font-bold text-xs mt-0.5">NOTE:</div>
            <Text size="xs" className="text-amber-800 leading-normal">
              Any unsaved data or work in progress will be lost.
            </Text>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="default"
              onClick={() => setLogoutModalOpen(false)}
              className="border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-lg text-sm transition-all"
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                setLogoutModalOpen(false);
                handleLogout();
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-all"
            >
              Secure Logout
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
