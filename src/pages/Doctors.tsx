import { useEffect, useCallback, useState, useRef } from 'react';
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
import GlobalLoadingOverlay from '../components/GlobalLoadingOverlay';
import { DoctorCardSkeletonGrid } from '../components/SkeletonLoaders';
import PageSearchBar from '../components/PageSearchBar';
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
  IconLink,
  IconChevronLeft,
  IconChevronRight
} from '@tabler/icons-react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import DoctorWizard from '@/components/doctors/DoctorWizard';
import type { Doctor } from '@/types';
import { exportListToExcel } from '@/utils/export';
import PageHeader from '@/components/PageHeader';
import styles from './Doctors.module.css';

const DOCTORS_PER_PAGE = 30;

type SortField = 'name' | 'specialization' | 'createdAt';
type SortDir   = 'asc' | 'desc';

export default function Doctors() {
  const navigate = useNavigate();
  const {
    doctors,
    fetchDoctors,
    fetchStats,
    isLoadingDoctors,
    hasLoadedDoctors,
    doctorTotal,
    doctorPage,
    doctorTotalPages
  } = useAppStore();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

  // Search state — controlled locally, debounced to server
  const [searchInput, setSearchInput] = useState('');
  const [filterSpec,  setFilterSpec]  = useState<string | null>(null);
  const [sortField,   setSortField]   = useState<SortField>('name');
  const [sortDir,     setSortDir]     = useState<SortDir>('asc');

  // Page state is now driven by the store (doctorPage), but we
  // keep a local copy for the debounce ref chain
  const [activePage, setActivePage] = useState(1);

  /**
   * isInitialLoading — true only during the very first page mount fetch.
   * Shows the branded PageLoader overlay + backdrop blur for 3 seconds minimum.
   */
  const [isInitialLoading, setIsInitialLoading] = useState(!hasLoadedDoctors);
  const isFirstLoadRef = useRef(!hasLoadedDoctors);

  /**
   * debounceRef — stable debounce timer reference.
   * Using useRef eliminates the stale-closure bug that caused keystroke drops.
   * The input value is read from the ref, not from a closed-over state variable.
   */
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;

  /**
   * loadPage — fires the server fetch with current page + search state.
   * Memoised so effects and event handlers can depend on it without re-subscribing.
   */
  const loadPage = useCallback(
    (page: number, search: string) => {
      fetchDoctors(page, DOCTORS_PER_PAGE, search);
    },
    [fetchDoctors]
  );

  // Initial mount fetch
  useEffect(() => {
    if (!hasLoadedDoctors) {
      const startTime = Date.now();
      fetchDoctors(1, DOCTORS_PER_PAGE, '').then(() => {
        const elapsed   = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          setIsInitialLoading(false);
          isFirstLoadRef.current = false;
        }, remaining);
      });
    } else {
      setIsInitialLoading(false);
      isFirstLoadRef.current = false;
      fetchDoctors(activePage, DOCTORS_PER_PAGE, searchInputRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * handleSearchChange — updates the controlled input immediately (no lag),
   * then schedules a 300 ms debounce before hitting the server.
   * Page resets to 1 on every new search term.
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      setActivePage(1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadPage(1, value);
      }, 300);
    },
    [loadPage]
  );

  const handlePageChange = (newPage: number) => {
    setActivePage(newPage);
    loadPage(newPage, searchInputRef.current);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Derive available specializations from current page data for filter dropdown
  const specializations = Array.from(new Set(doctors.map(d => d.specialization || 'General')))
    .sort()
    .map(s => ({ value: s, label: s }));

  // Client-side filter + sort applied AFTER server returns the page
  const displayedDoctors = (() => {
    let results = [...doctors];
    if (filterSpec) results = results.filter(d => (d.specialization || 'General') === filterSpec);
    results.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name')           cmp = a.name.localeCompare(b.name);
      if (sortField === 'specialization') cmp = (a.specialization || '').localeCompare(b.specialization || '');
      if (sortField === 'createdAt')      cmp = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return results;
  })();

  const handleDelete = (id: number, name: string) => {
    modals.openConfirmModal({
      title:    'Delete Doctor',
      centered: true,
      children: <Text size="sm">Are you sure you want to delete {name}? This action cannot be undone.</Text>,
      labels:       { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete(`/api/doctors/${id}`);
          if (result.success) {
            notifications.show({ title: 'Doctor Deleted', message: `${name} has been removed`, color: 'green' });
            fetchDoctors(activePage, DOCTORS_PER_PAGE, searchInputRef.current);
            fetchStats();
          } else {
            throw new Error(result.error);
          }
        } catch {
          notifications.show({ title: 'Error', message: 'Failed to delete doctor', color: 'red' });
        }
      }
    });
  };

  const handleEdit           = (doctor: Doctor) => { setEditingDoctor(doctor); setWizardOpen(true); };
  const handleWizardClose    = ()                => { setWizardOpen(false); setEditingDoctor(null); };
  const handleWizardSuccess  = ()                => {
    handleWizardClose();
    fetchDoctors(activePage, DOCTORS_PER_PAGE, searchInputRef.current);
    fetchStats();
  };

  const getPharmacyCount = (doctor: Doctor) => doctor.pharmacies?.length || 0;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // Pagination boundaries
  const pageStart = doctorTotal === 0 ? 0 : (doctorPage - 1) * DOCTORS_PER_PAGE + 1;
  const pageEnd   = Math.min(doctorPage * DOCTORS_PER_PAGE, doctorTotal);

  return (
    <div className={styles.container}>
      <PageHeader
        title="Doctors Directory"
        subtitle={`${doctorTotal} doctor${doctorTotal !== 1 ? 's' : ''} total`}
        onRefresh={() => fetchDoctors(activePage, DOCTORS_PER_PAGE, searchInputRef.current)}
        refreshing={isLoadingDoctors}
        action={
          <Group>
            <Button variant="light" color="violet" leftSection={<IconLink size={18} />} onClick={() => navigate('/doctors/linkage')}>
              Pharmacy Linkage
            </Button>
            <Button
              variant="light"
              color="indigo"
              leftSection={<IconDownload size={18} />}
              onClick={() => {
                const exportData = displayedDoctors.map(d => ({
                  name:           d.name,
                  specialization: d.specialization || 'General',
                  qualification:  d.qualification  || 'Unknown',
                  contact:        d.contact        || '-',
                  address:        d.address        || '-',
                  pharmacyCount:  getPharmacyCount(d)
                }));
                exportListToExcel(
                  exportData,
                  'aegisrx-doctors-directorydoctor',
                  ['Doctor Name', 'Specialization', 'Qualification', 'Phone', 'Address', 'Linked Pharmacies'],
                  ['name', 'specialization', 'qualification', 'contact', 'address', 'pharmacyCount'],
                  'Doctors'
                );
              }}
            >
              Export Excel
            </Button>
            <Button leftSection={<IconPlus size={18} />} onClick={() => setWizardOpen(true)}>
              Add Doctor
            </Button>
          </Group>
        }
      />

      <GlobalLoadingOverlay visible={isInitialLoading} message="Loading doctors directory..." />

      <div className="relative mt-6 flex-1 flex flex-col">
        <div className={isInitialLoading ? 'pointer-events-none select-none opacity-50 transition-all duration-300 flex-1 flex flex-col' : 'transition-all duration-300 flex-1 flex flex-col'}>

          <div className="flex-grow pb-16">
          {/* Search + Filter + Sort Bar */}
          <Group gap="sm" mt="lg" mb="lg" align="flex-end">
            <PageSearchBar
              placeholder="Search doctors..."
              value={searchInput}
              onChange={handleSearchChange}
              suggestions={[]}
              sectionLabel="DOCTORS"
              onSuggestionClick={(s) => handleSearchChange(s.primaryText)}
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
                <Menu.Item onClick={() => toggleSort('name')}           rightSection={sortField === 'name'           ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}>Name</Menu.Item>
                <Menu.Item onClick={() => toggleSort('specialization')} rightSection={sortField === 'specialization' ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}>Specialization</Menu.Item>
                <Menu.Item onClick={() => toggleSort('createdAt')}      rightSection={sortField === 'createdAt'      ? (sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />) : null}>Date Added</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>

          {/* Doctors Grid */}
          {(isLoadingDoctors && !isInitialLoading) ? (
            <DoctorCardSkeletonGrid count={6} />
          ) : displayedDoctors.length === 0 ? (
            <Card shadow="sm" radius="lg" p="xl" className={styles.emptyState}>
              <Stack align="center" gap="md">
                <IconStethoscope size={64} stroke={1} color="var(--color-text-muted)" />
                <Text size="lg" fw={800}>No doctors found</Text>
                <Text c="dimmed" size="sm" ta="center">
                  {searchInput || filterSpec ? 'Try a different search or filter' : 'Add your first doctor to get started'}
                </Text>
                {!searchInput && !filterSpec && (
                  <Button leftSection={<IconPlus size={18} />} onClick={() => setWizardOpen(true)} mt="sm">
                    Add Doctor
                  </Button>
                )}
              </Stack>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
              {displayedDoctors.map((doctor, index) => (
                <Card
                  key={doctor.id}
                  className={`${styles.doctorCard} ${styles.doctorCardAnimate}`}
                  style={{ position: 'relative', animationDelay: `${Math.min(index, 15) * 30}ms` }}
                >
                  <div className={styles.cardContent} onClick={() => navigate(`/doctors/${doctor.id}`)}>
                    <Group wrap="nowrap" gap="md" align="center">
                      <div className={styles.avatar}>
                        <IconStethoscope size={22} />
                      </div>
                      <div className={styles.info} style={{ minWidth: 0, flex: 1 }}>
                        <Text fw={600} size="md" className="text-slate-800 font-semibold tracking-tight" lineClamp={1}>
                          {doctor.name}
                        </Text>
                        <Text size="xs" className="text-indigo-600 font-semibold uppercase tracking-wider" mt={2} lineClamp={1}>
                          {doctor.specialization}
                        </Text>
                      </div>
                    </Group>

                    <Stack gap="sm" mt="lg">
                      <div className="flex items-center gap-2.5 w-full">
                        <IconPhone size={15} className="shrink-0 text-slate-400" />
                        <Text size="sm" className="text-slate-500 font-medium truncate">{doctor.contact}</Text>
                      </div>
                      <div className="flex items-start gap-2.5 w-full">
                        <IconMapPin size={15} className="shrink-0 mt-0.5 text-slate-400" />
                        <Text size="sm" className="text-slate-500 font-medium leading-relaxed" lineClamp={2}>{doctor.address}</Text>
                      </div>
                      {getPharmacyCount(doctor) > 0 && (
                        <div className="flex items-center gap-2.5 w-full">
                          <IconPrescription size={15} className="shrink-0 text-slate-400" />
                          <Text size="sm" className="text-slate-500 font-semibold">
                            {getPharmacyCount(doctor)} linked pharmacy
                          </Text>
                        </div>
                      )}
                    </Stack>
                  </div>

                  {/* Qualification badge at bottom */}
                  <div className={styles.cardActions} onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                    <Badge size="sm" variant="light" color="indigo" radius="md" px="xs" py="md" className="font-bold">
                      {doctor.qualification}
                    </Badge>
                  </div>

                  {/* Three-dot menu */}
                  <div style={{ position: 'absolute', top: 12, right: 12 }} onClick={(e) => e.stopPropagation()}>
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" radius="md" size="md">
                          <IconDotsVertical size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => handleEdit(doctor)}>Edit Profile</Menu.Item>
                        <Menu.Item leftSection={<IconTrash size={16} />} color="red" onClick={() => handleDelete(doctor.id, doctor.name)}>Delete</Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </div>
                </Card>
              ))}
            </SimpleGrid>
          )}
          </div>

          {/* Pagination */}
          {!isLoadingDoctors && doctors.length > 0 && doctorTotalPages > 1 && (
            <div className="sticky bottom-0 mt-auto flex items-center justify-center gap-3 py-3.5 bg-gray-50 border-t border-gray-200 z-50 w-[calc(100%+64px)] -ml-8 -mr-8">
              <Button
                variant="light"
                size="sm"
                leftSection={<IconChevronLeft size={16} />}
                disabled={activePage <= 1 || isLoadingDoctors}
                onClick={() => handlePageChange(activePage - 1)}
              >
                Previous 30
              </Button>
              <Text className="text-[13px] font-semibold text-[#64748b] min-w-[120px] text-center">
                {pageStart}–{pageEnd} of {doctorTotal}
              </Text>
              <Button
                variant="light"
                size="sm"
                rightSection={<IconChevronRight size={16} />}
                disabled={activePage >= doctorTotalPages || isLoadingDoctors}
                onClick={() => handlePageChange(activePage + 1)}
              >
                Next 30
              </Button>
            </div>
          )}
        </div>
      </div>

      <DoctorWizard
        opened={wizardOpen}
        onClose={handleWizardClose}
        onSuccess={handleWizardSuccess}
        editData={editingDoctor}
      />
    </div>
  );
}
