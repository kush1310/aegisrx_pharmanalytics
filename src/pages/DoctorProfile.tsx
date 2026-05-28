import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { modals } from '@mantine/modals';
import {
  Card, Text, Group, Stack, Badge, Button, ActionIcon,
  Tabs, Paper, Modal, Select,
  Divider, Tooltip
} from '@mantine/core';
import PageLoader from '../components/PageLoader';
import { notifications as notify } from '@mantine/notifications';
import {
  IconStethoscope,
  IconPhone,
  IconMapPin,
  IconCalendar,
  IconHeart,
  IconEdit,
  IconTrash,
  IconBuildingStore,
  IconPlus,
  IconLink,
  IconDownload,
  IconPill,
  IconX,
  IconCheck,
  IconUser,
  IconBriefcase,
  IconId,
  IconMail,
} from '@tabler/icons-react';
import type { Doctor } from '@/types';
import { useAppStore } from '@/stores/appStore';
import DoctorWizard from '@/components/doctors/DoctorWizard';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import styles from './DoctorProfile.module.css';

interface PrescribedMedicine { id: number; name: string; isAutomatic?: boolean; }

/**
 * DoctorProfile — displays full doctor details with:
 *   - Personal info (contact, address, family details)
 *   - Linked pharmacies tab (link/unlink pharmacies)
 *   - Prescribed medicines tab (manually add/remove from product catalogue)
 *
 * @param id - Doctor ID from route params (/doctors/:id)
 * @fetches GET /api/doctors/:id — doctor record + linked pharmacies + prescribedMedicines
 * @fetches GET /api/products    — all products for medicine selection dropdown
 * @redirects /doctors — if doctor not found or deleted
 */
