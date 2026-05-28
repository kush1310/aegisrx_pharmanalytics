import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Text,
  Group,
  Stack,
  Paper,
  SimpleGrid,
  Skeleton,
  Box,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { motion } from 'framer-motion';
import {
  IconStethoscope,
  IconPrescription,
  IconUpload,
  IconHistory,
  IconPlus,

  IconArrowUpRight,
  IconSparkles,
  IconCalendarEvent,
  IconPackage,
  IconCurrencyRupee,
  IconTrendingUp,
  IconRefresh
} from '@tabler/icons-react';

import AddDoctorModal from '../components/AddDoctorModal';
import AddPharmacyModal from '../components/AddPharmacyModal';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import styles from './Dashboard.module.css';

const MotionPaper = motion.create(Paper as any);



interface DashboardStats {
  doctorCount: number;
  pharmacyCount: number;
  productCount: number;
  unreadNotifications: number;
  totalRevenue: number;
  monthlyGrowth: number;
  topProducts: any[];
  manufacturerSales: any[];
  salesTrends: any[];
  topDoctors: any[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { username } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [doctorModalOpened, { open: openDoctorModal, close: closeDoctorModal }] = useDisclosure(false);
  const [pharmacyModalOpened, { open: openPharmacyModal, close: closePharmacyModal }] = useDisclosure(false);

  const fetchStats = async () => {
    try {
      const result = await api.get<DashboardStats>('/api/stats/dashboard');
      if (result.success && result.data) {
        setStats(result.data as DashboardStats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    api.post('/api/notifications/check-events', {});
  }, []);

  const handleSuccess = () => {
    fetchStats();
  };

  const statCards = [
    {
      label: 'Total Revenue',
      value: `₹${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: IconCurrencyRupee,
      color: '#059669', // Emerald
      bgColor: '#ecfdf5',
      path: '/analytics',
      trend: `+${stats?.monthlyGrowth || 0}% this month`
    },
    {
      label: 'Active Doctors',
      value: stats?.doctorCount || 0,
      icon: IconStethoscope,
      color: '#6366f1', // Indigo
      bgColor: '#eef2ff',
      path: '/doctors',
      trend: 'Active in system'
    },
    {
      label: 'Pharmacies',
      value: stats?.pharmacyCount || 0,
      icon: IconPrescription,
      color: '#f59e0b', // Amber
      bgColor: '#fffbeb',
      path: '/pharmacies',
      trend: 'Registered outlets'
    },
    {
      label: 'Products',
      value: stats?.productCount || 0,
      icon: IconPackage,
      color: '#ec4899', // Pink
      bgColor: '#fdf2f8',
      path: '/products',
      trend: 'Catalog items'
    }
  ];

  return (
    <div className={styles.container}>
      {/* Welcome Banner */}
      <Card className={styles.welcomeCard} p="xl" radius="lg">
        <Group justify="space-between" align="flex-start" style={{ position: 'relative', zIndex: 1 }}>
          <Stack gap={6}>
            <Group gap="xs">
              <IconSparkles size={24} style={{ color: 'rgba(255,255,255,0.9)' }} />
              <Text size="xl" fw={800} c="white">
                Welcome back, {username?.split(' ')[0] || 'User'}!
              </Text>
            </Group>
            <Text size="sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Here is your Antigravity Analytical Dashboard overview.
            </Text>
          </Stack>
          <Group gap="sm" align="center">
            <Tooltip label="Refresh Stats" position="bottom" withArrow>
              <ActionIcon 
                variant="subtle" 
                color="white" 
                onClick={fetchStats}
                loading={loading}
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'white',
                  backdropFilter: 'blur(4px)'
                }}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>

            <Box className={styles.dateBadge}>
              <Group gap={6}>
                <IconCalendarEvent size={15} />
                {new Date().toLocaleDateString('en-IN', { 
                  weekday: 'short', 
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </Group>
            </Box>
          </Group>
        </Group>
      </Card>

      {/* Top Stats Bento Grid */}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="lg" mt="lg">
        {loading ? (
          <>
            <Skeleton height={140} radius="lg" />
            <Skeleton height={140} radius="lg" />
            <Skeleton height={140} radius="lg" />
            <Skeleton height={140} radius="lg" />
          </>
        ) : (
          statCards.map((stat, index) => (
            <MotionPaper
              key={stat.label}
              className={styles.statCard}
              p="lg"
              radius="lg"
              onClick={() => stat.path && navigate(stat.path)}
              style={{ '--stat-accent': stat.color, cursor: 'pointer' } as React.CSSProperties}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
              whileHover={{ y: -3, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
            >
              <Group justify="space-between" align="flex-start">
                <Stack gap={6}>
                  <Text className={styles.statLabel} c="dimmed">
                    {stat.label}
                  </Text>
                  <Text className={styles.statValue} style={{ color: stat.color, fontSize: '1.8rem', fontWeight: 800 }}>
                    {stat.value}
                  </Text>
                </Stack>
                <Box
                  className={styles.statIcon}
                  style={{ backgroundColor: stat.bgColor, color: stat.color, padding: '12px', borderRadius: '12px' }}
                >
                  <stat.icon size={26} stroke={1.5} />
                </Box>
              </Group>
              <Group gap={6} mt="md">
                {index === 0 ? <IconTrendingUp size={16} color={stat.color} /> : <IconArrowUpRight size={14} style={{ color: stat.color }} />}
                <Text size="xs" fw={600} style={{ color: index === 0 ? stat.color : '#94a3b8' }}>{stat.trend}</Text>
              </Group>
            </MotionPaper>
          ))
        )}
      </SimpleGrid>



      {/* Quick Actions Array - Horizontal Scrollable or Grid */}
      <Group mt="xl" mb="md" justify="space-between">
        <Text fw={800} size="lg">Quick Tools</Text>
      </Group>
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <Paper className={styles.quickActionCard} onClick={openDoctorModal} p="md" radius="lg" withBorder style={{ cursor: 'pointer' }}>
          <Group gap="sm">
            <Box style={{ padding: '8px', borderRadius: '8px', background: '#eef2ff', color: '#6366f1' }}>
              <IconPlus size={20} />
            </Box>
            <Text fw={600} size="sm">Add Doctor</Text>
          </Group>
        </Paper>
        <Paper className={styles.quickActionCard} onClick={openPharmacyModal} p="md" radius="lg" withBorder style={{ cursor: 'pointer' }}>
          <Group gap="sm">
            <Box style={{ padding: '8px', borderRadius: '8px', background: '#ecfdf5', color: '#059669' }}>
              <IconPlus size={20} />
            </Box>
            <Text fw={600} size="sm">Add Pharmacy</Text>
          </Group>
        </Paper>
        <Paper className={styles.quickActionCard} onClick={() => navigate('/upload')} p="md" radius="lg" withBorder style={{ cursor: 'pointer' }}>
          <Group gap="sm">
            <Box style={{ padding: '8px', borderRadius: '8px', background: '#fef3c7', color: '#f59e0b' }}>
              <IconUpload size={20} />
            </Box>
            <Text fw={600} size="sm">Upload Excel</Text>
          </Group>
        </Paper>
        <Paper className={styles.quickActionCard} onClick={() => navigate('/history')} p="md" radius="lg" withBorder style={{ cursor: 'pointer' }}>
          <Group gap="sm">
            <Box style={{ padding: '8px', borderRadius: '8px', background: '#f3f4f6', color: '#64748b' }}>
              <IconHistory size={20} />
            </Box>
            <Text fw={600} size="sm">Upload History</Text>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Modals */}
      <AddDoctorModal
        opened={doctorModalOpened}
        onClose={closeDoctorModal}
        onSuccess={handleSuccess}
      />
      <AddPharmacyModal
        opened={pharmacyModalOpened}
        onClose={closePharmacyModal}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
