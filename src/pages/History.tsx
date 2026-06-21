import { useEffect, useState, useMemo } from 'react';
import { modals } from '@mantine/modals';
import {
  Card,
  Text,
  Group,
  Stack,
  Button,
  Paper,
  Badge,
  ActionIcon,
  Menu,
  Table,
  ScrollArea,
  Select,
  Tooltip,
  ThemeIcon
} from '@mantine/core';
import {
  IconFileSpreadsheet,
  IconCalendar,
  IconDownload,
  IconTrash,
  IconDotsVertical,
  IconUpload,
  IconSortAscending,
  IconSortDescending,
  IconFilter,
  IconDatabase,
  IconChartBar,
  IconEye,
  IconRefresh
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { exportListToExcel } from '@/utils/export';
import { api } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import GlobalLoadingOverlay from '@/components/GlobalLoadingOverlay';
import { TableSkeletonBody } from '@/components/SkeletonLoaders';
import { useAppStore } from '@/stores/appStore';
import PremiumSearchBar from '@/components/PremiumSearchBar';
import styles from './History.module.css';

interface ExcelUpload {
  id: number;
  fileName: string;
  uploadDate: string;
  fileSize: number;
  status: string;
  recordCount?: number;
  detectedFormat?: string;
}

type SortField = 'uploadDate' | 'fileName' | 'fileSize' | 'recordCount';
type SortDir = 'asc' | 'desc';

const FORMAT_LABELS: Record<string, { label: string; color: string }> = {
  party_report: { label: 'Sales Report', color: 'violet' },
  product: { label: 'Product Master', color: 'blue' },
  doctor: { label: 'Doctors', color: 'teal' },
  pharmacy: { label: 'Pharmacies', color: 'green' },
  unknown: { label: 'Other', color: 'gray' },
};

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  PROCESSED: { color: 'green', label: 'Processed' },
  COMPLETED: { color: 'green', label: 'Completed' },
  PROCESSING: { color: 'yellow', label: 'Processing' },
  ERROR: { color: 'red', label: 'Error' },
  ERROR_EMPTY: { color: 'red', label: 'Empty File' },
  ERROR_UNKNOWN_FORMAT: { color: 'orange', label: 'Unknown Format' },
};