export default function DoctorProfile() {
  const { id } = useParams();
  const navigate  = useNavigate();
  const { pharmacies, fetchPharmacies, fetchDoctors, fetchStats } = useAppStore();

  const [doctor,              setDoctor]              = useState<Doctor | null>(null);
  const [prescribedMedicines, setPrescribedMedicines] = useState<PrescribedMedicine[]>([]);
  const [allProducts,         setAllProducts]         = useState<{ value: string; label: string }[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [localLoading,        setLocalLoading]        = useState(true);
  const [editOpen,            setEditOpen]            = useState(false);
  const [linkPharmacyOpen,    setLinkPharmacyOpen]    = useState(false);
  const [addMedOpen,          setAddMedOpen]          = useState(false);
  const [selectedPharmacyId,  setSelectedPharmacyId]  = useState<string | null>(null);
  const [selectedProductId,   setSelectedProductId]   = useState<string | null>(null);
  const [medAdding,           setMedAdding]           = useState(false);
  const [medRemoving,         setMedRemoving]         = useState<number | null>(null);

  /**
   * Fetches the full doctor record including linked pharmacies and prescribed medicines.
   * Redirects to /doctors on 404 or API error.
   */
  const fetchDoctor = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLocalLoading(true);
    const startTime = Date.now();
    try {
      const result = await api.get<Doctor>(`/api/doctors/${Number(id)}`);
      if (result.success && result.data) {
        const doc = result.data as any;
        setDoctor(doc);
        setPrescribedMedicines(doc.prescribedMedicines || []);
      } else {
        throw new Error('Doctor not found');
      }
    } catch {
      notify.show({ title: 'Not Found', message: 'Doctor profile could not be loaded', color: 'red' });
      navigate('/doctors');
    } finally {
      setLoading(false);
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 3000 - elapsed);
      setTimeout(() => {
        setLocalLoading(false);
      }, remaining);
    }
  }, [id, navigate]);

  /**
   * Fetches all products from the catalogue to populate the medicine dropdown.
   * Maps product records to { value: id, label: name } for the Select component.
   */
  const fetchAllProducts = useCallback(async () => {
    try {
      const result = await api.get<{ id: number; name: string }[]>('/api/products?limit=500');
      if (result.success && result.data) {
        const items = result.data as { id: number; name: string }[];
        setAllProducts(items.map(p => ({ value: String(p.id), label: p.name })));
      }
    } catch (error) {
      console.error('[DoctorProfile] Failed to fetch products:', error);
    }
  }, []);

  useEffect(() => {
    fetchDoctor();
    fetchPharmacies();
    fetchAllProducts();
  }, [id, fetchDoctor, fetchPharmacies, fetchAllProducts]);

  const handleDelete = () => {
    if (!doctor) return;
    modals.openConfirmModal({
      title: 'Delete Doctor',
      centered: true,
      children: (
        <Text size="sm">
          Delete {doctor.name}? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete(`/api/doctors/${doctor.id}`);
          if (result.success) {
            notify.show({ title: 'Doctor Deleted', message: `${doctor.name} removed`, color: 'green' });
            fetchDoctors();
            fetchStats();
            navigate('/doctors');
          }
        } catch {
          notify.show({ title: 'Error', message: 'Failed to delete doctor', color: 'red' });
        }
      }
    });
  };

  const handleLinkPharmacy = async () => {
    if (!doctor || !selectedPharmacyId) return;
    try {
      const result = await api.put(`/api/pharmacies/${Number(selectedPharmacyId)}`, { doctorId: doctor.id });
      if (result.success) {
        notify.show({ title: 'Pharmacy Linked', message: 'Pharmacy linked to this doctor', color: 'green' });
        setLinkPharmacyOpen(false);
        setSelectedPharmacyId(null);
        fetchDoctor();
        fetchPharmacies();
      } else {
        throw new Error(result.error);
      }
    } catch {
      notify.show({ title: 'Error', message: 'Failed to link pharmacy', color: 'red' });
    }
  };

  const handleUnlinkPharmacy = (pharmacyId: number) => {
    if (!doctor) return;
    modals.openConfirmModal({
      title: 'Unlink Pharmacy',
      centered: true,
      children: (
        <Text size="sm">
          Unlink this pharmacy from the doctor?
        </Text>
      ),
      labels: { confirm: 'Unlink', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.put(`/api/pharmacies/${pharmacyId}`, { doctorId: null });
          notify.show({ title: 'Unlinked', message: 'Pharmacy unlinked', color: 'green' });
          fetchDoctor();
          fetchPharmacies();
        } catch {
          notify.show({ title: 'Error', message: 'Failed to unlink pharmacy', color: 'red' });
        }
      }
    });
  };

  /**
   * Links a product (medicine) to this doctor via POST /api/doctors/:id/medicines.
   * Validates that a product is selected before sending the request.
   * Shows 409 conflict message if medicine is already assigned.
   * @validates selectedProductId — must be non-null
   */
  const handleAddMedicine = async () => {
    if (!doctor || !selectedProductId) return;
    setMedAdding(true);
    try {
      const result = await api.post(`/api/doctors/${doctor.id}/medicines`, { productId: Number(selectedProductId) });
      if (result.success) {
        notify.show({ title: 'Medicine Added', message: 'Medicine assigned to doctor', color: 'green' });
        setAddMedOpen(false);
        setSelectedProductId(null);
        fetchDoctor();
      } else {
        notify.show({ title: 'Could Not Add', message: (result as any).error || 'Failed to add medicine', color: 'red' });
      }
    } catch {
      notify.show({ title: 'Error', message: 'Failed to add medicine', color: 'red' });
    } finally {
      setMedAdding(false);
    }
  };

  /**
   * Removes a product-doctor link via DELETE /api/doctors/:id/medicines/:productId.
   * @param productId - The ID of the product to unlink from this doctor
   * @edge-cases Sets medRemoving to the productId during the request for loading state.
   */
  const handleRemoveMedicine = async (productId: number) => {
    if (!doctor) return;
    setMedRemoving(productId);
    try {
      const result = await api.delete(`/api/doctors/${doctor.id}/medicines/${productId}`);
      if (result.success) {
        notify.show({ title: 'Medicine Removed', message: 'Medicine unassigned from doctor', color: 'green' });
        fetchDoctor();
      } else {
        notify.show({ title: 'Error', message: 'Failed to remove medicine', color: 'red' });
      }
    } catch {
      notify.show({ title: 'Error', message: 'Failed to remove medicine', color: 'red' });
    } finally {
      setMedRemoving(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Pharmacies not yet linked to any doctor (available for linking)
  const availablePharmacies = pharmacies.filter(p => !p.doctorId);

  // Products not yet assigned to this doctor (available in dropdown)
  const availableProducts = allProducts.filter(
    p => !prescribedMedicines.find(m => m.id === Number(p.value))
  );

  if (loading && !doctor) {
    return (
      <div className={`${styles.container} flex items-center justify-center`} style={{ minHeight: 'calc(100vh - 200px)' }}>
        <PageLoader message="Fetching doctor details..." />
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

      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className={localLoading ? 'blur-[3px] pointer-events-none select-none transition-all duration-300' : 'transition-all duration-300'}>

      {/* ── Profile Card ─────────────────────────────────────── */}
      <Card shadow="xs" radius="md" p="xl" withBorder className={styles.profileCard}>
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            <div className={styles.avatar}>
              <IconStethoscope size={32} strokeWidth={1.5} />
            </div>
            <div>
              <Text size="xl" fw={800} style={{ letterSpacing: '-0.02em' }}>{doctor.name}</Text>
              <Text c="dimmed" size="sm" mt={2}>{doctor.specialization}</Text>
              <Group gap="xs" mt="xs">
                <Badge variant="light" color="indigo" size="sm">{doctor.qualification}</Badge>
                {doctor.experienceYrs && (
                  <Badge variant="outline" color="gray" size="sm">{doctor.experienceYrs} yrs exp</Badge>
                )}
              </Group>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              size="sm"
              leftSection={<IconEdit size={15} />}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              color="gray"
              leftSection={<IconDownload size={15} />}
              onClick={() => import('@/utils/export').then(({ exportProfilePDF }) => exportProfilePDF(doctor))}
            >
              Export PDF
            </Button>
            <Tooltip label="Delete Doctor" withArrow>
              <ActionIcon variant="light" color="red" size="md" onClick={handleDelete}>
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Divider my="lg" />

        {/* Contact + Personal info grid */}
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <IconPhone size={15} className={styles.infoIcon} />
            <div>
              <span className={styles.infoLabel}>Contact</span>
              <span className={styles.infoValue}>{doctor.contact}</span>
            </div>
          </div>
          <div className={styles.infoItem}>
            <IconMapPin size={15} className={styles.infoIcon} />
            <div>
              <span className={styles.infoLabel}>Address</span>
              <span className={styles.infoValue}>{doctor.address}</span>
            </div>
          </div>
          {doctor.email && (
            <div className={styles.infoItem}>
              <IconMail size={15} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>Email</span>
                <span className={styles.infoValue}>{doctor.email}</span>
              </div>
            </div>
          )}
          {doctor.registrationNo && (
            <div className={styles.infoItem}>
              <IconId size={15} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>Registration No.</span>
                <span className={styles.infoValue}>{doctor.registrationNo}</span>
              </div>
            </div>
          )}
          {doctor.birthDate && (
            <div className={styles.infoItem}>
              <IconCalendar size={15} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>Date of Birth</span>
                <span className={styles.infoValue}>{formatDate(doctor.birthDate)}</span>
              </div>
            </div>
          )}
          {doctor.isMarried && doctor.spouseName && (
            <div className={styles.infoItem}>
              <IconHeart size={15} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>Spouse</span>
                <span className={styles.infoValue}>
                  {doctor.spouseName}
                  {doctor.anniversary && ` — Anniversary: ${formatDate(doctor.anniversary)}`}
                </span>
              </div>
            </div>
          )}
          {childrenNames.length > 0 && (
            <div className={styles.infoItem}>
              <IconUser size={15} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>Children</span>
                <span className={styles.infoValue}>{childrenNames.join(', ')}</span>
              </div>
            </div>
          )}
          {doctor.experienceYrs && (
            <div className={styles.infoItem}>
              <IconBriefcase size={15} className={styles.infoIcon} />
              <div>
                <span className={styles.infoLabel}>Experience</span>
                <span className={styles.infoValue}>{doctor.experienceYrs} years</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <Tabs defaultValue="pharmacies" mt="lg">
        <Tabs.List>
          <Tabs.Tab value="pharmacies" leftSection={<IconBuildingStore size={15} />}>
            Linked Pharmacies
            <Badge size="xs" variant="light" color="indigo" ml="xs">
              {(doctor as any).pharmacies?.length || 0}
            </Badge>
          </Tabs.Tab>
          <Tabs.Tab value="medicines" leftSection={<IconPill size={15} />}>
            Prescribed Medicines
            <Badge size="xs" variant="light" color="green" ml="xs">
              {prescribedMedicines.length}
            </Badge>
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Pharmacies Tab ──────────────────────────────────── */}
        <Tabs.Panel value="pharmacies" pt="lg">
          <Group justify="space-between" mb="md">
            <Text fw={700} size="sm">
              {(doctor as any).pharmacies?.length || 0} pharmac{(doctor as any).pharmacies?.length !== 1 ? 'ies' : 'y'} linked
            </Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={13} />}
              onClick={() => setLinkPharmacyOpen(true)}
              disabled={availablePharmacies.length === 0}
            >
              Link Pharmacy
            </Button>
          </Group>
          <Stack gap="sm">
            {(doctor as any).pharmacies?.map((pharmacy: any) => (
              <Paper key={pharmacy.id} shadow="xs" radius="md" p="md" withBorder className={styles.pharmacyRow}>
                <Group justify="space-between" align="center">
                  <Group gap="md">
                    <div className={styles.pharmIcon}>
                      <IconBuildingStore size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <Text
                        fw={600}
                        size="sm"
                        style={{ cursor: 'pointer', color: '#4f46e5' }}
                        onClick={() => navigate(`/pharmacies/${pharmacy.id}`)}
                      >
                        {pharmacy.name}
                      </Text>
                      <Text size="xs" c="dimmed">{pharmacy.address}</Text>
                    </div>
                  </Group>
                  <Tooltip label="Unlink Pharmacy" withArrow>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => handleUnlinkPharmacy(pharmacy.id)}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Paper>
            ))}
            {(!(doctor as any).pharmacies || (doctor as any).pharmacies.length === 0) && (
              <Paper p="xl" radius="md" withBorder className={styles.emptyState}>
                <Stack align="center" gap="xs">
                  <IconBuildingStore size={40} stroke={1} color="#94a3b8" />
                  <Text c="dimmed" size="sm">No pharmacies linked yet.</Text>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconLink size={13} />}
                    onClick={() => setLinkPharmacyOpen(true)}
                    disabled={availablePharmacies.length === 0}
                  >
                    Link First Pharmacy
                  </Button>
                </Stack>
              </Paper>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ── Medicines Tab ───────────────────────────────────── */}
        <Tabs.Panel value="medicines" pt="lg">
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={700} size="sm">
                {prescribedMedicines.length} medicine{prescribedMedicines.length !== 1 ? 's' : ''} prescribed
              </Text>
              <Text size="xs" c="dimmed">Manually assigned & automatically linked medicines from pharmacy sales data</Text>
            </div>
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconPlus size={13} />}
              onClick={() => setAddMedOpen(true)}
              disabled={availableProducts.length === 0}
            >
              Add Medicine
            </Button>
          </Group>

          {prescribedMedicines.length > 0 ? (
            <div className={styles.medicineGrid}>
              {prescribedMedicines.map(med => (
                <div
                  key={med.id}
                  className={`${styles.medicineChip} ${med.isAutomatic ? 'bg-teal-50 border-teal-200 text-teal-700' : ''}`}
                >
                  <IconPill size={13} className={med.isAutomatic ? 'text-teal-600' : styles.medIcon} />
                  <span>{med.name}</span>
                  {med.isAutomatic ? (
                    <Badge color="teal" variant="light" size="xs" ml="xs" style={{ height: 16, fontSize: 9 }}>Auto</Badge>
                  ) : (
                    <Tooltip label="Remove" withArrow>
                      <button
                        className={styles.medRemoveBtn}
                        onClick={() => handleRemoveMedicine(med.id)}
                        disabled={medRemoving === med.id}
                      >
                        {medRemoving === med.id ? '...' : <IconX size={11} />}
                      </button>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Paper p="xl" radius="md" withBorder className={styles.emptyState}>
              <Stack align="center" gap="xs">
                <IconPill size={40} stroke={1} color="#94a3b8" />
                <Text c="dimmed" size="sm">No medicines assigned yet.</Text>
                <Text size="xs" c="dimmed">Use the Add Medicine button to assign from the product catalogue.</Text>
              </Stack>
            </Paper>
          )}
        </Tabs.Panel>
      </Tabs>
      </div>

      {localLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl transition-all duration-300">
          <PageLoader message="Fetching doctor details..." />
        </div>
      )}
      </div>

      {/* ── Edit Modal ───────────────────────────────────────── */}
      <DoctorWizard
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => { setEditOpen(false); fetchDoctor(); }}
        editData={doctor}
      />

      {/* ── Link Pharmacy Modal ──────────────────────────────── */}
      <Modal
        opened={linkPharmacyOpen}
        onClose={() => { setLinkPharmacyOpen(false); setSelectedPharmacyId(null); }}
        title="Link a Pharmacy"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Select
            label="Select Pharmacy"
            placeholder="Choose an unlinked pharmacy..."
            data={availablePharmacies.map(p => ({ value: String(p.id), label: p.name }))}
            value={selectedPharmacyId}
            onChange={setSelectedPharmacyId}
            searchable
            clearable
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => setLinkPharmacyOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              leftSection={<IconCheck size={14} />}
              onClick={handleLinkPharmacy}
              disabled={!selectedPharmacyId}
            >
              Link Pharmacy
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ── Add Medicine Modal ───────────────────────────────── */}
      <Modal
        opened={addMedOpen}
        onClose={() => { setAddMedOpen(false); setSelectedProductId(null); }}
        title="Add Prescribed Medicine"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Select
            label="Select Medicine"
            description="Choose from the product catalogue"
            placeholder="Search medicines..."
            data={availableProducts}
            value={selectedProductId}
            onChange={setSelectedProductId}
            searchable
            clearable
          />
          <Group justify="flex-end">
            <Button variant="default" size="sm" onClick={() => { setAddMedOpen(false); setSelectedProductId(null); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              color="green"
              leftSection={<IconCheck size={14} />}
              onClick={handleAddMedicine}
              disabled={!selectedProductId}
              loading={medAdding}
            >
              Assign Medicine
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
