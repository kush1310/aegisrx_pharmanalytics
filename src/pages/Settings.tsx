import { useState, useEffect } from 'react';
import {
  Text,
  Button,
  Modal,
  TextInput,
  Group
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconLogout,
  IconRefresh,
  IconCheck,
  IconUser,
  IconSettings,
  IconDatabase,
  IconInfoCircle,
  IconShieldCheck
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import PageLoader from '@/components/PageLoader';
import { api } from '../lib/api';

/**
 * SettingsPage
 *
 * Renders the application Settings page with a two-column grid layout. The left
 * column contains Account and Data Management cards, while the right column
 * contains Application information and About Platform sections. Provides
 * functionality for secure logout (with confirmation modal and full-screen
 * overlay) and clearing the application cache (navigation history reset and
 * local storage token removal). All database records and uploaded Excel files
 * remain unaffected by cache clearing.
 *
 * @returns {JSX.Element} - The fully rendered Settings page component.
 * @validates - Logout confirmation requires explicit user action via modal.
 * @redirects - /login (on successful logout after 3-second delay).
 * @edge-cases - If username is null/undefined, the display falls back gracefully.
 */
export default function Settings() {
  const navigate = useNavigate();
  const { logout, username } = useAuthStore();
  const { reset: resetNavigation } = useNavigationStore();
  
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [dbPathInfo, setDbPathInfo] = useState<{ defaultDir: string; customDir: string; activeDbPath: string; isCustom: boolean } | null>(null);
  const [targetDir, setTargetDir] = useState('');
  const [isSavingDbPath, setIsSavingDbPath] = useState(false);
  const [isResettingDbPath, setIsResettingDbPath] = useState(false);

  const fetchDbPath = async () => {
    try {
      const res = await api.get<any>('/api/settings/db-path');
      if (res.success && res.data) {
        setDbPathInfo(res.data);
        setTargetDir(res.data.customDir || res.data.defaultDir);
      }
    } catch (err) {
      console.error('Failed to fetch database path:', err);
    }
  };

  useEffect(() => {
    fetchDbPath();
  }, []);

  const handleSaveDbPath = async () => {
    if (!targetDir.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Database directory path cannot be empty.',
        color: 'red'
      });
      return;
    }
    setIsSavingDbPath(true);
    try {
      const res = await api.post<any>('/api/settings/db-path', { databaseDir: targetDir.trim() });
      if (res.success) {
        notifications.show({
          title: 'Database Path Updated',
          message: 'The database connection was re-initialized at the new location.',
          color: 'green',
          icon: <IconCheck size={18} />
        });
        fetchDbPath();
      } else {
        notifications.show({
          title: 'Update Failed',
          message: res.error || 'Failed to update database path.',
          color: 'red'
        });
      }
    } catch (err: any) {
      notifications.show({
        title: 'Update Failed',
        message: err.message || 'An error occurred.',
        color: 'red'
      });
    } finally {
      setIsSavingDbPath(false);
    }
  };

  const handleResetDbPath = async () => {
    setIsResettingDbPath(true);
    try {
      const res = await api.post<any>('/api/settings/reset-db-path', {});
      if (res.success) {
        notifications.show({
          title: 'Database Path Reset',
          message: 'The database location has been reset to default.',
          color: 'green',
          icon: <IconCheck size={18} />
        });
        fetchDbPath();
      } else {
        notifications.show({
          title: 'Reset Failed',
          message: res.error || 'Failed to reset database path.',
          color: 'red'
        });
      }
    } catch (err: any) {
      notifications.show({
        title: 'Reset Failed',
        message: err.message || 'An error occurred.',
        color: 'red'
      });
    } finally {
      setIsResettingDbPath(false);
    }
  };
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * handleLogout
   *
   * Initiates a secure logout sequence by displaying a full-screen overlay
   * for 3 seconds, then clearing the authentication state, resetting navigation
   * history, and redirecting to the login page.
   *
   * @returns {void}
   * @redirects - /login (after 3-second delay).
   * @edge-cases - If already logging out, the function is not re-invocable due
   *               to UI being blocked by the overlay.
   */
  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      logout();
      resetNavigation();
      navigate('/login');
    }, 3000);
  };

  /**
   * handleClearCache
   *
   * Resets the in-app navigation history (undo/redo stack stored in Zustand)
   * and removes the locally stored authentication session token from
   * localStorage. Database records stored in SQLite and uploaded Excel files
   * are NOT affected by this operation.
   *
   * @returns {void}
   * @validates - No input validation required; this is a one-shot action.
   * @edge-cases - If localStorage key does not exist, removeItem is a no-op.
   */
  const handleClearCache = () => {
    resetNavigation();
    localStorage.removeItem('suratpharma-auth');
    
    notifications.show({
      title: 'Cache Cleared',
      message: 'Application cache has been cleared successfully',
      color: 'green',
      icon: <IconCheck size={18} />
    });
  };

  /** Team member data for the About Platform section */
  const teamMembers = [
    {
      initials: 'KS',
      name: 'Kush Shah',
      role: 'Lead Backend Dev + Security Testing',
      gradient: 'from-indigo-500 to-purple-600',
      roleColor: 'text-indigo-600'
    },
    {
      initials: 'KP',
      name: 'Krina Parikh',
      role: 'Full Stack & DB Admin',
      gradient: 'from-pink-500 to-rose-500',
      roleColor: 'text-rose-600'
    },
    {
      initials: 'IS',
      name: 'Ishan Shastri',
      role: 'Full-Stack Developer',
      gradient: 'from-blue-500 to-indigo-600',
      roleColor: 'text-blue-600'
    },
    {
      initials: 'VK',
      name: 'Visha Kardani',
      role: 'Backend Developer',
      gradient: 'from-emerald-500 to-teal-500',
      roleColor: 'text-emerald-600'
    }
  ];

  return (
    <div className="max-w-[1440px] mx-auto py-6 px-6 animate-fade-in">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="mb-6 pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-slate-500">Manage your application preferences and account</p>
      </div>

      {/* ── Two-Column Grid Layout ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column: Account & Data Management ─────────────────── */}
        <div className="space-y-6 lg:col-span-1">

          {/* Account Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-[0px_1px_3px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.1),0px_2px_4px_-1px_rgba(15,23,42,0.06)] transition-all duration-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <IconUser size={20} className="text-slate-800" />
              <h2 className="text-base font-semibold text-slate-800">Account</h2>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Username</p>
                  <p className="text-base font-medium text-slate-900">{username}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm">
                  Active
                </span>
              </div>
              <div className="border-t border-slate-200 pt-4 mt-4">
                <Button
                  variant="light"
                  color="red"
                  fullWidth
                  className="hover:bg-red-100 active:scale-[0.98] transition-all"
                  leftSection={<IconLogout size={18} />}
                  onClick={() => setLogoutModalOpen(true)}
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>

          {/* Data Management Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-[0px_1px_3px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.1),0px_2px_4px_-1px_rgba(15,23,42,0.06)] transition-all duration-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <IconDatabase size={20} className="text-slate-800" />
              <h2 className="text-base font-semibold text-slate-800">Data Management</h2>
            </div>
            <div className="p-4 space-y-4">
              <Button
                variant="light"
                color="indigo"
                fullWidth
                className="hover:bg-indigo-100 active:scale-[0.98] transition-all"
                leftSection={<IconRefresh size={18} />}
                onClick={handleClearCache}
              >
                Clear Application Cache
              </Button>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Clears navigation history, session tokens, and temporary UI state. Your database records and uploaded Excel files are not affected.
              </p>

              {/* Informational Callout Box */}
              <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
                <div className="flex items-start gap-2.5">
                  <IconShieldCheck size={20} className="text-sky-600 mt-0.5 shrink-0" />
                  <ul className="text-[13px] text-sky-800 space-y-1.5 list-disc pl-4">
                    <li>Resets the in-app navigation history (undo/redo stack)</li>
                    <li>Removes the locally stored authentication session token</li>
                    <li className="font-medium">Does NOT delete any SQLite database records</li>
                    <li className="font-medium">Does NOT remove uploaded Excel files or analytics data</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Application & About ──────────────────────── */}
        <div className="space-y-6 lg:col-span-2">

          {/* Application Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-[0px_1px_3px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.1),0px_2px_4px_-1px_rgba(15,23,42,0.06)] transition-all duration-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <IconSettings size={20} className="text-slate-800" />
              <h2 className="text-base font-semibold text-slate-800">Application</h2>
            </div>
            <div>
              {/* Version Row */}
              <div className="px-4 py-3.5 flex justify-between items-center border-b border-slate-100">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">Version</p>
                  <p className="text-sm text-slate-700">AegisRx Analytics Platform</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-indigo-300 text-indigo-600 bg-indigo-50">
                  v1.8.9
                </span>
              </div>
              {/* Database Row */}
              <div className="px-4 py-3.5 flex justify-between items-center">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">Database</p>
                  <p className="text-sm text-slate-700">SQLite (Local)</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                  Connected
                </span>
              </div>
            </div>
          </div>

          {/* Database Location Configuration Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-[0px_1px_3px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.1),0px_2px_4px_-1px_rgba(15,23,42,0.06)] transition-all duration-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <IconDatabase size={20} className="text-slate-800" />
              <h2 className="text-base font-semibold text-slate-800">Database Location</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Active Database Path</p>
                <code className="text-xs block bg-slate-50 p-2.5 rounded border border-slate-200/60 font-mono text-slate-700 break-all select-all">
                  {dbPathInfo ? dbPathInfo.activeDbPath : 'Loading...'}
                </code>
                {dbPathInfo && (
                  <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${dbPathInfo.isCustom ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {dbPathInfo.isCustom ? 'Custom Storage Location' : 'Default AppData Storage'}
                  </span>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <TextInput
                  label="Database Storage Directory"
                  placeholder="e.g. C:\AegisRxData"
                  value={targetDir}
                  onChange={(e) => setTargetDir(e.currentTarget.value)}
                  description="Select a folder on C, D or E drive. If the directory does not contain 'suratpharma.db', the app will automatically copy your existing database there."
                />
                
                <Group justify="flex-end" gap="sm" mt="md">
                  {dbPathInfo?.isCustom && (
                    <Button
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={handleResetDbPath}
                      loading={isResettingDbPath}
                    >
                      Reset to Default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-all px-4 py-2"
                    onClick={handleSaveDbPath}
                    loading={isSavingDbPath}
                  >
                    Save Directory
                  </Button>
                </Group>
              </div>
            </div>
          </div>

          {/* About Platform Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-[0px_1px_3px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-[0px_4px_6px_-1px_rgba(15,23,42,0.1),0px_2px_4px_-1px_rgba(15,23,42,0.06)] transition-all duration-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <IconInfoCircle size={20} className="text-slate-800" />
              <h2 className="text-base font-semibold text-slate-800">About Platform</h2>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                <strong>AegisRx Analytics</strong> is a secure pharmaceutical network management and business intelligence platform. It helps pharmaceutical teams clean product lists, automatically link doctors with pharmacies, and gain key insights into product sales distribution.
              </p>

              <div className="pt-1">
                <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-4">The Development Team</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {teamMembers.map((member) => (
                    <div
                      key={member.initials}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50 transition-all duration-200"
                    >
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${member.gradient} flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0`}>
                        {member.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{member.name}</p>
                        <p className={`text-[11px] font-semibold ${member.roleColor}`}>{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Text size="xs" c="dimmed" className="text-slate-400 mt-4 text-center pt-2 border-t border-slate-100">
                &copy; 2026 AegisRx Analytics. All rights reserved.
              </Text>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
