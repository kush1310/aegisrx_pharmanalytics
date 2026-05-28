import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { modals } from '@mantine/modals';
import {
  Card,
  Text,
  Group,
  Stack,
  ActionIcon,
  Tabs,
  Paper
} from '@mantine/core';
import PageLoader from '../components/PageLoader';
import { notifications } from '@mantine/notifications';
import {
  IconPill,
  IconPhone,
  IconTrash,
  IconStethoscope,
  IconUser,
  IconLicense,
  IconCalendar,
  IconMapPin
} from '@tabler/icons-react';
import type { Pharmacy } from '@/types';
import { useAppStore } from '@/stores/appStore';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import styles from './PharmacyProfile.module.css';

export default function PharmacyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchPharmacies, fetchStats } = useAppStore();
  
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [localLoading, setLocalLoading] = useState(true);

  const fetchPharmacy = async () => {
    if (!id) return;
    setLoading(true);
    setLocalLoading(true);
    const startTime = Date.now();
    try {
      const result = await api.get<Pharmacy>(`/api/pharmacies/${Number(id)}`);
      if (result.success && result.data) {
        setPharmacy(result.data as Pharmacy);
      } else {
        throw new Error('Pharmacy not found');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load pharmacy profile',
        color: 'red'
      });
      navigate('/pharmacies');
    } finally {
      setLoading(false);
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 3000 - elapsed);
      setTimeout(() => {
        setLocalLoading(false);
      }, remaining);
    }
  };

  useEffect(() => {
    fetchPharmacy();
  }, [id]);

  const handleDelete = () => {
    if (!pharmacy) return;
    modals.openConfirmModal({
      title: 'Delete Pharmacy',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete {pharmacy.name}? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete(`/api/pharmacies/${pharmacy.id}`);
          if (result.success) {
            notifications.show({
              title: 'Pharmacy Deleted',
              message: `${pharmacy.name} has been removed`,
              color: 'green'
            });
            fetchPharmacies();
            fetchStats();
            navigate('/pharmacies');
          }
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to delete pharmacy',
            color: 'red'
          });
        }
      }
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading && !pharmacy) {
    return (
      <div className={`${styles.container} flex items-center justify-center`} style={{ minHeight: 'calc(100vh - 200px)' }}>
        <PageLoader message="Fetching pharmacy details..." />
      </div>
    );
  }

  if (!pharmacy) return null;

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <PageHeader 
        title="Pharmacy Profile" 
        showBack={true} 
      />

      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className={localLoading ? 'blur-[3px] pointer-events-none select-none transition-all duration-300' : 'transition-all duration-300'}>
        {/* Profile Card */}
        <Card shadow="sm" radius="lg" p="xl" className={styles.profileCard}>
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            <div className={styles.avatar}>
              <IconPill size={40} />
            </div>
            <div>
              <Text size="xl" fw={800}>{pharmacy.name}</Text>
              <Group gap="xs" mt="xs">
                <IconUser size={14} />
                <Text c="dimmed">Owner: {pharmacy.ownerName}</Text>
              </Group>
            </div>
          </Group>
          
          <ActionIcon 
            variant="light" 
            color="red" 
            size="lg"
            onClick={handleDelete}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Group>

        <Stack gap="sm" mt="xl">
          <Group gap="sm">
            <IconPhone size={18} color="var(--color-text-muted)" />
            <Text>{pharmacy.contact}</Text>
          </Group>
          <Group gap="sm">
            <IconMapPin size={18} color="var(--color-text-muted)" />
            <Text>{pharmacy.address}</Text>
          </Group>
          <Group gap="sm">
            <IconLicense size={18} color="var(--color-text-muted)" />
            <Text>License: {pharmacy.licenseId}</Text>
          </Group>
          {pharmacy.gstNumber && (
            <Text c="dimmed" size="sm">GST: {pharmacy.gstNumber}</Text>
          )}
          {pharmacy.drugLicense && (
            <Text c="dimmed" size="sm">Drug License: {pharmacy.drugLicense}</Text>
          )}
          {pharmacy.ownerBirthDate && (
            <Group gap="sm">
              <IconCalendar size={18} color="var(--color-text-muted)" />
              <Text>Owner's Birthday: {formatDate(pharmacy.ownerBirthDate)}</Text>
            </Group>
          )}
        </Stack>
      </Card>

      {/* Linked Doctor Info if available */}
      {pharmacy.doctor && (
        <Card shadow="sm" radius="lg" p="xl" mt="xl" withBorder>
          <Group justify="space-between" mb="md">
            <Text fw={800} size="lg">Assigned Primary Doctor</Text>
            <ActionIcon 
              variant="light" 
              color="blue"
              onClick={() => navigate(`/doctors/${pharmacy.doctor?.id}`)}
              title="View Doctor Profile"
            >
              <IconStethoscope size={18} />
            </ActionIcon>
          </Group>
          <Group>
            <div className={styles.avatar}>
              <IconStethoscope size={28} />
            </div>
            <div>
              <Text fw={800}>{pharmacy.doctor.name}</Text>
              <Text size="sm" c="dimmed">{pharmacy.doctor.specialization}</Text>
              <Text size="sm" c="dimmed">
                <IconPhone size={12} style={{ marginRight: 4 }} />
                {pharmacy.doctor.contact}
              </Text>
            </div>
          </Group>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="products" mt="xl">
        <Tabs.List>
          <Tabs.Tab value="products" leftSection={<IconPill size={16} />}>
            Recent Products ({pharmacy.products?.length || 0})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="products" pt="lg">
          <Stack gap="md">
            {pharmacy.products?.map((pp) => (
              <Paper key={pp.id} shadow="xs" radius="md" p="md" withBorder>
                <Group justify="space-between">
                  <Group>
                    <div className={styles.hospitalIcon}>
                      <IconPill size={24} />
                    </div>
                    <div>
                      <Text fw={800}>{pp.productName || 'Unknown Product'}</Text>
                    </div>
                  </Group>
                </Group>
              </Paper>
            ))}
            
            {(!pharmacy.products || pharmacy.products.length === 0) && (
              <Paper p="xl" radius="md" className={styles.emptyState}>
                <Stack align="center" gap="sm">
                  <IconPill size={48} stroke={1} color="var(--color-text-muted)" />
                  <Text c="dimmed">No products registered yet. Upload excel data to see products mapped here.</Text>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
      </div>

      {localLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl transition-all duration-300">
          <PageLoader message="Fetching pharmacy details..." />
        </div>
      )}
      </div>
    </div>
  );
}
