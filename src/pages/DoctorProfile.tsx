import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Text, Group, Stack, Badge, Button, ActionIcon,
  Tabs, Skeleton, Paper, Modal, Select
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconStethoscope, IconPhone, IconMapPin, IconCalendar,
  IconHeart, IconEdit, IconTrash, IconPrescription,
  IconPlus, IconLink, IconDownload, IconPill
} from '@tabler/icons-react';
import type { Doctor } from '@/types';
import { useAppStore } from '@/stores/appStore';
import DoctorWizard from '@/components/doctors/DoctorWizard';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import styles from './DoctorProfile.module.css';

export default function DoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pharmacies, fetchPharmacies, fetchDoctors, fetchStats } = useAppStore();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [linkPharmacyOpen, setLinkPharmacyOpen] = useState(false);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);

  const fetchDoctor = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await api.get<Doctor>(`/api/doctors/${Number(id)}`);
      if (result.success && result.data) {
        setDoctor(result.data as Doctor);
      } else {
        throw new Error('Doctor not found');
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load doctor profile', color: 'red' });
      navigate('/doctors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctor();
    fetchPharmacies();
  }, [id]);

  const handleDelete = async () => {
    if (!doctor || !window.confirm(`Are you sure you want to delete ${doctor.name}?`)) return;
    try {
      const result = await api.delete(`/api/doctors/${doctor.id}`);
      if (result.success) {
        notifications.show({ title: 'Doctor Deleted', message: `${doctor.name} has been removed`, color: 'green' });
        fetchDoctors();
        fetchStats();
        navigate('/doctors');
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to delete doctor', color: 'red' });
    }
  };

  const handleLinkPharmacy = async () => {
    if (!doctor || !selectedPharmacyId) return;
    try {
      const result = await api.put(`/api/pharmacies/${Number(selectedPharmacyId)}`, { doctorId: doctor.id });
      if (result.success) {
        notifications.show({ title: 'Pharmacy Linked', message: 'Pharmacy linked to this doctor', color: 'green' });
        setLinkPharmacyOpen(false);
        setSelectedPharmacyId(null);
        fetchDoctor();
        fetchPharmacies();
      } else {
        throw new Error(result.error);
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to link pharmacy', color: 'red' });
    }
  };

  const handleUnlinkPharmacy = async (pharmacyId: number) => {
    if (!doctor || !window.confirm('Are you sure you want to unlink this pharmacy?')) return;
    try {
      await api.put(`/api/pharmacies/${pharmacyId}`, { doctorId: null });
      notifications.show({ title: 'Pharmacy Unlinked', message: 'Pharmacy unlinked from this doctor', color: 'green' });
      fetchDoctor();
      fetchPharmacies();
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to unlink pharmacy', color: 'red' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const availablePharmacies = pharmacies.filter(p => !p.doctorId);

  if (loading) {
    return (
      <div className={styles.container}>
        <Skeleton height={40} width={200} mb="lg" />
        <Card shadow="sm" radius="lg" p="xl">
          <Group gap="lg">
            <Skeleton circle height={80} />
            <div style={{ flex: 1 }}>
              <Skeleton height={28} width="40%" mb="sm" />
              <Skeleton height={16} width="30%" mb="xs" />
              <Skeleton height={16} width="25%" />
            </div>
          </Group>
        </Card>
      </div>
    );
  }

  if (!doctor) return null;

  let childrenNames: string[] = [];
  try {
    if (doctor.childrenNames) {
      childrenNames = doctor.childrenNames.trim().startsWith('[')
        ? JSON.parse(doctor.childrenNames)
        : doctor.childrenNames.split(',').map(n => n.trim());
    }
  } catch {
    childrenNames = doctor.childrenNames ? doctor.childrenNames.split(',').map(n => n.trim()) : [];
  }

  return (
    <div className={styles.container}>
      <PageHeader title="Doctor Profile" showBack={true} />

      <Card shadow="sm" radius="lg" p="xl" className={styles.profileCard}>
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            <div className={styles.avatar}><IconStethoscope size={40} /></div>
            <div>
              <Text size="xl" fw={800}>{doctor.name}</Text>
              <Text c="dimmed">{doctor.specialization}</Text>
              <Badge mt="xs" variant="light">{doctor.qualification}</Badge>
            </div>
          </Group>
          <Group>
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="outline" leftSection={<IconDownload size={16} />}
              onClick={() => import('@/utils/export').then(({ exportProfilePDF }) => exportProfilePDF(doctor))}>
              Export PDF
            </Button>
            <ActionIcon variant="light" color="red" size="lg" onClick={handleDelete}>
              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        </Group>

        <Stack gap="sm" mt="xl">
          <Group gap="sm"><IconPhone size={18} color="var(--color-text-muted)" /><Text>{doctor.contact}</Text></Group>
          <Group gap="sm"><IconMapPin size={18} color="var(--color-text-muted)" /><Text>{doctor.address}</Text></Group>
          {doctor.birthDate && (
            <Group gap="sm"><IconCalendar size={18} color="var(--color-text-muted)" /><Text>Birthday: {formatDate(doctor.birthDate)}</Text></Group>
          )}
          {doctor.isMarried && doctor.spouseName && (
            <Group gap="sm">
              <IconHeart size={18} color="var(--color-text-muted)" />
              <Text>Married to {doctor.spouseName}{doctor.anniversary && ` | Anniversary: ${formatDate(doctor.anniversary)}`}</Text>
            </Group>
          )}
          {childrenNames.length > 0 && <Text c="dimmed" size="sm">Children: {childrenNames.join(', ')}</Text>}
        </Stack>
      </Card>

      <Tabs defaultValue="pharmacies" mt="xl">
        <Tabs.List>
          <Tabs.Tab value="pharmacies" leftSection={<IconPrescription size={16} />}>Linked Pharmacies</Tabs.Tab>
          <Tabs.Tab value="medicines" leftSection={<IconPill size={16} />}>Prescribed Medicines</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="pharmacies" pt="lg">
          <Group justify="space-between" mb="md">
            <Text fw={800}>{doctor.pharmacies?.length || 0} pharmac{doctor.pharmacies?.length !== 1 ? 'ies' : 'y'} linked</Text>
            <Button variant="light" leftSection={<IconPlus size={16} />}
              onClick={() => setLinkPharmacyOpen(true)} disabled={availablePharmacies.length === 0}>
              Link Pharmacy
            </Button>
          </Group>
          <Stack gap="md">
            {doctor.pharmacies?.map((pharmacy) => (
              <Paper key={pharmacy.id} shadow="xs" radius="md" p="md" withBorder>
                <Group justify="space-between" align="flex-start">
                  <Group>
                    <div className={styles.hospitalIcon}><IconPrescription size={24} /></div>
                    <div>
                      <Text fw={800} onClick={() => navigate(`/pharmacies/${pharmacy.id}`)} style={{ cursor: 'pointer' }}>{pharmacy.name}</Text>
                      <Text size="sm" c="dimmed">{pharmacy.address}</Text>
                      {pharmacy.products && pharmacy.products.length > 0 && (
                        <Group gap="xs" mt="xs">
                          <IconPill size={14} color="var(--color-text-muted)" />
                          <Text size="sm" c="dimmed">{pharmacy.products.length} Products</Text>
                          <Group gap="xs">
                            {pharmacy.products.slice(0, 3).map(pp => (
                              <Badge key={pp.id} size="xs" variant="outline" color="gray">{(pp as any).product?.name}</Badge>
                            ))}
                            {pharmacy.products.length > 3 && <Badge size="xs" variant="light" color="gray">+{pharmacy.products.length - 3}</Badge>}
                          </Group>
                        </Group>
                      )}
                    </div>
                  </Group>
                  <ActionIcon variant="subtle" color="red" onClick={() => handleUnlinkPharmacy(pharmacy.id)} title="Unlink Pharmacy">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
            {(!doctor.pharmacies || doctor.pharmacies.length === 0) && (
              <Paper p="xl" radius="md" className={styles.emptyState}>
                <Stack align="center" gap="sm">
                  <IconPrescription size={48} stroke={1} color="var(--color-text-muted)" />
                  <Text c="dimmed">No pharmacies linked yet.</Text>
                  <Button variant="light" size="sm" leftSection={<IconPlus size={14} />} onClick={() => setLinkPharmacyOpen(true)}>
                    Link First Pharmacy
                  </Button>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="medicines" pt="lg">
          <Text fw={800} mb="md">{(doctor as any).prescribedMedicines?.length || 0} medicine{(doctor as any).prescribedMedicines?.length !== 1 ? 's' : ''} prescribed</Text>
          {(doctor as any).prescribedMedicines && (doctor as any).prescribedMedicines.length > 0 ? (
            <Stack gap="xs">
              {(doctor as any).prescribedMedicines.map((med: string, idx: number) => (
                <Paper key={idx} shadow="xs" radius="md" p="sm" withBorder>
                  <Group gap="sm">
                    <Badge size="xs" color="pink" variant="light">#{idx + 1}</Badge>
                    <IconPill size={16} color="var(--color-text-muted)" />
                    <Text size="sm" fw={500}>{med}</Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper p="xl" radius="md" className={styles.emptyState}>
              <Stack align="center" gap="sm">
                <IconPill size={48} stroke={1} color="var(--color-text-muted)" />
                <Text c="dimmed">No medicines found. Link pharmacies with sales data to see prescribed medicines.</Text>
              </Stack>
            </Paper>
          )}
        </Tabs.Panel>
      </Tabs>

      <DoctorWizard opened={editOpen} onClose={() => setEditOpen(false)}
        onSuccess={() => { setEditOpen(false); fetchDoctor(); }} editData={doctor} />

      <Modal opened={linkPharmacyOpen} onClose={() => setLinkPharmacyOpen(false)} title="Link Pharmacy" size="md" centered>
        <Stack gap="md">
          <Select label="Select Pharmacy" placeholder="Choose a pharmacy"
            data={availablePharmacies.map(p => ({ value: String(p.id), label: p.name }))}
            value={selectedPharmacyId} onChange={setSelectedPharmacyId} searchable />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setLinkPharmacyOpen(false)}>Cancel</Button>
            <Button onClick={handleLinkPharmacy} disabled={!selectedPharmacyId} leftSection={<IconLink size={16} />}>
              Link Pharmacy
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
