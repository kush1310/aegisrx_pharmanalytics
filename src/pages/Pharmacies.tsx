import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { modals } from '@mantine/modals';
import { PharmacyCardSkeletonGrid } from '@/components/SkeletonLoaders';
import PageSearchBar from '@/components/PageSearchBar';
import type { SearchSuggestion } from '@/components/PageSearchBar';
import { 
  Button, 
  Card, 
  Text, 
  Group, 
  ActionIcon,
  SimpleGrid,
  Stack,
  Menu,
  Modal,
  TextInput,
  Textarea
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, 
  IconPill,
  IconPhone,
  IconMapPin,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconUser,
  IconLicense,
  IconDownload,
  IconSortAscending,
  IconSortDescending
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import Fuse from 'fuse.js';
import { useAppStore } from '@/stores/appStore';
import type { Pharmacy, PharmacyFormData } from '@/types';
import { exportPharmacyListPDF } from '@/utils/export';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import styles from './Pharmacies.module.css';

// Type assertion to fix framer-motion + Mantine polymorphic component issue
const MotionCard = motion.create ? motion.create(Card as any) : motion(Card as any);

const initialFormData: PharmacyFormData = {
  name: '',
  ownerName: '',
  licenseId: '',
  gstNumber: '',
  drugLicense: '',
  address: '',
  contact: '',
  ownerBirthDate: null
};

type SortField = 'name' | 'ownerName' | 'createdAt';
type SortDir = 'asc' | 'desc';

export default function Pharmacies() {
  const navigate = useNavigate();
  const { pharmacies, fetchPharmacies, fetchStats, isLoadingPharmacies } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);
  const [formData, setFormData] = useState<PharmacyFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  
  const [localSearch, setLocalSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /**
   * isInitialLoading — true on page mount.
   * Enforces a static 2.5-second skeleton loading.
   */
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  /**
   * isSubsequentLoading — true during search/sort re-filters after initial load.
   * Shows the PharmacyCardSkeletonGrid inline with no blur and no artificial delay.
   */
  const [isSubsequentLoading, setIsSubsequentLoading] = useState(false);

  useEffect(() => {
    fetchPharmacies();
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [fetchPharmacies]);

  // When the user types in the search box, show inline skeleton immediately
  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    setIsSubsequentLoading(true);
    // Client-side filter is synchronous; dismiss skeleton after one frame
    requestAnimationFrame(() => setIsSubsequentLoading(false));
  };

  // Fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(pharmacies, {
      keys: ['name', 'ownerName', 'address', 'licenseId'],
      threshold: 0.3,
      includeScore: true
    });
  }, [pharmacies]);

  // Search and Sort
  const filteredPharmacies = useMemo(() => {
    let results = !localSearch.trim() 
      ? [...pharmacies] 
      : fuse.search(localSearch).map(r => r.item);

    results.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'ownerName':
          cmp = (a.ownerName || '').localeCompare(b.ownerName || '');
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return results;
  }, [pharmacies, localSearch, fuse, sortField, sortDir]);

  /**
   * pharmacySuggestions — top-5 matches from filteredPharmacies for the suggestion dropdown.
   * Shows pharmacy name as primary text and owner + contact as secondary text.
   */
  const pharmacySuggestions: SearchSuggestion[] = useMemo(() => {
    if (!localSearch.trim()) return [];
    return filteredPharmacies.slice(0, 5).map(ph => ({
      id: ph.id,
      primaryText: ph.name,
      secondaryText: `${ph.ownerName || ''} • ${ph.contact || ''}`.trim().replace(/•\s*$/, ''),
      icon: <IconPill size={16} color="#f59e0b" />,
    }));
  }, [filteredPharmacies, localSearch]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const openModal = (pharmacy?: Pharmacy) => {
    if (pharmacy) {
      setEditingPharmacy(pharmacy);
      setFormData({
        name: pharmacy.name,
        ownerName: pharmacy.ownerName,
        licenseId: pharmacy.licenseId,
        gstNumber: pharmacy.gstNumber || '',
        drugLicense: pharmacy.drugLicense || '',
        address: pharmacy.address,
        contact: pharmacy.contact,
        ownerBirthDate: pharmacy.ownerBirthDate ? new Date(pharmacy.ownerBirthDate) : null
      });
    } else {
      setEditingPharmacy(null);
      setFormData(initialFormData);
    }
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPharmacy(null);
    setFormData(initialFormData);
    setErrors({});
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    // Owner Name validation
    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required';
    }

    if (!formData.licenseId.trim()) newErrors.licenseId = 'License ID is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    
    // Contact validation
    const cleanContact = formData.contact.replace(/\s/g, '');
    if (!cleanContact) {
      newErrors.contact = 'Contact is required';
    } else if (!/^(?:\+91|91)?[4-9]\d{9}$/.test(cleanContact)) {
      newErrors.contact = 'Must be a valid Indian mobile number (+91 XXXXXXXXXX)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        ownerName: formData.ownerName,
        licenseId: formData.licenseId,
        gstNumber: formData.gstNumber || null,
        drugLicense: formData.drugLicense || null,
        address: formData.address,
        contact: formData.contact,
        ownerBirthDate: formData.ownerBirthDate 
          ? (typeof formData.ownerBirthDate === 'string' ? new Date(formData.ownerBirthDate).toISOString() : (formData.ownerBirthDate as Date).toISOString())
          : null
      };

      let result;
      if (editingPharmacy) {
        result = await api.put(`/api/pharmacies/${editingPharmacy.id}`, payload);
      } else {
        result = await api.post('/api/pharmacies', payload);
      }

      if (result.success) {
        notifications.show({
          title: editingPharmacy ? 'Pharmacy Updated' : 'Pharmacy Added',
          message: `${formData.name} has been ${editingPharmacy ? 'updated' : 'added'}`,
          color: 'green'
        });
        closeModal();
        fetchPharmacies();
        fetchStats();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save pharmacy.',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number, name: string) => {
    modals.openConfirmModal({
      title: 'Delete Pharmacy',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete {name}? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete(`/api/pharmacies/${id}`);
          if (result.success) {
            notifications.show({
              title: 'Pharmacy Deleted',
              message: `${name} has been removed`,
              color: 'green'
            });
            fetchPharmacies();
            fetchStats();
          } else {
            throw new Error(result.error);
          }
        } catch (error: any) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to delete pharmacy',
            color: 'red'
          });
        }
      }
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <PageHeader 
        title="Pharmacies Directory"
        subtitle={`${filteredPharmacies.length} pharmacy store${filteredPharmacies.length !== 1 ? 's' : ''} found`}
        onRefresh={fetchPharmacies}
        refreshing={isLoadingPharmacies}
        action={
          <Group>
            <Button
              variant="light"
              color="indigo"
              leftSection={<IconDownload size={18} />}
              onClick={() => {
                const exportData = filteredPharmacies.map(ph => ({
                  name: ph.name,
                  ownerName: ph.ownerName || 'Unknown',
                  licenseId: ph.licenseId || '-',
                  contact: ph.contact || '-',
                  productCount: (ph as any).products?.length || 0
                }));
                exportPharmacyListPDF(exportData);
              }}
            >
              Export PDF
            </Button>
            <Button 
              leftSection={<IconPlus size={18} />}
              color="green"
              onClick={() => openModal()}
            >
              Add Pharmacy
            </Button>
          </Group>
        }
      />

      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div>

      {/* Search + Sort Bar */}
      <Group gap="sm" mt="lg" mb="lg" align="flex-end">
        <PageSearchBar
          placeholder="Search pharmacies..."
          value={localSearch}
          onChange={handleSearchChange}
          suggestions={pharmacySuggestions}
          sectionLabel="PHARMACIES"
          onSuggestionClick={(s) => { setLocalSearch(s.primaryText); }}
          className="flex-1"
        />
        <Menu shadow="md" position="bottom-end" width={200}>
          <Menu.Target>
            <Button
              variant="light"
              color="gray"
              leftSection={sortDir === 'asc' ? <IconSortAscending size={18} /> : <IconSortDescending size={18} />}
              size="md"
            >
              Sort
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Sort By</Menu.Label>
            <Menu.Item 
              onClick={() => toggleSort('name')}
              rightSection={sortField === 'name' ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}
            >
              Pharmacy Name
            </Menu.Item>
            <Menu.Item 
              onClick={() => toggleSort('ownerName')}
              rightSection={sortField === 'ownerName' ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}
            >
              Owner Name
            </Menu.Item>
            <Menu.Item 
              onClick={() => toggleSort('createdAt')}
              rightSection={sortField === 'createdAt' ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}
            >
              Date Added
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Initial load or subsequent load: skeleton inline, no blur */}
      {(isInitialLoading || isSubsequentLoading || isLoadingPharmacies) ? (
        <PharmacyCardSkeletonGrid count={6} />
      ) : filteredPharmacies.length === 0 ? (
        <Card shadow="sm" radius="lg" p="xl" className={styles.emptyState}>
          <Stack align="center" gap="md">
            <IconPill size={64} stroke={1} color="var(--color-text-muted)" />
            <Text size="lg" fw={800}>No pharmacy stores found</Text>
            <Text c="dimmed" size="sm">
              {localSearch ? 'Try a different search' : 'Add your first pharmacy'}
            </Text>
            {!localSearch && (
              <Button 
                leftSection={<IconPlus size={18} />}
                color="green"
                onClick={() => openModal()}
                mt="sm"
              >
                Add Pharmacy
              </Button>
            )}
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
          {filteredPharmacies.map((pharmacy, index) => (
            <MotionCard
              key={pharmacy.id}
              className={styles.pharmacyCard}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.3 }}
            >
              <div 
                className={styles.cardContent}
                onClick={() => navigate(`/pharmacies/${pharmacy.id}`)}
              >
                <Group wrap="nowrap" gap="md" align="center">
                  <div className={styles.avatar}>
                    <IconPill size={22} />
                  </div>
                  <div className={styles.info} style={{ minWidth: 0, flex: 1 }}>
                    <Text fw={600} size="md" className="text-slate-800 font-semibold tracking-tight" lineClamp={1}>
                      {pharmacy.name}
                    </Text>
                    <div className="flex items-center text-slate-400 mt-1 gap-1 text-xs font-semibold">
                      <IconUser size={13} className="shrink-0" />
                      <span className="truncate">{pharmacy.ownerName}</span>
                    </div>
                  </div>
                </Group>

                <Stack gap="sm" mt="lg">
                  <div className="flex items-center gap-2.5 w-full">
                    <IconPhone size={15} className="shrink-0 text-slate-400" />
                    <Text size="sm" className="text-slate-500 font-medium truncate">{pharmacy.contact}</Text>
                  </div>
                  <div className="flex items-start gap-2.5 w-full">
                    <IconMapPin size={15} className="shrink-0 mt-0.5 text-slate-400" />
                    <Text size="sm" className="text-slate-500 font-medium leading-relaxed" lineClamp={2}>{pharmacy.address}</Text>
                  </div>
                  <div className="flex items-center gap-2.5 w-full">
                    <IconLicense size={15} className="shrink-0 text-slate-400" />
                    <Text size="sm" className="text-slate-500 font-medium truncate">{pharmacy.licenseId}</Text>
                  </div>
                </Stack>
              </div>

              <Group justify="flex-end" align="center" mt="lg" className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon 
                      variant="subtle" 
                      color="gray"
                      radius="md"
                      size="md"
                    >
                      <IconDotsVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item 
                      leftSection={<IconEdit size={16} />}
                      onClick={() => openModal(pharmacy)}
                    >
                      Edit
                    </Menu.Item>
                    <Menu.Item 
                      leftSection={<IconTrash size={16} />}
                      color="red"
                      onClick={() => handleDelete(pharmacy.id, pharmacy.name)}
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </MotionCard>
          ))}
        </SimpleGrid>
        )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={closeModal}
        title={editingPharmacy ? 'Edit Pharmacy' : 'Add New Pharmacy Store'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <SimpleGrid cols={2}>
            <TextInput
              label="Pharmacy Name"
              placeholder="Enter name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
              error={errors.name}
            />
            <TextInput
              label="Owner Name"
              placeholder="Owner's full name"
              required
              value={formData.ownerName}
              onChange={(e) => setFormData({ ...formData, ownerName: e.currentTarget.value })}
              error={errors.ownerName}
            />
          </SimpleGrid>
          
          <TextInput
            label="License ID"
            placeholder="Unique license number"
            required
            value={formData.licenseId}
            onChange={(e) => setFormData({ ...formData, licenseId: e.currentTarget.value })}
            error={errors.licenseId}
          />

          <SimpleGrid cols={2}>
            <TextInput
              label="GST Number"
              placeholder="GST number (optional)"
              value={formData.gstNumber}
              onChange={(e) => setFormData({ ...formData, gstNumber: e.currentTarget.value })}
            />
            <TextInput
              label="Drug License"
              placeholder="Drug license (optional)"
              value={formData.drugLicense}
              onChange={(e) => setFormData({ ...formData, drugLicense: e.currentTarget.value })}
            />
          </SimpleGrid>

          <Textarea
            label="Address"
            placeholder="Full address"
            required
            rows={2}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.currentTarget.value })}
            error={errors.address}
          />

          <SimpleGrid cols={2}>
            <TextInput
              label="Contact Number"
              placeholder="+91 98765 43210"
              required
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.currentTarget.value })}
              error={errors.contact}
            />
            <DateInput
              label="Owner's Birthday"
              placeholder="Select date"
              value={formData.ownerBirthDate}
              onChange={(date) => setFormData({ ...formData, ownerBirthDate: date as Date | null })}
              maxDate={new Date()}
              clearable
            />
          </SimpleGrid>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} color="green">
              {editingPharmacy ? 'Update Pharmacy' : 'Add Pharmacy'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
