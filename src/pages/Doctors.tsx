import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { modals } from '@mantine/modals';
import { 
  Button, 
  Card, 
  Text, 
  Group, 
  Badge, 
  ActionIcon,
  SimpleGrid,
  Stack,
  Menu,
  Select
} from '@mantine/core';
import PageLoader from '../components/PageLoader';
import { DoctorCardSkeletonGrid } from '../components/SkeletonLoaders';
import PageSearchBar from '../components/PageSearchBar';
import type { SearchSuggestion } from '../components/PageSearchBar';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconStethoscope,
  IconPhone,
  IconMapPin,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconPrescription,
  IconDownload,
  IconSortAscending,
  IconSortDescending,
  IconFilter,
  IconLink
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import Fuse from 'fuse.js';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import DoctorWizard from '@/components/doctors/DoctorWizard';
import type { Doctor } from '@/types';
import { exportDoctorListPDF } from '@/utils/export';
import PageHeader from '@/components/PageHeader';
import styles from './Doctors.module.css';

// Type assertion to fix framer-motion + Mantine polymorphic component issue
const MotionCard = motion.create(Card as any);

type SortField = 'name' | 'specialization' | 'createdAt';
type SortDir = 'asc' | 'desc';

export default function Doctors() {
  const navigate = useNavigate();
  const { doctors, fetchDoctors, fetchStats, isLoadingDoctors, hasLoadedDoctors } = useAppStore();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [filterSpec, setFilterSpec] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /**
   * isInitialLoading — true only during the very first page mount fetch.
   * Shows the branded PageLoader overlay + backdrop blur for 3 seconds minimum.
   */
  const [isInitialLoading, setIsInitialLoading] = useState(!hasLoadedDoctors);

  /**
   * isFirstLoadRef — tracks whether the mount fetch has completed.
   * Subsequent filter/sort changes bypass the PageLoader and use skeleton only.
   */
  const isFirstLoadRef = useRef(!hasLoadedDoctors);

  useEffect(() => {
    if (!hasLoadedDoctors) {
      const startTime = Date.now();
      fetchDoctors().then(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          setIsInitialLoading(false);
          isFirstLoadRef.current = false;
        }, remaining);
      });
    } else {
      setIsInitialLoading(false);
      isFirstLoadRef.current = false;
      fetchDoctors();
    }
  }, [fetchDoctors, hasLoadedDoctors]);

  // Fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(doctors, {
      keys: ['name', 'contact', 'address', 'specialization', 'qualification'],
      threshold: 0.3,
      includeScore: true
    });
  }, [doctors]);

  // Available specializations for filter
  const specializations = useMemo(() => {
    const specs = new Set(doctors.map(d => d.specialization || 'General'));
    return Array.from(specs).sort().map(s => ({ value: s, label: s }));
  }, [doctors]);

  // Full pipeline: search → filter → sort
  const filteredDoctors = useMemo(() => {
    // 1. Search
    let results = !localSearch.trim()
      ? [...doctors]
      : fuse.search(localSearch).map(r => r.item);

    // 2. Filter by specialization
    if (filterSpec) {
      results = results.filter(d => (d.specialization || 'General') === filterSpec);
    }

    // 3. Sort
    results.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'specialization':
          cmp = (a.specialization || '').localeCompare(b.specialization || '');
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return results;
  }, [doctors, localSearch, fuse, filterSpec, sortField, sortDir]);

  /**
   * doctorSuggestions — top-5 matching doctors derived from filteredDoctors.
   * Shown in the PageSearchBar dropdown as the user types.
   * Each suggestion shows the doctor's name as primary text and
   * specialization + qualification as secondary text.
   */
  const doctorSuggestions: SearchSuggestion[] = useMemo(() => {
    if (!localSearch.trim()) return [];
    return filteredDoctors.slice(0, 5).map(d => ({
      id: d.id,
      primaryText: d.name,
      secondaryText: `${d.specialization || 'General'} • ${d.qualification || ''}`.trim().replace(/•\s*$/, ''),
      icon: <IconStethoscope size={16} color="#6366f1" />,
    }));
  }, [filteredDoctors, localSearch]);

  const handleDelete = (id: number, name: string) => {
    modals.openConfirmModal({
      title: 'Delete Doctor',
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
          const result = await api.delete(`/api/doctors/${id}`);
          if (result.success) {
            notifications.show({ title: 'Doctor Deleted', message: `${name} has been removed`, color: 'green' });
            fetchDoctors();
            fetchStats();
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to delete doctor',
            color: 'red'
          });
        }
      }
    });
  };

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor);
    setWizardOpen(true);
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
    setEditingDoctor(null);
  };

  const handleWizardSuccess = () => {
    handleWizardClose();
    fetchDoctors();
    fetchStats();
  };

  const getPharmacyCount = (doctor: Doctor) => {
    return doctor.pharmacies?.length || 0;
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Actions */}
      <PageHeader 
        title="Doctors Directory"
        subtitle={`${filteredDoctors.length} doctor${filteredDoctors.length !== 1 ? 's' : ''} found`}
        onRefresh={fetchDoctors}
        refreshing={isLoadingDoctors}
        action={
          <Group>
            <Button
              variant="light"
              color="violet"
              leftSection={<IconLink size={18} />}
              onClick={() => navigate('/doctors/linkage')}
            >
              Pharmacy Linkage
            </Button>
            <Button
              variant="light"
              color="indigo"
              leftSection={<IconDownload size={18} />}
              onClick={() => {
                const exportData = filteredDoctors.map(d => ({
                  name: d.name,
                  specialization: d.specialization || 'General',
                  qualification: d.qualification || 'Unknown',
                  contact: d.contact || '-',
                  pharmacyCount: getPharmacyCount(d)
                }));
                exportDoctorListPDF(exportData);
              }}
            >
              Export PDF
            </Button>
            <Button 
              leftSection={<IconPlus size={18} />}
              onClick={() => setWizardOpen(true)}
            >
              Add Doctor
            </Button>
          </Group>
        }
      />

      {/* Content area: blurred only during initial mount load */}
      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {isInitialLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl transition-all duration-300">
            <PageLoader message="Loading doctors directory..." />
          </div>
        )}
        <div className={isInitialLoading ? 'blur-[3px] pointer-events-none select-none transition-all duration-300' : 'transition-all duration-300'}>

          {/* Search + Filter + Sort Bar */}
          <Group gap="sm" mt="lg" mb="lg" align="flex-end">
            <PageSearchBar
              placeholder="Search doctors..."
              value={localSearch}
              onChange={setLocalSearch}
              suggestions={doctorSuggestions}
              sectionLabel="DOCTORS"
              onSuggestionClick={(s) => setLocalSearch(s.primaryText)}
              className="flex-1"
            />
            <Select
              placeholder="Specialization"
              leftSection={<IconFilter size={16} />}
              data={specializations}
              value={filterSpec}
              onChange={setFilterSpec}
              clearable
              size="md"
              w={200}
              comboboxProps={{ shadow: 'md' }}
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
                  Name
                </Menu.Item>
                <Menu.Item 
                  onClick={() => toggleSort('specialization')}
                  rightSection={sortField === 'specialization' ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}
                >
                  Specialization
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

          {/* Doctors Grid — shows real data once loaded, never replaces skeleton with blur */}
          {(isLoadingDoctors && !isInitialLoading) ? (
            <DoctorCardSkeletonGrid count={6} />
          ) : filteredDoctors.length === 0 ? (
            <Card shadow="sm" radius="lg" p="xl" className={styles.emptyState}>
              <Stack align="center" gap="md">
                <IconStethoscope size={64} stroke={1} color="var(--color-text-muted)" />
                <Text size="lg" fw={800}>No doctors found</Text>
                <Text c="dimmed" size="sm" ta="center">
                  {localSearch || filterSpec ? 'Try a different search or filter' : 'Add your first doctor to get started'}
                </Text>
                {!localSearch && !filterSpec && (
                  <Button 
                    leftSection={<IconPlus size={18} />}
                    onClick={() => setWizardOpen(true)}
                    mt="sm"
                  >
                    Add Doctor
                  </Button>
                )}
              </Stack>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
              {filteredDoctors.map((doctor, index) => (
                <MotionCard
                  key={doctor.id}
                  shadow="sm"
                  radius="lg"
                  className={styles.doctorCard}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ 
                    scale: 1.03, 
                    rotateY: 2, 
                    rotateX: 2, 
                    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.15)"
                  }}
                  transition={{ 
                    delay: index * 0.05,
                    type: 'spring',
                    stiffness: 400,
                    damping: 25
                  }}
                >
                  <div 
                    className={styles.cardContent}
                    onClick={() => navigate(`/doctors/${doctor.id}`)}
                  >
                    <Group wrap="nowrap" gap="md">
                      <div className={styles.avatar}>
                        <IconStethoscope size={28} />
                      </div>
                      <div className={styles.info}>
                        <Text fw={800} size="md" lineClamp={1}>
                           {doctor.name}
                        </Text>
                        <Text c="dimmed" size="sm" lineClamp={1}>
                          {doctor.specialization}
                        </Text>
                      </div>
                    </Group>

                    <Stack gap="xs" mt="md">
                      <Group gap="xs">
                        <IconPhone size={14} color="var(--color-text-muted)" />
                        <Text size="sm" c="dimmed">{doctor.contact}</Text>
                      </Group>
                      <Group gap="xs">
                        <IconMapPin size={14} color="var(--color-text-muted)" />
                        <Text size="sm" c="dimmed" lineClamp={1}>{doctor.address}</Text>
                      </Group>
                      {getPharmacyCount(doctor) > 0 && (
                        <Group gap="xs">
                          <IconPrescription size={14} color="var(--color-text-muted)" />
                          <Text size="sm" c="dimmed">
                            {getPharmacyCount(doctor)} pharmac{getPharmacyCount(doctor) !== 1 ? 'ies' : 'y'} linked
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  </div>

                  <Group justify="space-between" align="center" mt="md" className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                    <Badge size="sm" variant="light">
                      {doctor.qualification}
                    </Badge>

                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon 
                          variant="subtle" 
                          color="gray"
                        >
                          <IconDotsVertical size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item 
                          leftSection={<IconEdit size={16} />}
                          onClick={() => handleEdit(doctor)}
                        >
                          Edit Profile
                        </Menu.Item>
                        <Menu.Item 
                          leftSection={<IconTrash size={16} />}
                          color="red"
                          onClick={() => handleDelete(doctor.id, doctor.name)}
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

      {/* Doctor Wizard Modal */}
      <DoctorWizard
        opened={wizardOpen}
        onClose={handleWizardClose}
        onSuccess={handleWizardSuccess}
        editData={editingDoctor}
      />
    </div>
  );
}
