import { useEffect, useState, useMemo } from 'react';
import { modals } from '@mantine/modals';
import {
  Card, Text, Group, Button, Badge, Table, ScrollArea,
  Select, ActionIcon, Tooltip, Paper,
  SimpleGrid, ThemeIcon
} from '@mantine/core';
import { TableRowSkeleton } from '../components/SkeletonLoaders';
import PremiumSearchBar from '../components/PremiumSearchBar';
import { notifications } from '@mantine/notifications';
import {
  IconLink, IconUnlink, IconStethoscope, IconPrescription,
  IconDownload, IconFilter, IconEdit,
  IconCheck, IconX, IconSortAscending, IconSortDescending
} from '@tabler/icons-react';
import Fuse from 'fuse.js';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { exportToCSV } from '@/utils/export';
import styles from './DoctorPharmacyLinkage.module.css';

interface LinkageRow {
  pharmacyId: number;
  pharmacyName: string;
  pharmacyAddress: string;
  isDraft: boolean;
  doctorId: number | null;
  doctorName: string | null;
  doctorSpecialization: string | null;
}

interface DoctorOption {
  id: number;
  name: string;
  specialization: string;
}

type SortField = 'pharmacyName' | 'doctorName';
type SortDir = 'asc' | 'desc';

export default function DoctorPharmacyLinkage() {
  const [linkages, setLinkages] = useState<LinkageRow[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('pharmacyName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Inline editing state
  const [editingPharmacyId, setEditingPharmacyId] = useState<number | null>(null);
  const [editDoctorId, setEditDoctorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchLinkages = async () => {
    try {
      const result = await api.get<{ linkages: LinkageRow[]; doctors: DoctorOption[] }>('/api/doctors/linkage');
      if (result.success && result.data) {
        setLinkages((result.data as any).linkages || []);
        setDoctorOptions((result.data as any).doctors || []);
      }
    } catch (err) {
      console.error('Failed to fetch linkages:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLinkages();
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(linkages, {
      keys: ['pharmacyName', 'doctorName'],
      threshold: 0.3,
    });
  }, [linkages]);

  // Processed data pipeline: search → filter → sort
  const processedData = useMemo(() => {
    let results = !searchQuery.trim()
      ? [...linkages]
      : fuse.search(searchQuery).map(r => r.item);

    // Filter
    if (filterType === 'linked') {
      results = results.filter(r => r.doctorId !== null);
    } else if (filterType === 'unlinked') {
      results = results.filter(r => r.doctorId === null);
    } else if (filterType === 'draft') {
      results = results.filter(r => r.isDraft);
    }

    // Sort
    results.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'pharmacyName':
          cmp = a.pharmacyName.localeCompare(b.pharmacyName);
          break;
        case 'doctorName':
          cmp = (a.doctorName || '').localeCompare(b.doctorName || '');
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return results;
  }, [linkages, searchQuery, fuse, filterType, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleStartEdit = (row: LinkageRow) => {
    setEditingPharmacyId(row.pharmacyId);
    setEditDoctorId(row.doctorId ? String(row.doctorId) : null);
  };

  const handleCancelEdit = () => {
    setEditingPharmacyId(null);
    setEditDoctorId(null);
  };

  const handleSaveEdit = async () => {
    if (editingPharmacyId === null) return;
    setSaving(true);
    try {
      const result = await api.put('/api/doctors/linkage', {
        pharmacyId: editingPharmacyId,
        doctorId: editDoctorId ? Number(editDoctorId) : null,
      });
      if (result.success) {
        notifications.show({
          title: 'Linkage Updated',
          message: 'Doctor-Pharmacy linkage has been saved.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setEditingPharmacyId(null);
        setEditDoctorId(null);
        fetchLinkages();
      } else {
        throw new Error(result.error);
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update linkage', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = (pharmacyId: number, pharmacyName: string) => {
    modals.openConfirmModal({
      title: 'Unlink Doctor',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to remove the doctor link from {pharmacyName}?
        </Text>
      ),
      labels: { confirm: 'Unlink', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.put('/api/doctors/linkage', {
            pharmacyId,
            doctorId: null,
          });
          if (result.success) {
            notifications.show({ title: 'Unlinked', message: `${pharmacyName} is now unlinked`, color: 'orange' });
            fetchLinkages();
          }
        } catch {
          notifications.show({ title: 'Error', message: 'Failed to unlink', color: 'red' });
        }
      }
    });
  };

  const handleExportCSV = () => {
    const csvData = processedData.map((row, idx) => ({
      '#': idx + 1,
      'Pharmacy': row.pharmacyName,
      'Doctor': row.doctorName || 'Not Linked',
      'Specialization': row.doctorSpecialization || '-',
      'Status': row.isDraft ? 'Draft' : 'Verified',
    }));
    exportToCSV(csvData, `doctor_pharmacy_linkage_${new Date().toISOString().split('T')[0]}`, ['#', 'Pharmacy', 'Doctor', 'Specialization', 'Status']);
  };

  const handleSaveAllDrafts = async () => {
    setSaving(true);
    try {
      const result = await api.post('/api/doctors/linkage/verify-all', {});
      if (result.success) {
        notifications.show({
          title: 'Linkages Saved',
          message: 'All draft pharmacies have been verified and saved.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        fetchLinkages();
      } else {
        throw new Error(result.error);
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save all linkages', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const linked = linkages.filter(l => l.doctorId !== null).length;
    const unlinked = linkages.filter(l => l.doctorId === null).length;
    const totalDoctors = new Set(linkages.filter(l => l.doctorId).map(l => l.doctorId)).size;
    const drafts = linkages.filter(l => l.isDraft).length;
    return { linked, unlinked, totalDoctors, totalPharmacies: linkages.length, drafts };
  }, [linkages]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <IconSortAscending size={14} style={{ marginLeft: 4 }} />
      : <IconSortDescending size={14} style={{ marginLeft: 4 }} />;
  };

  return (
    <div className={styles.container}>
      <PageHeader
        title="Doctor-Pharmacy Linkage"
        subtitle={`${stats.totalPharmacies} pharmacies · ${stats.totalDoctors} doctors linked`}
        onRefresh={fetchLinkages}
        refreshing={loading}
        action={
          <Group>
            <Button
              variant="light"
              color="gray"
              leftSection={<IconDownload size={18} />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button
              leftSection={<IconLink size={18} />}
              onClick={handleSaveAllDrafts}
              loading={saving}
              disabled={stats.drafts === 0}
            >
              Save Linkages ({stats.drafts})
            </Button>
          </Group>
        }
      />

      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div>

      {/* Summary Stats */}
      <SimpleGrid cols={{ base: 1, md: 3 }} mb="xl" mt="lg">
        <Paper className={styles.statCard} p="md" radius="lg" withBorder>
          <Group gap="sm">
            <ThemeIcon variant="light" color="violet" size="lg" radius="md">
              <IconPrescription size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Pharmacies</Text>
              <Text fw={800} size="lg">{stats.totalPharmacies}</Text>
            </div>
          </Group>
        </Paper>
        <Paper className={styles.statCard} p="md" radius="lg" withBorder>
          <Group gap="sm">
            <ThemeIcon variant="light" color="teal" size="lg" radius="md">
              <IconLink size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Linked Pharmacies</Text>
              <Text fw={800} size="lg" c="teal">{stats.linked}</Text>
            </div>
          </Group>
        </Paper>
        <Paper className={styles.statCard} p="md" radius="lg" withBorder>
          <Group gap="sm">
            <ThemeIcon variant="light" color="orange" size="lg" radius="md">
              <IconUnlink size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Unlinked Pharmacies</Text>
              <Text fw={800} size="lg" c="orange">{stats.unlinked}</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Search + Filter Bar */}
      <Group gap="sm" mb="lg" align="flex-end">
        <PremiumSearchBar
          placeholder="Search pharmacy or doctor..."
          value={searchQuery}
          onChange={setSearchQuery}
          className="flex-1"
        />
        <Select
          placeholder="Filter"
          leftSection={<IconFilter size={16} />}
          data={[
            { value: 'linked', label: 'Linked Only' },
            { value: 'unlinked', label: 'Unlinked Only' },
            { value: 'draft', label: 'Draft Pharmacies' },
          ]}
          value={filterType}
          onChange={setFilterType}
          clearable
          size="md"
          w={200}
        />
      </Group>

      {/* Linkage Table */}
      <Card radius="lg" p={0} className={styles.tableCard}>
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="lg">
            <Table.Thead className={styles.tableHeader}>
              <Table.Tr>
                <Table.Th style={{ width: 50 }}>#</Table.Th>
                <Table.Th
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleSort('pharmacyName')}
                >
                  <Group gap={4} wrap="nowrap">Pharmacy <SortIcon field="pharmacyName" /></Group>
                </Table.Th>
                <Table.Th
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleSort('doctorName')}
                >
                  <Group gap={4} wrap="nowrap">Linked Doctor <SortIcon field="doctorName" /></Group>
                </Table.Th>
                <Table.Th>Specialization</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: 'right', width: 140 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} columnCount={6} rowIndex={i} />
                ))
              ) : processedData.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" py="xl" c="dimmed">No linkages found</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                processedData.map((row, idx) => (
                  <Table.Tr key={row.pharmacyId}>
                    <Table.Td>
                      <Badge size="xs" color={idx < 3 ? 'yellow' : idx < 10 ? 'blue' : 'gray'}>
                        #{idx + 1}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <ThemeIcon variant="light" color="violet" size="sm" radius="md">
                          <IconPrescription size={12} />
                        </ThemeIcon>
                        <div>
                          <Text fw={600} size="sm" lineClamp={1}>{row.pharmacyName}</Text>
                          {row.pharmacyAddress && (
                            <Text size="xs" c="dimmed" lineClamp={1}>{row.pharmacyAddress}</Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {editingPharmacyId === row.pharmacyId ? (
                        <Select
                           placeholder="Select Doctor"
                           data={doctorOptions.map(d => ({ value: String(d.id), label: d.name }))}
                           value={editDoctorId}
                           onChange={setEditDoctorId}
                           searchable
                           clearable
                           size="xs"
                           w={200}
                        />
                      ) : row.doctorName ? (
                        <Group gap="xs" wrap="nowrap">
                          <ThemeIcon variant="light" color="indigo" size="sm" radius="md">
                            <IconStethoscope size={12} />
                          </ThemeIcon>
                          <Text fw={600} size="sm">{row.doctorName}</Text>
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed" fs="italic">Not Linked</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {row.doctorSpecialization || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {row.isDraft ? (
                        <Badge variant="light" color="orange" size="xs">Draft</Badge>
                      ) : (
                        <Badge variant="light" color="green" size="xs">Verified</Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        {editingPharmacyId === row.pharmacyId ? (
                          <>
                            <Tooltip label="Save">
                              <ActionIcon
                                variant="light"
                                color="green"
                                size="sm"
                                onClick={handleSaveEdit}
                                loading={saving}
                              >
                                <IconCheck size={14} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Cancel">
                              <ActionIcon variant="light" color="gray" size="sm" onClick={handleCancelEdit}>
                                <IconX size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip label="Edit Linkage">
                              <ActionIcon variant="light" color="indigo" size="sm" onClick={() => handleStartEdit(row)}>
                                <IconEdit size={14} />
                              </ActionIcon>
                            </Tooltip>
                            {row.doctorId && (
                              <Tooltip label="Unlink Doctor">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  size="sm"
                                  onClick={() => handleUnlink(row.pharmacyId, row.pharmacyName)}
                                >
                                  <IconUnlink size={14} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                          </>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>
    </div>

    </div>
  </div>
  );
}
