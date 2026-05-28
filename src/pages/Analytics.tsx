/**
 * Analytics Dashboard — Deep ProductPartyReport Analysis
 *
 * Parses the uploaded Excel blob on-the-fly from the database,
 * aggregates revenue, sale quantities, free goods, and contribution
 * metrics across pharmacies and products, then renders a comprehensive
 * multi-section dashboard with KPI cards, charts, and detailed tables.
 *
 * @returns {JSX.Element} Full-width responsive analytics page.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Text,
  Group,
  Button,
  Grid,
  Badge,
  Table,
  ScrollArea,
  Menu,
  Progress,
  Paper,
  SimpleGrid,
  RingProgress,
  Divider,
  Tabs,
  Modal,
  List,
  ThemeIcon,
  SegmentedControl,
  Select,
  Anchor,
  Pagination
} from '@mantine/core';
import { useAppStore } from '@/stores/appStore';
import {
  IconArrowLeft,
  IconCurrencyRupee,
  IconDownload,
  IconReport,
  IconFileText,
  IconBuildingStore,
  IconPill,
  IconGift,
  IconShoppingCart,
  IconTrendingUp
} from '@tabler/icons-react';
import { exportToCSV, exportAnalyticsPDF } from '@/utils/export';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface DynamicRecord {
  doctorName: string;
  pharmacyName: string;
  productName: string;
  free: number;
  freeAmt: number;
  saleQty: number;
  amount: number;
  date: string;
}

const COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#22c55e', '#e11d48', '#3b82f6'
];

export default function Analytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DynamicRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingPhase, setLoadingPhase] = useState('Initializing connection...');
  const [selectedDoctor, setSelectedDoctor] = useState<{name: string, products: string[]} | null>(null);

  const { doctors, fetchDoctors, pharmacies, fetchPharmacies } = useAppStore();

  useEffect(() => {
    if (doctors.length === 0) fetchDoctors();
    if (pharmacies.length === 0) fetchPharmacies();
  }, [doctors, pharmacies, fetchDoctors, fetchPharmacies]);

  // Doctor and Pharmacy Matching Helpers
  const getDoctorIdByName = (name: string) => {
    if (!name) return null;
    const cleanName = name.trim().toLowerCase();
    
    // Exact match first
    let doc = doctors.find(d => d.name.trim().toLowerCase() === cleanName);
    if (doc) return doc.id;
    
    // Prefix-tolerant match
    const noPrefixName = cleanName.replace(/^(dr\.|dr\s|dr)/i, '').trim();
    doc = doctors.find(d => {
      const cleanDocName = d.name.trim().toLowerCase().replace(/^(dr\.|dr\s|dr)/i, '').trim();
      return cleanDocName === noPrefixName;
    });
    
    return doc ? doc.id : null;
  };

  const getPharmacyIdByName = (name: string) => {
    if (!name) return null;
    const cleanName = name.trim().toLowerCase();
    
    let ph = pharmacies.find(p => p.name.trim().toLowerCase() === cleanName);
    if (ph) return ph.id;
    
    const baseName = cleanName.split('[')[0].trim();
    ph = pharmacies.find(p => {
      const cleanPhName = p.name.trim().toLowerCase();
      const cleanPhBase = cleanPhName.split('[')[0].trim();
      return cleanPhBase === baseName || cleanPhName.includes(baseName) || baseName.includes(cleanPhName);
    });
    
    return ph ? ph.id : null;
  };

  // Date Filtering State
  const [filterType, setFilterType] = useState<'all' | 'weekly' | 'monthly' | 'yearly'>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');

  // Pagination State
  const PAGE_SIZE = 10;
  const [pharmaciesPage, setPharmaciesPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [doctorsPage, setDoctorsPage] = useState(1);
  const [linkagePage, setLinkagePage] = useState(1);

  // Extract years, months, weeks from data
  const years = useMemo(() => {
    const yrSet = new Set<string>();
    data.forEach(item => {
      if (item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          yrSet.add(d.getFullYear().toString());
        }
      }
    });
    return Array.from(yrSet).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const months = useMemo(() => {
    const moSet = new Set<string>();
    data.forEach(item => {
      if (item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          const monthName = d.toLocaleString('default', { month: 'long' });
          const year = d.getFullYear();
          moSet.add(`${monthName} ${year}`);
        }
      }
    });
    return Array.from(moSet).sort((a, b) => {
      const da = new Date(a);
      const db = new Date(b);
      return db.getTime() - da.getTime();
    });
  }, [data]);

  const weeks = useMemo(() => {
    const wkSet = new Set<string>();
    data.forEach(item => {
      if (item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          const startOfWeek = new Date(d);
          startOfWeek.setDate(d.getDate() - d.getDay());
          const dateStr = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          wkSet.add(`Week of ${dateStr}`);
        }
      }
    });
    return Array.from(wkSet).sort((a, b) => {
      const da = new Date(a.replace('Week of ', ''));
      const db = new Date(b.replace('Week of ', ''));
      return db.getTime() - da.getTime();
    });
  }, [data]);

  // Compute filtered dataset
  const filteredData = useMemo(() => {
    if (filterType === 'all') return data;
    
    return data.filter(item => {
      if (!item.date) return false;
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return false;
      
      if (filterType === 'yearly') {
        if (selectedYear === 'all') return true;
        return d.getFullYear().toString() === selectedYear;
      }
      
      if (filterType === 'monthly') {
        if (selectedMonth === 'all') return true;
        const monthName = d.toLocaleString('default', { month: 'long' });
        const year = d.getFullYear();
        return `${monthName} ${year}` === selectedMonth;
      }
      
      if (filterType === 'weekly') {
        if (selectedWeek === 'all') return true;
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        const dateStr = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `Week of ${dateStr}` === selectedWeek;
      }
      
      return true;
    });
  }, [data, filterType, selectedYear, selectedMonth, selectedWeek]);

  // Reset pagination pages back to 1 when filters change
  useEffect(() => {
    setPharmaciesPage(1);
    setProductsPage(1);
    setDoctorsPage(1);
    setLinkagePage(1);
  }, [filterType, selectedYear, selectedMonth, selectedWeek]);

  useEffect(() => {
    if (id) {
      runProgressSequence();
    }
  }, [id]);

  /**
   * runProgressSequence
   *
   * Simulates a professional multi-phase loading sequence with
   * incremental progress updates before fetching actual analytics data.
   * Each phase represents a conceptual step in the data pipeline.
   */
  const runProgressSequence = () => {
    const phases = [
      { pct: 15, label: 'Connecting to database...' },
      { pct: 35, label: 'Retrieving raw Excel blob...' },
      { pct: 55, label: 'Parsing spreadsheet rows...' },
      { pct: 75, label: 'Aggregating metrics...' },
      { pct: 90, label: 'Rendering visualizations...' },
    ];

    let phaseIndex = 0;
    const interval = setInterval(() => {
      if (phaseIndex < phases.length) {
        setProgress(phases[phaseIndex].pct);
        setLoadingPhase(phases[phaseIndex].label);
        phaseIndex++;
      } else {
        clearInterval(interval);
        fetchAnalytics();
      }
    }, 500);

    return () => clearInterval(interval);
  };

  const fetchAnalytics = async () => {
    try {
      const result = await api.get(`/api/excel/${Number(id)}/analytics`);
      if (result.success && result.data) {
        setProgress(100);
        setLoadingPhase('Complete');
        setData(result.data as DynamicRecord[]);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  const aggregates = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return null;

    let totalRevenue = 0;
    let totalSaleQty = 0;
    let totalFreeQty = 0;
    let totalFreeAmt = 0;
    let totalRecords = filteredData.length;

    const pharmacyMap = new Map<string, { revenue: number; saleQty: number; freeQty: number; freeAmt: number; productCount: Set<string> }>();
    const productMap = new Map<string, { revenue: number; saleQty: number; freeQty: number; freeAmt: number; pharmacyCount: Set<string> }>();
    const doctorMap = new Map<string, { revenue: number; saleQty: number; freeQty: number; freeAmt: number; pharmacyCount: Set<string>; products: Set<string> }>();
    const docPharmLinkMap = new Map<string, { doctorName: string; pharmacyName: string; revenue: number; saleQty: number; freeQty: number; freeAmt: number; productCount: Set<string> }>();

    filteredData.forEach(item => {
      const amt = Number(item.amount) || 0;
      const sq = Number(item.saleQty) || 0;
      const fq = Number(item.free) || 0;
      const fa = Number(item.freeAmt) || 0;
      totalRevenue += amt;
      totalSaleQty += sq;
      totalFreeQty += fq;
      totalFreeAmt += fa;

      // Product aggregation
      const pData = productMap.get(item.productName) || { revenue: 0, saleQty: 0, freeQty: 0, freeAmt: 0, pharmacyCount: new Set<string>() };
      pData.revenue += amt;
      pData.saleQty += sq;
      pData.freeQty += fq;
      pData.freeAmt += fa;
      pData.pharmacyCount.add(item.pharmacyName);
      productMap.set(item.productName, pData);

      // Pharmacy aggregation
      const phData = pharmacyMap.get(item.pharmacyName) || { revenue: 0, saleQty: 0, freeQty: 0, freeAmt: 0, productCount: new Set<string>() };
      phData.revenue += amt;
      phData.saleQty += sq;
      phData.freeQty += fq;
      phData.freeAmt += fa;
      phData.productCount.add(item.productName);
      pharmacyMap.set(item.pharmacyName, phData);

      // Doctor aggregation
      const docName = item.doctorName || 'Unknown Doctor';
      const docData = doctorMap.get(docName) || { revenue: 0, saleQty: 0, freeQty: 0, freeAmt: 0, pharmacyCount: new Set<string>(), products: new Set<string>() };
      docData.revenue += amt;
      docData.saleQty += sq;
      docData.freeQty += fq;
      docData.freeAmt += fa;
      docData.pharmacyCount.add(item.pharmacyName);
      docData.products.add(item.productName);
      doctorMap.set(docName, docData);

      // Linkage aggregation
      const linkKey = `${docName}|${item.pharmacyName}`;
      const linkData = docPharmLinkMap.get(linkKey) || { doctorName: docName, pharmacyName: item.pharmacyName, revenue: 0, saleQty: 0, freeQty: 0, freeAmt: 0, productCount: new Set<string>() };
      linkData.revenue += amt;
      linkData.saleQty += sq;
      linkData.freeQty += fq;
      linkData.freeAmt += fa;
      linkData.productCount.add(item.productName);
      docPharmLinkMap.set(linkKey, linkData);
    });

    const allProducts = Array.from(productMap.entries())
      .map(([name, val]) => ({
        name,
        revenue: val.revenue,
        saleQty: val.saleQty,
        freeQty: val.freeQty,
        freeAmt: val.freeAmt,
        pharmacyCount: val.pharmacyCount.size,
        avgRevenuePerPharmacy: val.pharmacyCount.size > 0 ? val.revenue / val.pharmacyCount.size : 0,
        contribution: totalRevenue > 0 ? (val.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const allPharmacies = Array.from(pharmacyMap.entries())
      .map(([name, val]) => ({
        name,
        revenue: val.revenue,
        saleQty: val.saleQty,
        freeQty: val.freeQty,
        freeAmt: val.freeAmt,
        productCount: val.productCount.size,
        avgOrderValue: val.saleQty > 0 ? val.revenue / val.saleQty : 0,
        contribution: totalRevenue > 0 ? (val.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const allDoctors = Array.from(doctorMap.entries())
      .map(([name, val]) => ({
        name,
        revenue: val.revenue,
        saleQty: val.saleQty,
        freeQty: val.freeQty,
        freeAmt: val.freeAmt,
        pharmacyCount: val.pharmacyCount.size,
        products: Array.from(val.products).sort(),
        contribution: totalRevenue > 0 ? (val.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const allLinks = Array.from(docPharmLinkMap.values())
      .map(val => ({
        ...val,
        productCount: val.productCount.size,
        contribution: totalRevenue > 0 ? (val.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topProducts = allProducts.slice(0, 10);
    const topPharmacies = allPharmacies.slice(0, 10);
    const topDoctors = allDoctors.slice(0, 10);

    const pieChartData = topProducts.map(p => ({ name: p.name, value: p.revenue }));

    const barChartData = topPharmacies.map(p => ({
      name: p.name,
      revenue: p.revenue,
      saleQty: p.saleQty
    }));

    const doctorBarChartData = topDoctors.map(d => ({
      name: d.name,
      revenue: d.revenue,
      saleQty: d.saleQty
    }));

    // Free goods analysis: top products by free quantity
    const freeGoodsLeaders = [...allProducts]
      .filter(p => p.freeQty > 0)
      .sort((a, b) => b.freeQty - a.freeQty)
      .slice(0, 10);

    // Revenue distribution segments
    const top10Revenue = topPharmacies.reduce((s, p) => s + p.revenue, 0);
    const restRevenue = totalRevenue - top10Revenue;

    return {
      totalRevenue, totalSaleQty, totalFreeQty, totalFreeAmt, totalRecords,
      uniquePharmacies: pharmacyMap.size,
      uniqueProducts: productMap.size,
      uniqueDoctors: doctorMap.size,
      avgRevenuePerPharmacy: pharmacyMap.size > 0 ? totalRevenue / pharmacyMap.size : 0,
      avgRevenuePerDoctor: doctorMap.size > 0 ? totalRevenue / doctorMap.size : 0,
      allProducts, allPharmacies, allDoctors, allLinks,
      topProducts, topPharmacies, topDoctors,
      pieChartData, barChartData, doctorBarChartData,
      freeGoodsLeaders,
      top10Revenue, restRevenue
    };
  }, [filteredData]);

  const paginatedPharmacies = useMemo(() => {
    if (!aggregates) return [];
    const start = (pharmaciesPage - 1) * PAGE_SIZE;
    return aggregates.allPharmacies.slice(start, start + PAGE_SIZE);
  }, [aggregates, pharmaciesPage]);

  const paginatedProducts = useMemo(() => {
    if (!aggregates) return [];
    const start = (productsPage - 1) * PAGE_SIZE;
    return aggregates.allProducts.slice(start, start + PAGE_SIZE);
  }, [aggregates, productsPage]);

  const paginatedDoctors = useMemo(() => {
    if (!aggregates) return [];
    const start = (doctorsPage - 1) * PAGE_SIZE;
    return aggregates.allDoctors.slice(start, start + PAGE_SIZE);
  }, [aggregates, doctorsPage]);

  const paginatedLinks = useMemo(() => {
    if (!aggregates) return [];
    const start = (linkagePage - 1) * PAGE_SIZE;
    return aggregates.allLinks.slice(start, start + PAGE_SIZE);
  }, [aggregates, linkagePage]);

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div style={{
        height: '80vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '2rem'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}
        >
          <div style={{
            width: 80, height: 80, margin: '0 auto 24px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)'
          }}>
            <IconTrendingUp size={36} color="white" />
          </div>
          <Text size="xl" fw={800} mb="xs">Preparing Analytics</Text>
          <Text size="sm" c="dimmed" mb="xl">{loadingPhase}</Text>
          <Progress
            value={progress}
            size="lg"
            radius="xl"
            color="indigo"
            animated
            style={{ marginBottom: '12px' }}
          />
          <Text size="xs" c="dimmed">{progress}% complete</Text>
        </motion.div>
      </div>
    );
  }

  if (!aggregates) {
    return (
      <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <IconReport size={64} color="#e2e8f0" />
        <Text size="xl" fw={800} mt="md" c="dimmed">No Analytics Data Available</Text>
        <Text size="sm" c="dimmed" mt="xs">This report might be empty or could not be processed.</Text>
        <Button mt="xl" variant="light" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/history')}>Back to History</Button>
      </div>
    );
  }

  // --- KPI DATA ---
  const kpiCards = [
    {
      label: 'Total Revenue',
      value: `₹${aggregates.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: IconCurrencyRupee,
      color: '#6366f1',
      bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)'
    },
    {
      label: 'Units Sold',
      value: aggregates.totalSaleQty.toLocaleString(),
      icon: IconShoppingCart,
      color: '#10b981',
      bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
    },
    {
      label: 'Free Goods Given',
      value: aggregates.totalFreeQty.toLocaleString(),
      icon: IconGift,
      color: '#f59e0b',
      bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
    },
    {
      label: 'Free Goods Value',
      value: `₹${aggregates.totalFreeAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: IconCurrencyRupee,
      color: '#ef4444',
      bg: 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)'
    },
    {
      label: 'Unique Pharmacies',
      value: aggregates.uniquePharmacies.toLocaleString(),
      icon: IconBuildingStore,
      color: '#8b5cf6',
      bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)'
    },
    {
      label: 'Unique Products',
      value: aggregates.uniqueProducts.toLocaleString(),
      icon: IconPill,
      color: '#06b6d4',
      bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)'
    },
    {
      label: 'Unique Doctors',
      value: aggregates.uniqueDoctors.toLocaleString(),
      icon: IconReport,
      color: '#ec4899',
      bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'
    },
    {
      label: 'Avg Rev / Doctor',
      value: `₹${aggregates.avgRevenuePerDoctor.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      icon: IconTrendingUp,
      color: '#3b82f6',
      bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
    }
  ];



  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      style={{ padding: '1.5rem', width: '100%', maxWidth: '100%' }}
    >
      {/* HEADER */}
      <Group justify="space-between" mb="lg">
        <Group gap="md">
          <Button variant="subtle" leftSection={<IconArrowLeft size={18} />} onClick={() => navigate('/history')}>
            Back to History
          </Button>
          <div>
            <Text size="xl" fw={800} c="dark">Deep Analytics Report</Text>
            <Text size="sm" c="dimmed">{aggregates.totalRecords.toLocaleString()} line items processed on-the-fly</Text>
          </div>
        </Group>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button variant="filled" color="indigo" leftSection={<IconDownload size={16} />}>
              Export
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconReport size={14} />}
              onClick={() => {
                exportAnalyticsPDF(
                  {
                    totalRevenue: aggregates.totalRevenue,
                    totalSaleQty: aggregates.totalSaleQty,
                    totalFreeQty: aggregates.totalFreeQty,
                    uniquePharmacies: aggregates.uniquePharmacies,
                    uniqueProducts: aggregates.uniqueProducts,
                    doctorCount: aggregates.allPharmacies.length,
                    fileName: 'ProductPartyReport',
                    date: new Date().toLocaleDateString()
                  },
                  aggregates.allPharmacies.map(d => ({ name: d.name, specialization: `${d.productCount} products`, revenue: d.revenue, contribution: d.contribution.toFixed(1) + '%' })),
                  aggregates.allProducts.map(p => ({ name: p.name, saleQty: p.saleQty, freeQty: p.freeQty, revenue: p.revenue, contribution: p.contribution.toFixed(1) + '%' }))
                );
              }}
            >
              Export as PDF
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileText size={14} />}
              onClick={() => {
                const csvData = aggregates.allDoctors.map(d => ({
                  'Doctor': d.name, 'Revenue': d.revenue, 'Sale Qty': d.saleQty,
                  'Free Qty': d.freeQty, 'Free Amt': d.freeAmt, 'Pharmacies': d.pharmacyCount, 'Medicines': d.products.length, 'Contribution': d.contribution.toFixed(2) + '%'
                }));
                exportToCSV(csvData, `doctor_analytics_${id}`, ['Doctor', 'Revenue', 'Sale Qty', 'Free Qty', 'Free Amt', 'Pharmacies', 'Medicines', 'Contribution']);
              }}
            >
              Export Doctors (CSV)
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileText size={14} />}
              onClick={() => {
                const csvData = aggregates.allPharmacies.map(d => ({
                  'Pharmacy': d.name, 'Revenue': d.revenue, 'Sale Qty': d.saleQty,
                  'Free Qty': d.freeQty, 'Free Amt': d.freeAmt, 'Products': d.productCount, 'Contribution': d.contribution.toFixed(2) + '%'
                }));
                exportToCSV(csvData, `pharmacy_analytics_${id}`, ['Pharmacy', 'Revenue', 'Sale Qty', 'Free Qty', 'Free Amt', 'Products', 'Contribution']);
              }}
            >
              Export Pharmacies (CSV)
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileText size={14} />}
              onClick={() => {
                const csvData = aggregates.allLinks.map(l => ({
                  'Doctor': l.doctorName, 'Pharmacy': l.pharmacyName, 'Revenue': l.revenue, 'Sale Qty': l.saleQty,
                  'Products': l.productCount, 'Contribution': l.contribution.toFixed(2) + '%'
                }));
                exportToCSV(csvData, `linkage_analytics_${id}`, ['Doctor', 'Pharmacy', 'Revenue', 'Sale Qty', 'Products', 'Contribution']);
              }}
            >
              Export Links (CSV)
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* GLOBAL DATE FILTERS */}
      <Card p="md" radius="lg" shadow="xs" mb="xl" style={{ border: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #ffffff 0%, #fcfdff 100%)' }}>
        <Group justify="space-between" align="center" gap="md">
          <Group gap="sm">
            <Text fw={700} size="sm" c="dimmed">Time Horizon:</Text>
            <SegmentedControl
              value={filterType}
              onChange={(value: any) => {
                setFilterType(value);
                setSelectedYear('all');
                setSelectedMonth('all');
                setSelectedWeek('all');
              }}
              data={[
                { label: 'All Data', value: 'all' },
                { label: 'Weekly', value: 'weekly' },
                { label: 'Monthwise', value: 'monthly' },
                { label: 'Yearwise', value: 'yearly' },
              ]}
              color="indigo"
              radius="md"
            />
          </Group>
          
          <Group gap="sm" align="center">
            {filterType === 'weekly' && (
              <Select
                placeholder="All Weeks"
                value={selectedWeek}
                onChange={(val) => setSelectedWeek(val || 'all')}
                data={[{ value: 'all', label: 'All Weeks' }, ...weeks.map(w => ({ value: w, label: w }))]}
                style={{ width: 220 }}
                radius="md"
                comboboxProps={{ shadow: 'md' }}
              />
            )}
            
            {filterType === 'monthly' && (
              <Select
                placeholder="All Months"
                value={selectedMonth}
                onChange={(val) => setSelectedMonth(val || 'all')}
                data={[{ value: 'all', label: 'All Months' }, ...months.map(m => ({ value: m, label: m }))]}
                style={{ width: 220 }}
                radius="md"
                comboboxProps={{ shadow: 'md' }}
              />
            )}
            
            {filterType === 'yearly' && (
              <Select
                placeholder="All Years"
                value={selectedYear}
                onChange={(val) => setSelectedYear(val || 'all')}
                data={[{ value: 'all', label: 'All Years' }, ...years.map(y => ({ value: y, label: y }))]}
                style={{ width: 220 }}
                radius="md"
                comboboxProps={{ shadow: 'md' }}
              />
            )}
            
            {filterType !== 'all' && (
              <Button 
                variant="subtle" 
                size="xs" 
                color="indigo" 
                onClick={() => {
                  setSelectedYear('all');
                  setSelectedMonth('all');
                  setSelectedWeek('all');
                }}
              >
                Clear Period Filter
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      {/* KPI CARDS */}
      <SimpleGrid cols={{ base: 2, sm: 4, lg: 4, xl: 8 }} mb="xl">
        {kpiCards.map((kpi, idx) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08, duration: 0.4 }}>
            <Paper p="md" radius="lg" shadow="xs" style={{ border: '1px solid #e2e8f0' }}>
              <Group gap="sm" mb={8}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <kpi.icon size={18} color={kpi.color} />
                </div>
              </Group>
              <Text fw={800} size="xl" style={{ letterSpacing: '-0.02em' }}>{kpi.value}</Text>
              <Text size="xs" c="dimmed" mt={2}>{kpi.label}</Text>
            </Paper>
          </motion.div>
        ))}
      </SimpleGrid>

      {/* CHARTS — FULL WIDTH */}
      <Card p="xl" radius="lg" shadow="xs" mb="xl" style={{ border: '1px solid #e2e8f0' }}>
        <Group justify="space-between" mb="md">
          <Text fw={800} size="lg">Top Pharmacy Revenue</Text>
          <Badge variant="light" color="teal">Top 10</Badge>
        </Group>
        <ResponsiveContainer width="100%" height={Math.max(400, aggregates.barChartData.length * 50)}>
          <BarChart data={aggregates.barChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
            <XAxis type="number" tickFormatter={(v: any) => `₹${(Number(v)/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" width={280} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN')}`} />
            <Bar dataKey="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card p="xl" radius="lg" shadow="xs" mb="xl" style={{ border: '1px solid #e2e8f0' }}>
        <Group justify="space-between" mb="md">
          <Text fw={800} size="lg">Top Doctors Revenue</Text>
          <Badge variant="light" color="pink">Top 10</Badge>
        </Group>
        <ResponsiveContainer width="100%" height={Math.max(400, aggregates.doctorBarChartData.length * 50)}>
          <BarChart data={aggregates.doctorBarChartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
            <XAxis type="number" tickFormatter={(v: any) => `₹${(Number(v)/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" width={280} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN')}`} />
            <Bar dataKey="revenue" fill="#ec4899" radius={[0, 6, 6, 0]} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card p="xl" radius="lg" shadow="xs" mb="xl" style={{ border: '1px solid #e2e8f0' }}>
        <Group justify="space-between" mb="md">
          <Text fw={800} size="lg">Revenue by Product</Text>
          <Badge variant="light" color="indigo">Top 10</Badge>
        </Group>
        <ResponsiveContainer width="100%" height={420}>
          <PieChart>
            <Pie data={aggregates.pieChartData} cx="50%" cy="50%" innerRadius={80} outerRadius={140} paddingAngle={3} dataKey="value">
              {aggregates.pieChartData.map((_, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString('en-IN')}`} />
            <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      {/* REVENUE DISTRIBUTION RING */}
      <Grid gutter="xl" mb="xl">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card p="xl" radius="lg" shadow="xs" style={{ border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <Text fw={800} size="lg" mb="lg">Revenue Concentration</Text>
            <RingProgress
              size={200}
              thickness={18}
              roundCaps
              sections={[
                { value: aggregates.totalRevenue > 0 ? (aggregates.top10Revenue / aggregates.totalRevenue) * 100 : 0, color: '#6366f1' },
                { value: aggregates.totalRevenue > 0 ? (aggregates.restRevenue / aggregates.totalRevenue) * 100 : 0, color: '#e2e8f0' },
              ]}
              label={
                <Text ta="center" fw={800} size="xl">
                  {aggregates.totalRevenue > 0 ? ((aggregates.top10Revenue / aggregates.totalRevenue) * 100).toFixed(1) : 0}%
                </Text>
              }
              style={{ margin: '0 auto' }}
            />
            <Text size="sm" c="dimmed" mt="md">Top 10 pharmacies contribute this share of total revenue</Text>
            <Divider my="md" />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Avg Revenue / Pharmacy</Text>
              <Text fw={800} size="sm">₹{aggregates.avgRevenuePerPharmacy.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            </Group>
          </Card>
        </Grid.Col>

        {/* Free Goods Leaders */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card p="xl" radius="lg" shadow="xs" style={{ border: '1px solid #e2e8f0' }}>
            <Group justify="space-between" mb="md">
              <Text fw={800} size="lg">Free Goods Analysis</Text>
              <Badge variant="light" color="orange">Top {aggregates.freeGoodsLeaders.length} Products</Badge>
            </Group>
            <ScrollArea h={280}>
              <Table highlightOnHover verticalSpacing="sm" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Product</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free Value</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Sale Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free-to-Sale Ratio</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {aggregates.freeGoodsLeaders.map((product, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td><Badge size="xs" color={idx < 3 ? 'orange' : 'gray'}>#{idx + 1}</Badge></Table.Td>
                      <Table.Td fw={800}>{product.name}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} c="orange" fw={800}>{product.freeQty.toLocaleString()}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>₹{product.freeAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{product.saleQty.toLocaleString()}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} fw={800} c={product.saleQty > 0 && (product.freeQty / product.saleQty) > 0.2 ? 'red' : 'green'}>
                        {product.saleQty > 0 ? (product.freeQty / product.saleQty * 100).toFixed(1) + '%' : 'N/A'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Card>
        </Grid.Col>
      </Grid>

      {/* TABBED DETAILED TABLES */}
      <Card p="xl" radius="lg" shadow="xs" style={{ border: '1px solid #e2e8f0' }}>
        <Tabs defaultValue="pharmacies" variant="pills" color="indigo" className="analytics-tabs">
          <Tabs.List mb="lg">
            <Tabs.Tab value="pharmacies" leftSection={<IconBuildingStore size={16} />}>
              All Pharmacies ({aggregates.allPharmacies.length})
            </Tabs.Tab>
            <Tabs.Tab value="products" leftSection={<IconPill size={16} />}>
              All Products ({aggregates.allProducts.length})
            </Tabs.Tab>
            <Tabs.Tab value="doctors" leftSection={<IconReport size={16} />}>
              Doctor Performance ({aggregates.allDoctors.length})
            </Tabs.Tab>
            <Tabs.Tab value="linkage" leftSection={<IconTrendingUp size={16} />}>
              Doctor-Pharmacy Links ({aggregates.allLinks.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* PHARMACY TABLE */}
          <Tabs.Panel value="pharmacies">
            <ScrollArea h={500}>
              <Table highlightOnHover verticalSpacing="sm" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rank</Table.Th>
                    <Table.Th>Pharmacy Name</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Products</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Sale Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free Value</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Revenue</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Avg Order Value</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Contribution</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedPharmacies.map((pharmacy, idx) => {
                    const globalIdx = (pharmaciesPage - 1) * PAGE_SIZE + idx;
                    return (
                      <Table.Tr key={idx}>
                        <Table.Td><Badge size="xs" color={globalIdx < 3 ? 'yellow' : globalIdx < 10 ? 'blue' : 'gray'}>#{globalIdx + 1}</Badge></Table.Td>
                        <Table.Td fw={800} style={{ maxWidth: 280 }}>
                          {(() => {
                            const phId = getPharmacyIdByName(pharmacy.name);
                            return phId ? (
                              <Anchor component="span" c="indigo.6" fw={800} onClick={() => navigate(`/pharmacies/${phId}`)} style={{ cursor: 'pointer' }}>
                                {pharmacy.name}
                              </Anchor>
                            ) : (
                              pharmacy.name
                            );
                          })()}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{pharmacy.productCount}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{pharmacy.saleQty.toLocaleString()}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} c="orange">{pharmacy.freeQty.toLocaleString()}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>₹{pharmacy.freeAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} fw={800} c="green">₹{pharmacy.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>₹{pharmacy.avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Group gap={4} justify="flex-end">
                            <Progress value={pharmacy.contribution} size="sm" color="indigo" style={{ width: 60 }} />
                            <Text size="xs" fw={800}>{pharmacy.contribution.toFixed(2)}%</Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            
            <Group justify="space-between" mt="md" px="xs" align="center">
              <Text size="xs" c="dimmed">
                Showing {Math.min(aggregates.allPharmacies.length, (pharmaciesPage - 1) * PAGE_SIZE + 1)}–
                {Math.min(aggregates.allPharmacies.length, pharmaciesPage * PAGE_SIZE)} of {aggregates.allPharmacies.length} pharmacies
              </Text>
              {aggregates.allPharmacies.length > PAGE_SIZE && (
                <Pagination
                  total={Math.ceil(aggregates.allPharmacies.length / PAGE_SIZE)}
                  value={pharmaciesPage}
                  onChange={setPharmaciesPage}
                  color="indigo"
                  size="sm"
                  radius="md"
                />
              )}
            </Group>
          </Tabs.Panel>

          {/* PRODUCT TABLE */}
          <Tabs.Panel value="products">
            <ScrollArea h={500}>
              <Table highlightOnHover verticalSpacing="sm" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rank</Table.Th>
                    <Table.Th>Product Name</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Pharmacies</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Sale Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free Value</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Revenue</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Avg Rev/Pharmacy</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Contribution</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedProducts.map((product, idx) => {
                    const globalIdx = (productsPage - 1) * PAGE_SIZE + idx;
                    return (
                      <Table.Tr key={idx}>
                        <Table.Td><Badge size="xs" color={globalIdx < 3 ? 'yellow' : globalIdx < 10 ? 'blue' : 'gray'}>#{globalIdx + 1}</Badge></Table.Td>
                        <Table.Td fw={800}>{product.name}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{product.pharmacyCount}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{product.saleQty.toLocaleString()}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} c="orange">{product.freeQty.toLocaleString()}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>₹{product.freeAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} fw={800} c="green">₹{product.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>₹{product.avgRevenuePerPharmacy.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Group gap={4} justify="flex-end">
                            <Progress value={product.contribution} size="sm" color="violet" style={{ width: 60 }} />
                            <Text size="xs" fw={800}>{product.contribution.toFixed(2)}%</Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            
            <Group justify="space-between" mt="md" px="xs" align="center">
              <Text size="xs" c="dimmed">
                Showing {Math.min(aggregates.allProducts.length, (productsPage - 1) * PAGE_SIZE + 1)}–
                {Math.min(aggregates.allProducts.length, productsPage * PAGE_SIZE)} of {aggregates.allProducts.length} products
              </Text>
              {aggregates.allProducts.length > PAGE_SIZE && (
                <Pagination
                  total={Math.ceil(aggregates.allProducts.length / PAGE_SIZE)}
                  value={productsPage}
                  onChange={setProductsPage}
                  color="indigo"
                  size="sm"
                  radius="md"
                />
              )}
            </Group>
          </Tabs.Panel>

          {/* DOCTOR TABLE */}
          <Tabs.Panel value="doctors">
            <ScrollArea h={500}>
              <Table highlightOnHover verticalSpacing="sm" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rank</Table.Th>
                    <Table.Th>Doctor Name</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Pharmacies Linked</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total Sale Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free Qty Given</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Free Value</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total Revenue Gen.</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Network Contribution</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedDoctors.map((doc, idx) => {
                    const globalIdx = (doctorsPage - 1) * PAGE_SIZE + idx;
                    return (
                      <Table.Tr key={idx}>
                        <Table.Td><Badge size="xs" color={globalIdx < 3 ? 'yellow' : globalIdx < 10 ? 'blue' : 'gray'}>#{globalIdx + 1}</Badge></Table.Td>
                        <Table.Td fw={800}>
                          {(() => {
                            const docId = getDoctorIdByName(doc.name);
                            return docId ? (
                              <Anchor component="span" c="indigo.6" fw={800} onClick={() => navigate(`/doctors/${docId}`)} style={{ cursor: 'pointer' }}>
                                {doc.name}
                              </Anchor>
                            ) : (
                              doc.name
                            );
                          })()}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{doc.pharmacyCount}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{doc.saleQty.toLocaleString()}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} c="orange" fw={800}>{doc.freeQty.toLocaleString()}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>₹{doc.freeAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} fw={800} c="green">₹{doc.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Group gap={4} justify="flex-end">
                            <Progress value={doc.contribution} size="sm" color="pink" style={{ width: 60 }} />
                            <Text size="xs" fw={800}>{doc.contribution.toFixed(2)}%</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Button size="xs" variant="light" color="pink" onClick={() => setSelectedDoctor({ name: doc.name, products: doc.products })}>
                            View Medicines
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            
            <Group justify="space-between" mt="md" px="xs" align="center">
              <Text size="xs" c="dimmed">
                Showing {Math.min(aggregates.allDoctors.length, (doctorsPage - 1) * PAGE_SIZE + 1)}–
                {Math.min(aggregates.allDoctors.length, doctorsPage * PAGE_SIZE)} of {aggregates.allDoctors.length} doctors
              </Text>
              {aggregates.allDoctors.length > PAGE_SIZE && (
                <Pagination
                  total={Math.ceil(aggregates.allDoctors.length / PAGE_SIZE)}
                  value={doctorsPage}
                  onChange={setDoctorsPage}
                  color="indigo"
                  size="sm"
                  radius="md"
                />
              )}
            </Group>
          </Tabs.Panel>

          {/* DOCTOR-PHARMACY LINKAGE TABLE */}
          <Tabs.Panel value="linkage">
            <ScrollArea h={500}>
              <Table highlightOnHover verticalSpacing="sm" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Rank</Table.Th>
                    <Table.Th>Doctor Name</Table.Th>
                    <Table.Th>Pharmacy Name</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Unique Products</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total Sale Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total Revenue</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Contribution</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {paginatedLinks.map((link, idx) => {
                    const globalIdx = (linkagePage - 1) * PAGE_SIZE + idx;
                    return (
                      <Table.Tr key={idx}>
                        <Table.Td><Badge size="xs" color={globalIdx < 3 ? 'yellow' : globalIdx < 10 ? 'blue' : 'gray'}>#{globalIdx + 1}</Badge></Table.Td>
                        <Table.Td fw={800}>
                          {(() => {
                            const docId = getDoctorIdByName(link.doctorName);
                            return docId ? (
                              <Anchor component="span" c="indigo.6" fw={800} onClick={() => navigate(`/doctors/${docId}`)} style={{ cursor: 'pointer' }}>
                                {link.doctorName}
                              </Anchor>
                            ) : (
                              link.doctorName
                            );
                          })()}
                        </Table.Td>
                        <Table.Td fw={500}>
                          {(() => {
                            const phId = getPharmacyIdByName(link.pharmacyName);
                            return phId ? (
                              <Anchor component="span" c="indigo.6" fw={500} onClick={() => navigate(`/pharmacies/${phId}`)} style={{ cursor: 'pointer' }}>
                                {link.pharmacyName}
                              </Anchor>
                            ) : (
                              link.pharmacyName
                            );
                          })()}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{link.productCount}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{link.saleQty.toLocaleString()}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} fw={800} c="green">₹{link.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Group gap={4} justify="flex-end">
                            <Progress value={link.contribution} size="sm" color="teal" style={{ width: 60 }} />
                            <Text size="xs" fw={800}>{link.contribution.toFixed(2)}%</Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            
            <Group justify="space-between" mt="md" px="xs" align="center">
              <Text size="xs" c="dimmed">
                Showing {Math.min(aggregates.allLinks.length, (linkagePage - 1) * PAGE_SIZE + 1)}–
                {Math.min(aggregates.allLinks.length, linkagePage * PAGE_SIZE)} of {aggregates.allLinks.length} linkages
              </Text>
              {aggregates.allLinks.length > PAGE_SIZE && (
                <Pagination
                  total={Math.ceil(aggregates.allLinks.length / PAGE_SIZE)}
                  value={linkagePage}
                  onChange={setLinkagePage}
                  color="indigo"
                  size="sm"
                  radius="md"
                />
              )}
            </Group>
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* DOCTOR MEDICINES MODAL */}
      <Modal
        opened={!!selectedDoctor}
        onClose={() => setSelectedDoctor(null)}
        title={<Text fw={800} size="lg">Medicines prescribed by {selectedDoctor?.name}</Text>}
        size="lg"
        centered
      >
        <ScrollArea h={400} offsetScrollbars>
          <List spacing="sm" size="sm" center icon={
            <ThemeIcon color="pink" size={24} radius="xl">
              <IconPill size={14} />
            </ThemeIcon>
          }>
            {selectedDoctor?.products.map((med, idx) => (
              <List.Item key={idx}>{med}</List.Item>
            ))}
          </List>
        </ScrollArea>
      </Modal>
    </motion.div>
  );
}
