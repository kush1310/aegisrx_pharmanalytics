/**
 * Analytics — PharmaLens Business Intelligence
 *
 * Primary view: Doctor Business Summary table
 *   - Doctor → Pharmacy → Total Amount (from SalesTransaction data)
 *   - Click "Details" on any pharmacy row to expand medicine-wise bifurcation
 *
 * Secondary tabs: Visual charts
 *   - Bar chart: Top doctors by revenue
 *   - Pie chart: Revenue share by pharmacy
 *   - Bar chart: Top products by sale qty
 *   - Scatter/bar chart: Free vs Paid goods comparison
 *
 * @fetches GET /api/excel/doctor-business — grouped doctor-pharmacy-medicine totals
 * @fetches GET /api/excel/list            — upload history for upload selection
 */
import { useEffect, useMemo, useState, Fragment } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { modals } from '@mantine/modals';
import {
  Text, Group, Button,
  Select, Tabs, Paper, Stack, Checkbox,
  Card, Badge, Table, TextInput
} from '@mantine/core';
import GlobalLoadingOverlay from '../components/GlobalLoadingOverlay';
import { MultiStepLoader } from '@/components/ui/multi-step-loader';
import { notifications as notify } from '@mantine/notifications';

const aegisLoadingStates = [
  { text: "Initializing AegisRx intelligence engine..." },
  { text: "Scanning sales transaction rows..." },
  { text: "Validating data signatures and formats..." },
  { text: "Resolving doctor-pharmacy linkages..." },
  { text: "Deduplicating customer transaction records..." },
  { text: "Calculating revenue efficiency ratios..." },
  { text: "Rendering interactive analytics dashboards..." }
];
import {
  IconChartBar,
  IconTable,
  IconDownload,
  IconChevronDown,
  IconChevronRight,
  IconCurrencyRupee,
  IconStethoscope,
  IconBuildingStore,
  IconPill,
  IconRefresh,
  IconFilter,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  ComposedChart, Line
} from 'recharts';
import { exportBusinessSummaryExcel } from '@/utils/export';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/appStore';
import styles from './Analytics.module.css';

/* ── Chart colour palette ─────────────────────────────────────── */
const CHART_COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6',
  '#ef4444', '#06b6d4', '#22c55e', '#e11d48', '#ec4899'
];

/* ── Type definitions ─────────────────────────────────────────── */
interface MedicineRow    { productId: number; name: string; amount: number; saleQty: number; }
interface PharmacyGroup  { pharmacyId: number; pharmacyName: string; totalAmount: number; medicines: MedicineRow[]; }
interface DoctorGroup    { doctorId: number | null; doctorName: string; pharmacies: PharmacyGroup[]; grandTotal: number; }
interface UploadSummary  { id: number; fileName: string; uploadDate: string; }

/* ── Helpers ──────────────────────────────────────────────────── */
const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortName = (name: string, max = 18) => name.length > max ? name.slice(0, max) + '…' : name;

/* ── Custom Tooltip for charts ────────────────────────────────── */
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className={styles.tooltipValue}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className={styles.chartTooltip}>
      <p className={styles.tooltipLabel}>{entry.name}</p>
      <p className={styles.tooltipValue} style={{ color: entry.payload.fill }}>{fmt(entry.value)}</p>
    </div>
  );
};

/* ================================================================
   Analytics Component
   ================================================================ */
