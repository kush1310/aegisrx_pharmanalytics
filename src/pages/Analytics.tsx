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
  Card, Badge, Table, Menu, TextInput
} from '@mantine/core';
import PageLoader from '../components/PageLoader';
import { notifications as notify } from '@mantine/notifications';
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
  IconFileText,
} from '@tabler/icons-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { exportToCSV, exportBusinessSummaryPDF } from '@/utils/export';
import { api } from '@/lib/api';
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

  const [doctorGroups,   setDoctorGroups]   = useState<DoctorGroup[]>([]);
  const [uploads,        setUploads]         = useState<UploadSummary[]>([]);
  const [selectedUpload, setSelectedUpload]  = useState<string | null>(uploadIdParam || null);
  const [sortMode,       setSortMode]        = useState<'amount' | 'name'>('amount');
  const [loading,        setLoading]         = useState(true);
  const [expandedRows,   setExpandedRows]    = useState<Set<number>>(new Set());

  // Doctor checklist filters
  const [allDoctors, setAllDoctors] = useState<{ id: number; name: string }[]>([]);
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState('');

  /* ── Sync selected upload param from URL ────────────────────── */
  useEffect(() => {
    setSelectedUpload(uploadIdParam || null);
  }, [uploadIdParam]);

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

  /* ── Fetch doctors for filter checklist ─────────────────────── */
  const fetchDoctorsList = async () => {
    try {
      const res = await api.get<any[]>('/api/doctors');
      if (res.success && res.data) {
        const docs = res.data.map(d => ({ id: d.id, name: d.name }));
        setAllDoctors(docs);
        // Default select all doctors + unlinked pharmacies
        setSelectedDoctors([...docs.map(d => String(d.id)), 'unlinked']);
      }
    } catch (err) {
      console.error('[Analytics] Failed to fetch doctors:', err);
    }
  };

  /* ── Fetch doctor business data ─────────────────────────────── */
  const fetchBusinessData = async () => {
    setLoading(true);
    const startTime = Date.now();
    try {
      const params = new URLSearchParams({ sort: sortMode });
      if (selectedUpload) params.set('uploadId', selectedUpload);

      const res = await api.get<DoctorGroup[]>(`/api/excel/doctor-business?${params.toString()}`);
      if (res.success && res.data) {
        setDoctorGroups(res.data as DoctorGroup[]);
      } else {
        notify.show({ title: 'Error', message: 'Failed to load business data', color: 'red' });
      }
    } catch (err) {
      console.error('[Analytics] Fetch error:', err);
      notify.show({ title: 'Error', message: 'Could not reach server', color: 'red' });
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 3000 - elapsed);
      setTimeout(() => {
        setLoading(false);
      }, remaining);
    }
  };

  useEffect(() => {
    fetchUploads();
    fetchDoctorsList();
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
  const topDoctorsChartData = useMemo(
    () => [...filteredDoctorGroups]
      .filter(d => d.doctorId !== null)
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .slice(0, 10)
      .map(d => ({ name: shortName(d.doctorName, 14), amount: d.grandTotal })),
    [filteredDoctorGroups]
  );

  const pharmacyPieData = useMemo(() => {
    const flat: { name: string; value: number }[] = [];
    for (const d of filteredDoctorGroups) {
      for (const p of d.pharmacies) {
        flat.push({ name: shortName(p.pharmacyName, 16), value: p.totalAmount });
      }
    }
    return flat.sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredDoctorGroups]);

  const topProductsChartData = useMemo(() => {
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
      .slice(0, 12)
      .map(([name, amount]) => ({ name: shortName(name, 14), amount }));
  }, [filteredDoctorGroups]);

  /* ── Row expand toggle ──────────────────────────────────────── */
  const toggleExpand = (pharmacyId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(pharmacyId) ? next.delete(pharmacyId) : next.add(pharmacyId);
      return next;
    });
  };

  /* ── Export handlers ────────────────────────────────────────── */
  const handleExportCSV = () => {
    const rows: any[] = [];
    for (const d of filteredDoctorGroups) {
      for (const p of d.pharmacies) {
        rows.push({
          'Doctor Name':    d.doctorName,
          'Pharmacy Name':  p.pharmacyName,
          'Total Amount':   p.totalAmount,
          'Grand Total':    d.grandTotal,
        });
        for (const m of p.medicines) {
          rows.push({
            'Doctor Name':   d.doctorName,
            'Pharmacy Name': p.pharmacyName,
            'Medicine':      m.name,
            'Amount':        m.amount,
          });
        }
      }
    }
    exportToCSV(rows, 'aegisrx-business-summary');
    notify.show({ title: 'Exported', message: 'CSV downloaded', color: 'green' });
  };

  const handleExportPDF = async () => {
    await exportBusinessSummaryPDF(filteredDoctorGroups, { grandTotal, totalPharmacies, totalDoctors: filteredDoctorGroups.filter(d => d.doctorId !== null).length });
    notify.show({ title: 'PDF Ready', message: 'Business summary PDF downloaded', color: 'green' });
  };

  /* ── KPI Cards data ─────────────────────────────────────────── */
  const kpiCards = [
    { label: 'Total Revenue',    value: fmt(grandTotal),          icon: IconCurrencyRupee, color: '#4f46e5', bg: '#eef2ff' },
    { label: 'Linked Doctors',   value: filteredDoctorGroups.filter(d => d.doctorId !== null).length, icon: IconStethoscope,   color: '#10b981', bg: '#ecfdf5' },
    { label: 'Pharmacies',       value: totalPharmacies,           icon: IconBuildingStore, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'Product Lines',    value: topProductsChartData.length, icon: IconPill,        color: '#3b82f6', bg: '#eff6ff' },
  ];

  const handleSelectAll = () => {
    setSelectedDoctors([...allDoctors.map(d => String(d.id)), 'unlinked']);
  };

  const handleClearAll = () => {
    setSelectedDoctors([]);
  };

  const handleClearAllAnalytics = () => {
    if (!selectedUpload) return;
    const currentUpload = uploads.find(u => String(u.id) === selectedUpload);
    const fileName = currentUpload ? currentUpload.fileName : 'this upload';
    modals.openConfirmModal({
      title: 'Clear Analytics',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to clear the analytics data and delete the file "{fileName}"? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Clear Analytics', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await api.delete(`/api/excel/${selectedUpload}`);
          if (res.success) {
            notify.show({ title: 'Cleared', message: 'Current analytics and upload have been cleared', color: 'green' });
            setSelectedUpload(null);
            setUploads(prev => prev.filter(u => String(u.id) !== selectedUpload));
            setDoctorGroups([]);
            navigate('/analytics');
          } else {
            notify.show({ title: 'Error', message: 'Failed to clear analytics', color: 'red' });
          }
        } catch (err) {
          console.error('[Analytics] Clear error:', err);
          notify.show({ title: 'Error', message: 'Failed to clear analytics data', color: 'red' });
        } finally {
          setLoading(false);
        }
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
            onChange={v => setSelectedUpload(v || null)}
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
          <Menu shadow="md" position="bottom-end">
            <Menu.Target>
              <Button size="sm" leftSection={<IconDownload size={14} />}>
                Export
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconFileText size={14} />} onClick={handleExportCSV}>
                Export as CSV
              </Menu.Item>
              <Menu.Item leftSection={<IconDownload size={14} />} onClick={handleExportPDF}>
                Export as PDF
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
          <div className={loading ? 'blur-[3px] pointer-events-none select-none transition-all duration-300' : 'transition-all duration-300'}>
            {/* ── KPI Bar ──────────────────────────────────────────── */}
            <div className={styles.kpiBar}>
              {kpiCards.map(card => (
                <div key={card.label} className={styles.kpiCard}>
                  <div className={styles.kpiLeft}>
                    <span className={styles.kpiLabel}>{card.label}</span>
                    <span className={styles.kpiValue}>{card.value}</span>
                  </div>
                  <div className={styles.kpiIcon} style={{ background: card.bg, color: card.color }}>
                    <card.icon size={20} strokeWidth={1.75} />
                  </div>
                </div>
              ))}
            </div>

          {/* ── Main Tabs ────────────────────────────────────────── */}
          <Tabs defaultValue="table" className={`${styles.tabs} analytics-tabs`}>
        <Tabs.List>
          <Tabs.Tab value="table"   leftSection={<IconTable    size={14} />}>Business Summary</Tabs.Tab>
          <Tabs.Tab value="charts"  leftSection={<IconChartBar size={14} />}>Charts</Tabs.Tab>
        </Tabs.List>

        {/* ── BUSINESS SUMMARY TABLE ───────────────────────── */}
        <Tabs.Panel value="table" pt="md">
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
              {/* Chart 1: Top Doctors by Revenue — Bar */}
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

              {/* Chart 2: Revenue Share by Pharmacy — Pie */}
              <div className={styles.chartCard}>
                <p className={styles.chartTitle}>Revenue Share by Pharmacy</p>
                <p className={styles.chartSub}>Pie chart — top 10 pharmacies</p>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pharmacyPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={40}
                    >
                      {pharmacyPieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                    <ReTooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 3: Top Products by Revenue — Horizontal Bar */}
              <div className={styles.chartCard}>
                <p className={styles.chartTitle}>Top Products by Revenue</p>
                <p className={styles.chartSub}>Bar chart — top 12 products</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={topProductsChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 40, bottom: 4, left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `₹${(v/1000).toFixed(2)}K`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                    <ReTooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="amount" name="Revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Chart 4: Doctor Revenue Distribution — Histogram-style */}
              <div className={styles.chartCard}>
                <p className={styles.chartTitle}>Doctor Revenue Distribution</p>
                <p className={styles.chartSub}>Grouped bar — doctor vs grand total</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={topDoctorsChartData.slice(0, 8)}
                    margin={{ top: 4, right: 8, bottom: 40, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      angle={-30}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => `₹${(v/1000).toFixed(2)}K`} />
                    <ReTooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="amount" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Tabs.Panel>
          </Tabs>
        </div>

        {loading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-md rounded-2xl transition-all duration-300">
            <PageLoader message="Generating business summaries..." />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