export default function History() {
  const navigate = useNavigate();
  const { hasLoadedHistory, setHasLoadedHistory } = useAppStore();
  const [uploads, setUploads] = useState<ExcelUpload[]>([]);
  const [loading, setLoading] = useState(!hasLoadedHistory);
  const [isSubsequentLoading, setIsSubsequentLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('uploadDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterFormat, setFilterFormat] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!hasLoadedHistory) {
      setLoading(true);
      const startTime = Date.now();
      try {
        const result = await api.get<ExcelUpload[]>('/api/excel/history');
        if (result.success && result.data) {
          setUploads(result.data as ExcelUpload[]);
          setHasLoadedHistory(true);
        } else {
          throw new Error(result.error || 'Failed to fetch history');
        }
      } catch (error) {
        console.error('[History] Failed to fetch history:', error);
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          setLoading(false);
        }, remaining);
      }
    } else {
      setIsSubsequentLoading(true);
      try {
        const result = await api.get<ExcelUpload[]>('/api/excel/history');
        if (result.success && result.data) {
          setUploads(result.data as ExcelUpload[]);
        } else {
          throw new Error(result.error || 'Failed to fetch history');
        }
      } catch (error) {
        console.error('[History] Failed to fetch history:', error);
      } finally {
        setIsSubsequentLoading(false);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (uploadId: number, fileName: string) => {
    try {
      const result = await api.get<{ buffer: number[]; fileName: string }>(`/api/excel/${uploadId}/download`);
      if (result.success && result.data) {
        const blob = new Blob([new Uint8Array(result.data.buffer)]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.fileName || fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
      }
    } catch(err) {
       console.error('Download failed', err);
    }
  };

  const handleDelete = (uploadId: number) => {
    modals.openConfirmModal({
      title: 'Delete Upload',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete this upload? This action will permanently remove all associated analytics data.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete(`/api/excel/${uploadId}`);
          if (result.success) {
            setUploads(prev => prev.filter(u => u.id !== uploadId));
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  const handleExportExcel = () => {
    const exportData = processedUploads.map(u => ({
      fileName:   u.fileName,
      uploadDate: formatDate(u.uploadDate),
      fileSize:   u.fileSize ? formatSize(u.fileSize) : 'Unknown',
      records:    u.recordCount || 0,
      format:     FORMAT_LABELS[u.detectedFormat || 'unknown']?.label || 'Unknown',
      status:     u.status
    }));
    exportListToExcel(
      exportData,
      `upload_history_${new Date().toISOString().split('T')[0]}`,
      ['File Name', 'Upload Date', 'File Size', 'Records', 'Format', 'Status'],
      ['fileName', 'uploadDate', 'fileSize', 'records', 'format', 'status'],
      'Uploads'
    );
  };

  /**
   * handleReprocess
   *
   * Calls POST /api/upload/intelligent/reprocess/:id to re-trigger the background
   * parsing pipeline for a previously failed upload. The file bytes are already stored
   * in the DB — only the processing step is re-executed with the fixed parser.
   * Updates the local state to show PROCESSING status immediately.
   *
   * @param {number} uploadId - Primary key of the upload to reprocess.
   */
  const handleReprocess = async (uploadId: number) => {
    try {
      const result = await api.post(`/api/upload/intelligent/reprocess/${uploadId}`, {});
      if (result.success) {
        // Optimistically mark as PROCESSING in the local list
        setUploads(prev => prev.map(u =>
          u.id === uploadId ? { ...u, status: 'PROCESSING' } : u
        ));
        // Re-fetch after 6 seconds to show the completed status
        setTimeout(() => fetchHistory(), 6000);
      }
    } catch (err) {
      console.error('[History] Reprocess failed:', err);
    }
  };

  // Fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(uploads, {
      keys: ['fileName'],
      threshold: 0.3,
      includeScore: true
    });
  }, [uploads]);

  // Available formats for filter dropdown
  const availableFormats = useMemo(() => {
    const formats = new Set(uploads.map(u => u.detectedFormat || 'unknown'));
    return Array.from(formats).map(f => ({
      value: f,
      label: FORMAT_LABELS[f]?.label || f
    }));
  }, [uploads]);

  // Available statuses for filter dropdown
  const availableStatuses = useMemo(() => {
    const statuses = new Set(uploads.map(u => u.status));
    return Array.from(statuses).map(s => ({
      value: s,
      label: STATUS_MAP[s]?.label || s
    }));
  }, [uploads]);

  // Full pipeline: search → filter → sort
  const processedUploads = useMemo(() => {
    // 1. Search
    let results = !searchQuery.trim()
      ? [...uploads]
      : fuse.search(searchQuery).map(r => r.item);

    // 2. Filter by format
    if (filterFormat) {
      results = results.filter(u => (u.detectedFormat || 'unknown') === filterFormat);
    }

    // 3. Filter by status
    if (filterStatus) {
      results = results.filter(u => u.status === filterStatus);
    }

    // 4. Sort
    results.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'uploadDate':
          cmp = new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
          break;
        case 'fileName':
          cmp = a.fileName.localeCompare(b.fileName);
          break;
        case 'fileSize':
          cmp = (a.fileSize || 0) - (b.fileSize || 0);
          break;
        case 'recordCount':
          cmp = (a.recordCount || 0) - (b.recordCount || 0);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return results;
  }, [uploads, searchQuery, fuse, filterFormat, filterStatus, sortField, sortDir]);

  // Summary stats
  const totalRecords = useMemo(() => uploads.reduce((s, u) => s + (u.recordCount || 0), 0), [uploads]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <IconSortAscending size={14} style={{ marginLeft: 4 }} />
      : <IconSortDescending size={14} style={{ marginLeft: 4 }} />;
  };

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Upload History"
        subtitle={`${uploads.length} file${uploads.length !== 1 ? 's' : ''} uploaded · ${totalRecords.toLocaleString()} total records`}
        onRefresh={fetchHistory}
        refreshing={loading}
        action={
          <Group>
            <Button
              variant="light"
              color="indigo"
              leftSection={<IconDownload size={18} />}
              onClick={handleExportExcel}
              disabled={processedUploads.length === 0}
            >
              Export Excel
            </Button>
            <Button
              color="indigo"
              leftSection={<IconUpload size={18} />}
              onClick={() => navigate('/upload')}
            >
              New Upload
            </Button>
          </Group>
        }
      />

      <GlobalLoadingOverlay visible={loading} message="Retrieving upload history..." />

      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className={loading ? 'pointer-events-none select-none opacity-50 transition-all duration-300' : 'transition-all duration-300'}>

      {/* Summary Stats Cards */}
      {uploads.length > 0 && (
        <Group gap="md" mt="lg" mb="md">
          <Paper className={styles.statCard} p="sm" radius="md" withBorder>
            <Group gap="xs">
              <ThemeIcon variant="light" color="indigo" size="md" radius="md">
                <IconFileSpreadsheet size={16} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Files</Text>
                <Text fw={800} size="lg">{uploads.length}</Text>
              </div>
            </Group>
          </Paper>
          <Paper className={styles.statCard} p="sm" radius="md" withBorder>
            <Group gap="xs">
              <ThemeIcon variant="light" color="violet" size="md" radius="md">
                <IconDatabase size={16} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Records</Text>
                <Text fw={800} size="lg">{totalRecords.toLocaleString()}</Text>
              </div>
            </Group>
          </Paper>
          <Paper className={styles.statCard} p="sm" radius="md" withBorder>
            <Group gap="xs">
              <ThemeIcon variant="light" color="green" size="md" radius="md">
                <IconChartBar size={16} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Processed</Text>
                <Text fw={800} size="lg">
                  {uploads.filter(u => u.status === 'PROCESSED' || u.status === 'COMPLETED').length}
                </Text>
              </div>
            </Group>
          </Paper>
        </Group>
      )}

      {/* Search + Filter Bar */}
      <Group gap="sm" mt="md" mb="lg" align="flex-end">
        <PremiumSearchBar
          placeholder="Search by file name..."
          value={searchQuery}
          onChange={setSearchQuery}
          className="flex-1"
        />
        <Select
          placeholder="Format"
          leftSection={<IconFilter size={16} />}
          data={availableFormats}
          value={filterFormat}
          onChange={setFilterFormat}
          clearable
          size="md"
          w={180}
          comboboxProps={{ shadow: 'md' }}
        />
        <Select
          placeholder="Status"
          leftSection={<IconFilter size={16} />}
          data={availableStatuses}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          size="md"
          w={160}
          comboboxProps={{ shadow: 'md' }}
        />
      </Group>

      {/* History Table */}
      {processedUploads.length === 0 ? (
        <Paper p="xl" radius="lg" className={styles.emptyState}>
          <Stack align="center" gap="md">
            <IconFileSpreadsheet size={48} color="gray" />
            <Text size="lg" fw={500} c="dimmed">
              {searchQuery || filterFormat || filterStatus ? 'No files match your filters' : 'No upload history yet'}
            </Text>
            <Text size="sm" c="dimmed">
              Upload an Excel, CSV, or PDF file to see it here
            </Text>
            {!searchQuery && !filterFormat && !filterStatus && (
              <Button onClick={() => navigate('/upload')}>
                Upload First File
              </Button>
            )}
          </Stack>
        </Paper>
      ) : (
        <Card radius="lg" p={0} className={styles.tableCard}>
          <ScrollArea>
            <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead className={styles.tableHeader}>
                <Table.Tr>
                  <Table.Th 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => toggleSort('fileName')}
                  >
                    <Group gap={4} wrap="nowrap">
                      File Name <SortIcon field="fileName" />
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleSort('uploadDate')}
                  >
                    <Group gap={4} wrap="nowrap">
                      Upload Date <SortIcon field="uploadDate" />
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleSort('fileSize')}
                  >
                    <Group gap={4} wrap="nowrap">
                      Size <SortIcon field="fileSize" />
                    </Group>
                  </Table.Th>
                  <Table.Th
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleSort('recordCount')}
                  >
                    <Group gap={4} wrap="nowrap">
                      Records <SortIcon field="recordCount" />
                    </Group>
                  </Table.Th>
                  <Table.Th>Format</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              {isSubsequentLoading ? (
                <TableSkeletonBody rowCount={5} columnCount={7} />
              ) : (
                <Table.Tbody>
                  <AnimatePresence>
                    {processedUploads.map((upload, index) => {
                      const fmt = FORMAT_LABELS[upload.detectedFormat || 'unknown'] || FORMAT_LABELS.unknown;
                      const sts = STATUS_MAP[upload.status] || { color: 'gray', label: upload.status };
                      return (
                        <motion.tr
                          key={upload.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.03, duration: 0.3 }}
                          style={{ cursor: 'default' }}
                        >
                          <Table.Td>
                            <Group gap="sm" wrap="nowrap">
                              <ThemeIcon variant="light" color="indigo" size="sm" radius="md">
                                <IconFileSpreadsheet size={14} />
                              </ThemeIcon>
                              <Tooltip label={upload.fileName} position="top" multiline maw={400}>
                                <Text fw={500} size="sm" lineClamp={1} style={{ maxWidth: 280 }}>
                                  {upload.fileName}
                                </Text>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <IconCalendar size={14} color="gray" />
                              <Text size="sm" c="dimmed">{formatDate(upload.uploadDate)}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {upload.fileSize ? formatSize(upload.fileSize) : 'Unknown'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="indigo" size="sm">
                              {(upload.recordCount || 0).toLocaleString()} rows
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={fmt.color} variant="light" size="sm">
                              {fmt.label}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={sts.color}
                              variant="dot"
                              size="sm"
                            >
                              {sts.label}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" justify="flex-end">
                              {(upload.detectedFormat === 'party_report') && (
                                <Tooltip label="View Analytics">
                                  <ActionIcon 
                                    variant="subtle" 
                                    color="violet"
                                    onClick={() => navigate(`/history/${upload.id}`)}
                                  >
                                    <IconEye size={18} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                              <Menu shadow="md" position="bottom-end">
                                <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray">
                                    <IconDotsVertical size={18} />
                                  </ActionIcon>
                                </Menu.Target>
                                  <Menu.Dropdown>
                                    <Menu.Item
                                      leftSection={<IconDownload size={16} />}
                                      onClick={() => handleDownload(upload.id, upload.fileName)}
                                    >
                                      Download
                                    </Menu.Item>
                                    {upload.detectedFormat === 'party_report' && (
                                      <Menu.Item
                                        leftSection={<IconChartBar size={16} />}
                                        onClick={() => navigate(`/history/${upload.id}`)}
                                      >
                                        View Analytics
                                      </Menu.Item>
                                    )}
                                    {['ERROR_EMPTY', 'ERROR_UNKNOWN_FORMAT', 'ERROR'].includes(upload.status) && (
                                      <Menu.Item
                                        leftSection={<IconRefresh size={16} />}
                                        color="orange"
                                        onClick={() => handleReprocess(upload.id)}
                                      >
                                        Reprocess File
                                      </Menu.Item>
                                    )}
                                    <Menu.Divider />
                                    <Menu.Item
                                      color="red"
                                      leftSection={<IconTrash size={16} />}
                                      onClick={() => handleDelete(upload.id)}
                                    >
                                      Delete
                                    </Menu.Item>
                                  </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Table.Td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </Table.Tbody>
              )}
            </Table>
          </ScrollArea>
        </Card>
      )}
      </div>
      </div>
    </div>
  );
}