export default function Analytics() {
  const navigate      = useNavigate();
  const [searchParams]= useSearchParams();
  const { id: routeId } = useParams();
  const uploadIdParam = searchParams.get('uploadId') || routeId;
  const { selectedAnalyticsUploadId, setSelectedAnalyticsUploadId } = useAppStore();

  const [doctorGroups,   setDoctorGroups]   = useState<DoctorGroup[]>([]);
  const [uploads,        setUploads]         = useState<UploadSummary[]>([]);
  const selectedUpload = uploadIdParam || selectedAnalyticsUploadId || null;
  const [sortMode,       setSortMode]        = useState<'amount' | 'name'>('amount');
  const [loading,        setLoading]         = useState(true);
  const newUploadParam = searchParams.get('newUpload') === 'true';
  const [isNewUpload, setIsNewUpload] = useState(newUploadParam);
  const [expandedRows,   setExpandedRows]    = useState<Set<number>>(new Set());
  const [dateRange,      setDateRange]       = useState<{ minDate: string | null; maxDate: string | null }>({ minDate: null, maxDate: null });
  const [activeTab,      setActiveTab]       = useState<string | null>('summary');

  // Pandas Analytics state hooks
  const [pandasData, setPandasData] = useState<{
    topPharmacies: { name: string; revenue: number }[];
    topDoctors: { name: string; revenue: number }[];
    topProducts: { name: string; revenue: number; quantity: number }[];
    doctorRatio: { name: string; pharmacies: number; revenue: number; ratio: number }[];
  } | null>(null);
  const [ratioPage, setRatioPage] = useState(0);
  const [ratioSearchQuery, setRatioSearchQuery] = useState('');

  // Doctor checklist filters
  const [allDoctors, setAllDoctors] = useState<{ id: number; name: string }[]>([]);
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');

  /* ── Sync selected upload param from URL and store ──────────── */
  // Sync URL parameter to Zustand store (only when uploadIdParam changes to break cycles)
  useEffect(() => {
    setSelectedAnalyticsUploadId(uploadIdParam || null);
  }, [uploadIdParam, setSelectedAnalyticsUploadId]);

  // Sync Zustand store back to URL parameter
  useEffect(() => {
    if (!uploadIdParam && selectedAnalyticsUploadId) {
      const params = new URLSearchParams(window.location.search);
      params.set('uploadId', selectedAnalyticsUploadId);
      navigate(`/analytics?${params.toString()}`, { replace: true });
    }
  }, [uploadIdParam, selectedAnalyticsUploadId, navigate]);

  /**
   * handleUploadChange
   *
   * Updates the active upload in the Zustand store and propagates the selection
   * to the URL path query parameters to fetch new analytics dashboards.
   *
   * @param  {string | null} val - Selected upload ID; null if cleared.
   * @returns {void}
   */
  const handleUploadChange = (val: string | null) => {
    setSelectedAnalyticsUploadId(val);
    const params = new URLSearchParams(window.location.search);
    if (val) {
      params.set('uploadId', val);
    } else {
      params.delete('uploadId');
    }
    params.delete('newUpload');
    navigate(`/analytics?${params.toString()}`);
  };

  /* ── Fetch uploads list — only party_report (sales) uploads shown ─── */
  const fetchUploads = async () => {
    try {
      const res = await api.get<UploadSummary[]>('/api/excel/history');
      if (res.success && res.data) {
        // Only show uploads that contain sales transaction data (party_report format)
        // Doctor/pharmacy/product master uploads have no analytics data to display
        const allUploads = res.data as (UploadSummary & { detectedFormat?: string })[];
        const salesUploads = allUploads.filter(
          u => u.detectedFormat === 'party_report' || u.detectedFormat === undefined
        );
        setUploads(salesUploads);
      }
    } catch (err) {
      console.error('[Analytics] Failed to fetch uploads:', err);
    }
  };


  /**
   * fetchBusinessData
   *
   * Fetches the grouped doctor business summary and pandas analytics data from the API.
   * Controls the loading states (either standard spinner or multi-step loader for new uploads)
   * with a minimum static duration of 0.8 seconds to avoid UI thrashing.
   *
   * @param  None
   * @returns {Promise<void>} - Resolves when data fetching and state updates are complete.
   * @validates - Checks if a file upload ID is active and appends it to search query parameters.
   * @redirects - Cleanses the URL by replacing search parameters after a new upload finishes.
   * @edge-cases - Displays mantine notification toasts on network or database failures.
   */
  const fetchBusinessData = async () => {
    if (!selectedUpload) {
      setDoctorGroups([]);
      setAllDoctors([]);
      setSelectedDoctors([]);
      setPandasData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const startTime = Date.now();
    try {
      const params = new URLSearchParams({ sort: sortMode });
      params.set('uploadId', selectedUpload);

      const res = await api.get<DoctorGroup[]>(`/api/excel/doctor-business?${params.toString()}`);
      if (res.success && res.data) {
        setDoctorGroups(res.data as DoctorGroup[]);
        setDateRange({
          minDate: (res as any).minDate || null,
          maxDate: (res as any).maxDate || null
        });
        
        // Dynamically populate allDoctors and selectedDoctors based on the actual doctor groups present in the data!
        const activeDocs = res.data
          .filter((dg: any) => dg.doctorId !== null)
          .map((dg: any) => ({ id: dg.doctorId, name: dg.doctorName }));
        
        setAllDoctors(activeDocs);
        // Auto-select all active doctors + unlinked by default so that the grand total revenue is correct immediately
        setSelectedDoctors([...activeDocs.map((d: any) => String(d.id)), 'unlinked']);
      } else {
        notify.show({ title: 'Error', message: 'Failed to load business data', color: 'red' });
      }

      // ── NEW: Fetch Pandas-based Analytics Data ────────────────────
      if (selectedUpload) {
        const pandasRes = await api.get<any>(`/api/excel/pandas-analytics?uploadId=${selectedUpload}`);
        if (pandasRes.success && pandasRes.data) {
          setPandasData(pandasRes.data);
          setRatioPage(0); // reset page to beginning
        }
      } else {
        setPandasData(null);
      }
    } catch (err) {
      console.error('[Analytics] Fetch error:', err);
      notify.show({ title: 'Error', message: 'Could not reach server', color: 'red' });
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 800 - elapsed);
      setTimeout(() => {
        setLoading(false);
      }, remaining);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  useEffect(() => {
    fetchBusinessData();
  }, [selectedUpload, sortMode]);

  /* ── Filtered groups based on checkboxes ────────────────────── */
  const filteredDoctorGroups = useMemo(() => {
    return doctorGroups.filter(dg => {
      if (dg.doctorId === null) {
        return selectedDoctors.includes('unlinked');
      }
      return selectedDoctors.includes(String(dg.doctorId));
    });
  }, [doctorGroups, selectedDoctors]);

  /* ── Computed aggregates ────────────────────────────────────── */
  const grandTotal = useMemo(
    () => filteredDoctorGroups.reduce((s, d) => s + d.grandTotal, 0),
    [filteredDoctorGroups]
  );

  const totalPharmacies = useMemo(
    () => filteredDoctorGroups.reduce((s, d) => s + d.pharmacies.length, 0),
    [filteredDoctorGroups]
  );

  /* ── Chart data builders ────────────────────────────────────── */
  const topDoctorsChartData = useMemo(() => {
    if (pandasData?.topDoctors) {
      return pandasData.topDoctors.map(d => ({ name: d.name, amount: d.revenue }));
    }
    return [...filteredDoctorGroups]
      .filter(d => d.doctorId !== null)
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .slice(0, 10)
      .map(d => ({ name: shortName(d.doctorName, 14), amount: d.grandTotal }));
  }, [filteredDoctorGroups, pandasData]);

  const pharmacyPieData = useMemo(() => {
    if (pandasData?.topPharmacies) {
      // Use FULL names of pharmacies as requested by the user
      return pandasData.topPharmacies.map(p => ({ name: p.name, value: p.revenue }));
    }
    const flat: { name: string; value: number }[] = [];
    for (const d of filteredDoctorGroups) {
      for (const p of d.pharmacies) {
        flat.push({ name: p.pharmacyName, value: p.totalAmount });
      }
    }
    return flat.sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredDoctorGroups, pandasData]);

  const topProductsChartData = useMemo(() => {
    if (pandasData?.topProducts) {
      // Top 10 products with both revenue and quantity
      return pandasData.topProducts.slice(0, 10).map(p => ({
        name: shortName(p.name, 14),
        amount: p.revenue,
        quantity: p.quantity
      }));
    }
    const productMap = new Map<string, number>();
    for (const d of filteredDoctorGroups) {
      for (const p of d.pharmacies) {
        for (const m of p.medicines) {
          productMap.set(m.name, (productMap.get(m.name) || 0) + m.amount);
        }
      }
    }
    return [...productMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Display exactly top 10 products
      .map(([name, amount]) => ({ name: shortName(name, 14), amount, quantity: 0 }));
  }, [filteredDoctorGroups, pandasData]);

  // Filtered and Paginated Doctor Revenue Ratio Data
  const filteredRatioData = useMemo(() => {
    if (!pandasData?.doctorRatio) return [];
    if (!ratioSearchQuery.trim()) return pandasData.doctorRatio;
    const query = ratioSearchQuery.toLowerCase().trim();
    return pandasData.doctorRatio.filter(doc => 
      doc.name.toLowerCase().includes(query)
    );
  }, [pandasData, ratioSearchQuery]);

  const paginatedRatioData = useMemo(() => {
    const start = ratioPage * 15;
    return filteredRatioData.slice(start, start + 15);
  }, [filteredRatioData, ratioPage]);

  /* ── Row expand toggle ──────────────────────────────────────── */
  const toggleExpand = (pharmacyId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(pharmacyId) ? next.delete(pharmacyId) : next.add(pharmacyId);
      return next;
    });
  };

  /* ── Export handlers ────────────────────────────────────────── */
  const handleExportExcel = () => {
    const filename = activeTab === 'charts' ? 'aegisrx-business-summarycharts' : 'aegisrx-business-summary';
    exportBusinessSummaryExcel(filteredDoctorGroups, dateRange, filename);
    notify.show({ title: 'Exported', message: 'Excel file downloaded successfully', color: 'green' });
  };

  /* ── KPI Cards data ─────────────────────────────────────────── */
  const linkedRevenue   = useMemo(() => filteredDoctorGroups.filter(d => d.doctorId !== null).reduce((s, d) => s + d.grandTotal, 0), [filteredDoctorGroups]);
  const unlinkedRevenue = useMemo(() => filteredDoctorGroups.filter(d => d.doctorId === null).reduce((s, d) => s + d.grandTotal, 0), [filteredDoctorGroups]);

  const kpiCards = [
    { label: 'Total Revenue',      value: fmt(grandTotal),       icon: IconCurrencyRupee, color: '#4f46e5', bg: '#eef2ff',
      sub: `Linked: ${fmt(linkedRevenue)} | Unlinked: ${fmt(unlinkedRevenue)}` },
    { label: 'Linked Doctors',     value: filteredDoctorGroups.filter(d => d.doctorId !== null).length, icon: IconStethoscope, color: '#10b981', bg: '#ecfdf5', sub: null },
    { label: 'Pharmacies',         value: totalPharmacies,       icon: IconBuildingStore, color: '#f59e0b', bg: '#fef3c7', sub: null },
    { label: 'Product Lines',      value: topProductsChartData.length, icon: IconPill, color: '#3b82f6', bg: '#eff6ff', sub: null },
  ];

  const handleSelectAll = () => {
    setSelectedDoctors([...allDoctors.map(d => String(d.id)), 'unlinked']);
  };

  const handleClearAll = () => {
    setSelectedDoctors([]);
  };

  /**
   * handleClearAllAnalytics
   *
   * Prompt the user for confirmation to close the active analytics dashboard.
   * On confirmation, resets the active upload state, deselects the current
   * file, clears the doctor groups data grid, and resets store values, returning
   * the view to an empty template without deleting the upload history file.
   *
   * @returns {void}
   * @validates      - Validates that an active upload is selected (selectedUpload is not null).
   * @redirects      - Navigates to /analytics path to strip any query parameters.
   * @edge-cases     - If no upload is selected, the function exits early without displaying a modal.
   */
  const handleClearAllAnalytics = () => {
    if (!selectedUpload) return;
    modals.openConfirmModal({
      title: 'Close Analytics?',
      centered: true,
      children: (
        <Text size="sm">
          Close Analytics? This resets the active analytics page. The upload file remains in your History log.
        </Text>
      ),
      labels: { confirm: 'Confirm', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        setSelectedAnalyticsUploadId(null);
        setDoctorGroups([]);
        navigate('/analytics');
        notify.show({ title: 'Analytics Closed', message: 'Current analytics view has been cleared', color: 'blue' });
      }
    });
  };

  return (
    <div className={styles.container}>
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Analytics</h1>
          <p className={styles.pageSubtitle}>Business summary by doctor and pharmacy</p>
        </div>
        <Group gap="sm">
          <Select
            placeholder="Select upload file..."
            data={uploads.map(u => ({
              value: String(u.id),
            label: `${u.fileName.replace(/\.(xlsx?|csv|pdf)$/i, '')} — ${new Date(u.uploadDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }))}
            value={selectedUpload || ''}
            onChange={handleUploadChange}
            size="sm"
            style={{ width: 280 }}
            leftSection={<IconFilter size={14} />}
          />
          <Select
            data={[
              { value: 'amount', label: 'Sort by Revenue' },
              { value: 'name',   label: 'Sort by Name' },
            ]}
            value={sortMode}
            onChange={v => setSortMode(v as 'amount' | 'name')}
            size="sm"
            style={{ width: 160 }}
          />
          <Button
            variant="subtle"
            size="sm"
            leftSection={<IconRefresh size={14} />}
            onClick={fetchBusinessData}
            loading={loading}
            color="gray"
          >
            Refresh
          </Button>
          <Button
            size="sm"
            leftSection={<IconDownload size={14} />}
            onClick={handleExportExcel}
          >
            Export Excel
          </Button>
          {uploads.length > 0 && (
            <Button
              variant="outline"
              color="red"
              size="sm"
              onClick={handleClearAllAnalytics}
            >
              Clear Analytics
            </Button>
          )}
        </Group>
      </div>

      {!selectedUpload ? (
        <Paper p="xl" radius="md" withBorder className={styles.emptyState} mt="xl">
          <Stack align="center" gap="sm">
            <IconChartBar size={48} stroke={1} color="#94a3b8" />
            <Text fw={600} size="sm">No upload selected</Text>
            <Text size="xs" c="dimmed">Please select a file upload from the dropdown above to view analytics.</Text>
            <Button size="xs" variant="light" onClick={() => navigate('/upload')}>
              Upload File (Excel, CSV, or PDF)
            </Button>
          </Stack>
        </Paper>
      ) : (
        <div className="relative min-h-[500px] mt-6">
          <div className="transition-all duration-300">
            {/* ── KPI Bar ──────────────────────────────────────────── */}
            <div className={styles.kpiBar}>
              {kpiCards.map(card => (
                <div key={card.label} className={styles.kpiCard}>
                  <div className={styles.kpiLeft}>
                    <span className={styles.kpiLabel}>{card.label}</span>
                    <span className={styles.kpiValue}>{card.value}</span>
                    {card.sub && (
                      <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginTop: 2, letterSpacing: '0.01em' }}>
                        {card.sub}
                      </span>
                    )}
                  </div>
                  <div className={styles.kpiIcon} style={{ background: card.bg, color: card.color }}>
                    <card.icon size={20} strokeWidth={1.75} />
                  </div>
                </div>
              ))}
            </div>

          {/* ── Main Tabs ────────────────────────────────────────── */}
          <Tabs value={activeTab} onChange={setActiveTab} className={`${styles.tabs} analytics-tabs`}>
        <Tabs.List>
          <Tabs.Tab value="summary" leftSection={<IconTable    size={14} />}>Business Summary</Tabs.Tab>
          <Tabs.Tab value="charts"  leftSection={<IconChartBar size={14} />}>Charts</Tabs.Tab>
          <Tabs.Tab value="tables"  leftSection={<IconTable    size={14} />}>Top 10 Tables</Tabs.Tab>
        </Tabs.List>

        {/* ── BUSINESS SUMMARY TABLE ───────────────────────── */}
        <Tabs.Panel value="summary" pt="md">
          {/* Doctor Selection Checkboxes */}
          {!loading && allDoctors.length > 0 && (
            <Paper p="md" radius="lg" withBorder mb="lg" style={{ backgroundColor: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.04em' }}>Filter Analytics by Doctor:</Text>
                <Group gap="xs">
                  <TextInput
                    placeholder="Search doctor..."
                    value={doctorSearchQuery}
                    onChange={(e) => setDoctorSearchQuery(e.currentTarget.value)}
                    size="xs"
                    style={{ width: 180 }}
                  />
                  <Button size="xs" variant="subtle" onClick={handleSelectAll}>Select All</Button>
                  <Button size="xs" variant="subtle" color="red" onClick={handleClearAll}>Clear All</Button>
                </Group>
              </Group>
              <div 
                className="max-h-[160px] overflow-y-auto pr-2 mt-2 flex flex-wrap gap-x-6 gap-y-3 border border-slate-100 rounded-lg p-3 bg-slate-50/50"
              >
                {allDoctors
                  .filter(doc => doc.name.toLowerCase().includes(doctorSearchQuery.toLowerCase()))
                  .map(doc => (
                    <Checkbox
                      key={doc.id}
                      label={doc.name}
                      checked={selectedDoctors.includes(String(doc.id))}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setSelectedDoctors(prev => {
                          if (checked) return [...prev, String(doc.id)];
                          return prev.filter(id => id !== String(doc.id));
                        });
                      }}
                    />
                  ))}
                {("unlinked pharmacies".includes(doctorSearchQuery.toLowerCase()) || "unlinked".includes(doctorSearchQuery.toLowerCase())) && (
                  <Checkbox
                    key="unlinked"
                    label="Unlinked Pharmacies"
                    checked={selectedDoctors.includes('unlinked')}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setSelectedDoctors(prev => {
                        if (checked) return [...prev, 'unlinked'];
                        return prev.filter(id => id !== 'unlinked');
                      });
                    }}
                  />
                )}
              </div>
            </Paper>
          )}

            {filteredDoctorGroups.length === 0 ? (
              <Paper p="xl" radius="md" withBorder className={styles.emptyState}>
                <Stack align="center" gap="sm">
                  <IconChartBar size={48} stroke={1} color="#94a3b8" />
                  <Text fw={600} size="sm">No business data matches selection</Text>
                  <Text size="xs" c="dimmed">Please select doctors from the checkboxes or upload a file.</Text>
                  <Button size="xs" variant="light" onClick={() => navigate('/upload')}>
                    Upload Analytics File (Excel, CSV, or PDF)
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <Stack gap="md">
                {filteredDoctorGroups.map(doctor => (
                  <Card key={doctor.doctorName} shadow="sm" radius="lg" p="xl" withBorder className="border-slate-200/60 bg-white/70 backdrop-blur-md">
                    <Group justify="space-between" mb="md" className="border-b border-slate-100 pb-3">
                      <Group gap="xs">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <IconStethoscope size={16} />
                        </div>
                        <Text fw={800} className="text-slate-800 text-base">{doctor.doctorName}</Text>
                      </Group>
                      <Group gap="xs">
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Business Total:</span>
                        <Badge size="lg" color="indigo" variant="gradient" gradient={{ from: 'indigo', to: 'violet', deg: 90 }} className="font-extrabold">{fmt(doctor.grandTotal)}</Badge>
                      </Group>
                    </Group>

                    <div className="overflow-hidden border border-slate-100 rounded-xl bg-white">
                      <Table highlightOnHover className="min-w-full">
                        <Table.Thead className="bg-slate-50/50">
                          <Table.Tr>
                            <Table.Th className="text-xs font-semibold text-slate-500 py-3 pl-4">Pharmacy Name</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }} className="text-xs font-semibold text-slate-500 py-3 pr-4">Amount</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {doctor.pharmacies.map(pharmacy => (
                            <Fragment key={pharmacy.pharmacyId}>
                              <Table.Tr className="hover:bg-slate-50/50 transition-colors">
                                <Table.Td className="py-3 pl-4">
                                  <Group gap="xs">
                                    <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                                      <IconBuildingStore size={14} />
                                    </div>
                                    <Text size="sm" className="font-medium text-slate-700">{pharmacy.pharmacyName}</Text>
                                  </Group>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }} className="py-3 pr-4">
                                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                                    <span className="font-bold text-slate-800 font-mono text-sm">{fmt(pharmacy.totalAmount)}</span>
                                    {pharmacy.medicines.length > 0 && (
                                      <Button
                                        variant="light"
                                        color="indigo"
                                        size="xs"
                                        onClick={() => toggleExpand(pharmacy.pharmacyId)}
                                        rightSection={expandedRows.has(pharmacy.pharmacyId) ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                                        className="h-6 text-[10px] font-semibold active:scale-95 transition-transform"
                                      >
                                        {pharmacy.medicines.length} Meds · Breakdown
                                      </Button>
                                    )}
                                  </Group>
                                </Table.Td>
                              </Table.Tr>

                              {/* Expanded medicines breakdown for this pharmacy */}
                              {expandedRows.has(pharmacy.pharmacyId) && (
                                <Table.Tr>
                                  <Table.Td colSpan={2} className="bg-slate-50/40 p-0">
                                    <div className="pl-12 pr-6 py-3 border-l-4 border-indigo-500 bg-slate-50/20">
                                      <Table className="min-w-full">
                                        <Table.Tbody>
                                          {pharmacy.medicines.map(med => (
                                            <Table.Tr key={`med-${med.productId}`} className="border-none hover:bg-transparent">
                                              <Table.Td className="py-1.5 px-3 border-none">
                                                <Group gap="xs">
                                                  <IconPill size={13} className="text-slate-400" />
                                                  <span className="text-xs text-slate-600 font-medium">{med.name}</span>
                                                </Group>
                                              </Table.Td>
                                              <Table.Td style={{ textAlign: 'right' }} className="py-1.5 px-3 border-none">
                                                <Group gap="xs" justify="flex-end" wrap="nowrap">
                                                  <span className="text-[10px] text-slate-400 font-medium">Qty: {med.saleQty}</span>
                                                  <span className="text-xs font-bold text-slate-600 font-mono">₹{(med.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </Group>
                                              </Table.Td>
                                            </Table.Tr>
                                          ))}
                                        </Table.Tbody>
                                      </Table>
                                    </div>
                                  </Table.Td>
                                </Table.Tr>
                              )}
                            </Fragment>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>
                  </Card>
                ))}

                {/* Overall Summary Row */}
                <div className="mt-4 p-5 bg-slate-900 text-white rounded-2xl flex justify-between items-center shadow-lg shadow-slate-900/20">
                  <span className="font-extrabold tracking-tight text-lg">Grand Total Revenue</span>
                  <span className="text-2xl font-black font-mono text-indigo-400">{fmt(grandTotal)}</span>
                </div>
              </Stack>
            )}
          </Tabs.Panel>

        {/* ── CHARTS TAB ───────────────────────────────────── */}
        <Tabs.Panel value="charts" pt="md">
          <div className={styles.chartsGrid}>
              {/* Chart 1: Top 10 Pharmacies Share — Pie Chart */}
              <div className={styles.chartCard}>
                <p className={styles.chartTitle}>Revenue Share by Pharmacy</p>
                <p className={styles.chartSub}>Pie chart — top 10 pharmacies (full names)</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pharmacyPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="40%"
                      outerRadius={75}
                      innerRadius={45}
                    >
                      {pharmacyPieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{
                        fontSize: '10px',
                        maxHeight: '65px',
                        overflowY: 'auto',
                        paddingTop: '8px',
                        width: '100%'
                      }}
                    />
                    <ReTooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 2: Top Doctors by Revenue — Bar */}
              <div className={styles.chartCard}>
                <p className={styles.chartTitle}>Top Doctors by Revenue</p>
                <p className={styles.chartSub}>Bar chart — top 10 doctors</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topDoctorsChartData} margin={{ top: 4, right: 8, bottom: 40, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      angle={-35}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `₹${(v/1000).toFixed(2)}K`} />
                    <ReTooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="amount" name="Revenue" radius={[4, 4, 0, 0]}>
                      {topDoctorsChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 3: Top 10 Products by Revenue & Qty — Composed Chart */}
              <div className={styles.chartCard}>
                <p className={styles.chartTitle}>Top 10 Products by Revenue & Qty</p>
                <p className={styles.chartSub}>Composed chart — Revenue (bars, L) & Quantity (line, R)</p>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={topProductsChartData} margin={{ top: 10, right: 10, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      angle={-35}
                      textAnchor="end"
                    />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      stroke="#4f46e5"
                      tick={{ fontSize: 10, fill: '#4f46e5' }}
                      tickFormatter={v => `₹${(v/1000).toFixed(1)}K`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#10b981"
                      tick={{ fontSize: 10, fill: '#10b981' }}
                      tickFormatter={v => `${v} qty`}
                    />
                    <ReTooltip
                      content={({ active, payload, label }: any) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className={styles.chartTooltip}>
                            <p className={styles.tooltipLabel}>{label}</p>
                            <p style={{ color: '#4f46e5' }} className={styles.tooltipValue}>
                              Revenue: {fmt(payload[0]?.value || 0)}
                            </p>
                            {payload[1] && (
                              <p style={{ color: '#10b981' }} className={styles.tooltipValue}>
                                Quantity: {payload[1].value} units
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar yAxisId="left" dataKey="amount" name="Revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                    <Line yAxisId="right" type="monotone" dataKey="quantity" name="Quantity" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
          </div>

        </Tabs.Panel>

        {/* ── TABLES TAB ───────────────────────────────────── */}
        <Tabs.Panel value="tables" pt="md">
          <div className={styles.chartsGrid}>
            {/* Table 1: Top 10 Pharmacies by Revenue */}
            <div className={styles.chartCard}>
              <p className={styles.chartTitle}>Top 10 Pharmacies by Revenue</p>
              <p className={styles.chartSub}>Tabular representation — top 10 pharmacies by total revenue</p>
              <div className="overflow-hidden border border-slate-100 rounded-xl bg-white mt-3">
                <Table highlightOnHover className="min-w-full">
                  <Table.Thead className="bg-slate-50/50">
                    <Table.Tr>
                      <Table.Th className="text-xs font-semibold text-slate-500 py-2.5 pl-4">Pharmacy Name</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }} className="text-xs font-semibold text-slate-500 py-2.5 pr-4">Revenue</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pandasData?.topPharmacies.length === 0 || !pandasData ? (
                      <Table.Tr>
                        <Table.Td colSpan={2} style={{ textAlign: 'center' }} className="py-4 text-xs text-slate-400">
                          No pharmacy statistics available.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      pandasData.topPharmacies.map((pharm, idx) => (
                        <Table.Tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <Table.Td className="py-2 pl-4">
                            <Text size="xs" className="font-semibold text-slate-700">{pharm.name}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }} className="py-2 pr-4">
                            <span className="font-bold text-slate-800 font-mono text-xs">{fmt(pharm.revenue)}</span>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </div>
            </div>

            {/* Table 2: Top 10 Doctors by Revenue */}
            <div className={styles.chartCard}>
              <p className={styles.chartTitle}>Top 10 Doctors by Revenue</p>
              <p className={styles.chartSub}>Tabular representation — top 10 prescribing doctors by revenue</p>
              <div className="overflow-hidden border border-slate-100 rounded-xl bg-white mt-3">
                <Table highlightOnHover className="min-w-full">
                  <Table.Thead className="bg-slate-50/50">
                    <Table.Tr>
                      <Table.Th className="text-xs font-semibold text-slate-500 py-2.5 pl-4">Doctor Name</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }} className="text-xs font-semibold text-slate-500 py-2.5 pr-4">Revenue</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pandasData?.topDoctors.length === 0 || !pandasData ? (
                      <Table.Tr>
                        <Table.Td colSpan={2} style={{ textAlign: 'center' }} className="py-4 text-xs text-slate-400">
                          No doctor statistics available.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      pandasData.topDoctors.map((doc, idx) => (
                        <Table.Tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <Table.Td className="py-2 pl-4">
                            <Text size="xs" className="font-semibold text-slate-700">{doc.name}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }} className="py-2 pr-4">
                            <span className="font-bold text-slate-800 font-mono text-xs">{fmt(doc.revenue)}</span>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </div>
            </div>

            {/* Table 3: Top 10 Products by Revenue & Qty */}
            <div className={styles.chartCard}>
              <p className={styles.chartTitle}>Top 10 Products by Revenue & Qty</p>
              <p className={styles.chartSub}>Tabular representation — top 10 products with total quantity sold</p>
              <div className="overflow-hidden border border-slate-100 rounded-xl bg-white mt-3">
                <Table highlightOnHover className="min-w-full">
                  <Table.Thead className="bg-slate-50/50">
                    <Table.Tr>
                      <Table.Th className="text-xs font-semibold text-slate-500 py-2.5 pl-4">Product Name</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }} className="text-xs font-semibold text-slate-500 py-2.5 pr-4">Qty Sold</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }} className="text-xs font-semibold text-slate-500 py-2.5 pr-4">Revenue</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pandasData?.topProducts.length === 0 || !pandasData ? (
                      <Table.Tr>
                        <Table.Td colSpan={3} style={{ textAlign: 'center' }} className="py-4 text-xs text-slate-400">
                          No product statistics available.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      pandasData.topProducts.map((prod, idx) => (
                        <Table.Tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <Table.Td className="py-2 pl-4">
                            <Text size="xs" className="font-semibold text-slate-700">{prod.name}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }} className="py-2 pr-4">
                            <span className="font-medium text-slate-600 font-mono text-xs">{prod.quantity}</span>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }} className="py-2 pr-4">
                            <span className="font-bold text-slate-800 font-mono text-xs">{fmt(prod.revenue)}</span>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </div>
            </div>

            {/* Table 4: Revenue per Doctor Ratio (Paginated) */}
            <div className={styles.chartCard}>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className={styles.chartTitle}>Revenue per Doctor Ratio</p>
                  <p className={styles.chartSub}>Efficiency ratio (Total Revenue / linked pharmacies count)</p>
                </div>
                <Group gap="xs">
                  <TextInput
                    placeholder="Search doctor..."
                    value={ratioSearchQuery}
                    onChange={(e) => {
                      setRatioSearchQuery(e.currentTarget.value);
                      setRatioPage(0); // Reset page on search
                    }}
                    size="xs"
                    style={{ width: 140 }}
                  />
                  <Badge color="violet" variant="light" size="xs">
                    Page {ratioPage + 1} of {Math.ceil(filteredRatioData.length / 15) || 1}
                  </Badge>
                </Group>
              </div>
              <div className="overflow-hidden border border-slate-100 rounded-xl bg-white mt-3">
                <Table highlightOnHover className="min-w-full">
                  <Table.Thead className="bg-slate-50/50">
                    <Table.Tr>
                      <Table.Th className="text-xs font-semibold text-slate-500 py-2.5 pl-4">Doctor Name</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }} className="text-xs font-semibold text-slate-500 py-2.5 pr-4">Pharmacies</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }} className="text-xs font-semibold text-slate-500 py-2.5 pr-4">Efficiency Ratio</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedRatioData.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={3} style={{ textAlign: 'center' }} className="py-4 text-xs text-slate-400">
                          No ratio statistics available.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      paginatedRatioData.map((doc, idx) => (
                        <Table.Tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <Table.Td className="py-2 pl-4">
                            <Text size="xs" className="font-semibold text-slate-700">{doc.name}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }} className="py-2 pr-4">
                            <span className="font-medium text-slate-600 font-mono text-xs">{doc.pharmacies}</span>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }} className="py-2 pr-4">
                            <Badge size="xs" color="indigo" variant="gradient" gradient={{ from: 'indigo', to: 'violet', deg: 90 }} className="font-bold font-mono">
                              {fmt(doc.ratio)}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </div>
              {/* Table Pagination Controls */}
              <Group justify="center" mt="md" gap="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={ratioPage === 0}
                  onClick={() => setRatioPage(prev => Math.max(0, prev - 1))}
                  className="px-2"
                >
                  Prev 15
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  disabled={(ratioPage + 1) * 15 >= filteredRatioData.length}
                  onClick={() => setRatioPage(prev => prev + 1)}
                  className="px-2"
                >
                  Next 15
                </Button>
              </Group>
            </div>
          </div>
        </Tabs.Panel>
          </Tabs>
        </div>

        {isNewUpload ? (
          <MultiStepLoader
            loadingStates={aegisLoadingStates}
            loading={loading}
            onComplete={() => {
              setIsNewUpload(false);
              const params = new URLSearchParams(searchParams);
              params.delete('newUpload');
              navigate(`/analytics?${params.toString()}`, { replace: true });
            }}
          />
        ) : (
          <GlobalLoadingOverlay visible={loading} message="Generating business summaries..." />
        )}
      </div>
      )}
    </div>
  );
}
