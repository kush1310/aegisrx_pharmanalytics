import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Text,
  Group,
  SimpleGrid,
  Button,
  Badge,
  Table,
  Anchor
} from '@mantine/core';
import PageLoader from '../components/PageLoader';
import {
  IconStethoscope,
  IconBuildingStore,
  IconUpload,
  IconPackage,
  IconRefresh,
  IconArrowUpRight,
  IconCalendar,
  IconFile,
  IconCircleCheck,
  IconExternalLink
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

/**
 * Dashboard — AegisRx primary overview page.
 *
 * Renders:
 *   1. Page header with date and refresh button
 *   2. Three KPI stat cards (Doctors, Pharmacies, Products)
 *   3. Recent Uploads table (last 5 processed files)
 *
 * @fetches GET /api/stats/dashboard — KPI counts
 * @fetches GET /api/excel/history — Recent uploads for table
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { firstName, lastName, username } = useAuthStore();

  interface DashboardStats {
    doctorCount:         number;
    pharmacyCount:       number;
    productCount:        number;
    totalRevenue:        number;
    monthlyGrowth:       number;
    unreadNotifications: number;
  }

  interface RecentUpload {
    id:         number;
    fileName:   string;
    uploadDate: string;
    status:     string;
    fileSize:   number;
    detectedFormat?: string;
  }

  const [stats,        setStats]        = useState<DashboardStats | null>(null);
  const [recentUploads,setRecentUploads]= useState<RecentUpload[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [uploadsLoading,setUploadsLoading]= useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const result = await api.get<DashboardStats>('/api/stats/dashboard');
      if (result.success && result.data) {
        setStats(result.data as DashboardStats);
      }
    } catch (error) {
      console.error('[Dashboard] Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentUploads = async () => {
    try {
      setUploadsLoading(true);
      const result = await api.get<RecentUpload[]>('/api/excel/history');
      if (result.success && result.data) {
        const uploads = result.data as RecentUpload[];
        setRecentUploads(uploads.slice(0, 5));
      }
    } catch (error) {
      console.error('[Dashboard] Failed to fetch uploads:', error);
    } finally {
      setUploadsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRecentUploads();
    api.post('/api/notifications/check-events', {});
  }, []);

  /**
   * Formats bytes into a human-readable file size string.
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Formats ISO date string to Indian locale short date.
   */
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const statCards = [
    {
      label:   'Total Doctors',
      value:   stats?.doctorCount ?? 0,
      icon:    IconStethoscope,
      color:   '#4f46e5',
      bgColor: '#eef2ff',
      path:    '/doctors',
      sub:     'Registered profiles'
    },
    {
      label:   'Pharmacies',
      value:   stats?.pharmacyCount ?? 0,
      icon:    IconBuildingStore,
      color:   '#f59e0b',
      bgColor: '#fef3c7',
      path:    '/pharmacies',
      sub:     'Linked outlets'
    },
    {
      label:   'Products',
      value:   stats?.productCount ?? 0,
      icon:    IconPackage,
      color:   '#10b981',
      bgColor: '#ecfdf5',
      path:    '/products',
      sub:     'Catalogue items'
    }
  ];

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const userFullName = firstName && lastName ? `${firstName} ${lastName}` : (username || 'Admin');

  return (
    <div className="max-w-7xl mx-auto py-6 animate-fade-in">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200/60">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, <strong className="text-slate-700 font-bold">{userFullName}</strong>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold shadow-sm">
            <IconCalendar size={14} className="text-slate-400" />
            <span>{today}</span>
          </div>
          <Button
            variant="subtle"
            size="xs"
            color="gray"
            className="hover:bg-slate-100 transition-all"
            leftSection={<IconRefresh size={14} />}
            onClick={() => { fetchStats(); fetchRecentUploads(); }}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Stat Cards ───────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm mb-6 flex items-center justify-center min-h-[140px]">
          <PageLoader size={1.1} message="Retrieving dashboard stats..." />
        </div>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }} spacing="md" mb="xl">
          {statCards.map(stat => (
            <div
              key={stat.label}
              className="bg-white border border-slate-200/60 rounded-2xl p-6 flex items-center justify-between cursor-pointer shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
              onClick={() => navigate(stat.path)}
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-transparent group-hover:bg-gradient-to-r group-hover:from-indigo-500 group-hover:to-violet-600 transition-all duration-300" />
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{stat.label}</span>
                <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{stat.value}</span>
                <span className="text-slate-400 text-xs mt-1">{stat.sub}</span>
              </div>
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ background: stat.bgColor, color: stat.color }}
              >
                <stat.icon size={24} strokeWidth={2} />
              </div>
            </div>
          ))}
        </SimpleGrid>
      )}

      {/* ── Recent Uploads Table ─────────────────────────────── */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
        <Group justify="space-between" mb="md" className="border-b border-slate-100 pb-3">
          <div>
            <Text fw={700} className="text-slate-800 text-lg font-bold">Recent Uploads</Text>
            <Text size="xs" c="dimmed" className="text-slate-400 mt-0.5">Last 5 processed analytics files</Text>
          </div>
          <Anchor size="xs" onClick={() => navigate('/history')} className="text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer">
            View all <IconExternalLink size={12} />
          </Anchor>
        </Group>

        <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-white mt-4">
          {uploadsLoading ? (
            <div className="p-6">
              <PageLoader size={1.1} message="Loading recent uploads..." />
            </div>
          ) : recentUploads.length === 0 ? (
            <div className="text-center py-12 px-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50 m-4">
              <IconFile size={40} className="text-slate-300 stroke-1 animate-float" />
              <Text size="sm" c="dimmed" mt="xs" className="text-slate-400">No uploads yet. Upload your first analytics file.</Text>
              <Button
                size="sm"
                mt="md"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                leftSection={<IconUpload size={14} />}
                onClick={() => navigate('/upload')}
              >
                Upload File
              </Button>
            </div>
          ) : (
            <Table highlightOnHover className="min-w-full">
              <Table.Thead className="bg-slate-50">
                <Table.Tr>
                  <Table.Th className="text-xs font-semibold text-slate-500 py-3">File Name</Table.Th>
                  <Table.Th className="text-xs font-semibold text-slate-500 py-3">Upload Date</Table.Th>
                  <Table.Th className="text-xs font-semibold text-slate-500 py-3">Size</Table.Th>
                  <Table.Th className="text-xs font-semibold text-slate-500 py-3">Status</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }} className="text-xs font-semibold text-slate-500 py-3">Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentUploads.map(upload => (
                  <Table.Tr key={upload.id}>
                    <Table.Td className="py-3">
                      <Group gap="xs" wrap="nowrap">
                        <IconFile size={16} className="text-slate-400 shrink-0" />
                        <Text size="sm" fw={600} className="text-slate-700 truncate max-w-[240px]">
                          {upload.fileName}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td className="py-3">
                      <Text size="sm" c="dimmed" className="text-slate-500">{formatDate(upload.uploadDate)}</Text>
                    </Table.Td>
                    <Table.Td className="py-3">
                      <Text size="sm" c="dimmed" className="text-slate-500">{formatFileSize(upload.fileSize)}</Text>
                    </Table.Td>
                    <Table.Td className="py-3">
                      <Badge
                        size="sm"
                        variant="light"
                        color={upload.status === 'PROCESSED' ? 'green' : upload.status === 'ERROR' ? 'red' : 'yellow'}
                        leftSection={upload.status === 'PROCESSED' ? <IconCircleCheck size={11} /> : undefined}
                      >
                        {upload.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }} className="py-3">
                      {upload.detectedFormat === 'party_report' ? (
                        <Anchor
                          size="xs"
                          fw={700}
                          className="text-indigo-600 hover:text-indigo-700 flex items-center justify-end gap-0.5 cursor-pointer hover:underline inline-flex"
                          onClick={() => navigate(`/analytics?uploadId=${upload.id}`)}
                        >
                          View Analytics
                          <IconArrowUpRight size={12} />
                        </Anchor>
                      ) : (
                        <Text size="xs" c="dimmed" fw={700}>
                          Not Applicable
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
