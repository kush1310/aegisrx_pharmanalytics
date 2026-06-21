import { useEffect, useState } from 'react';
import {
  Text,
  Group,
  Stack,
  Button,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  Loader,
  Table
} from '@mantine/core';
import { modals } from '@mantine/modals';
import GlobalLoadingOverlay from '../components/GlobalLoadingOverlay';
import { NotificationSkeletonStack } from '../components/SkeletonLoaders';
import { notifications as mantineNotifications } from '@mantine/notifications';
import {
  IconBell,
  IconCheck,
  IconGift,
  IconHeart,
  IconRefresh,
  IconDownload,
  IconTrash,
  IconX,
  IconStethoscope,
  IconBuildingStore,
  IconArrowBackUp,
  IconPill,
  IconCalendar
} from '@tabler/icons-react';
import { useAppStore } from '@/stores/appStore';
import type { Notification } from '@/types';
import { api } from '@/lib/api';
import { exportListToExcel } from '@/utils/export';
import PageHeader from '@/components/PageHeader';
import ElectroBorder from '@/components/ElectroBorder';
import styles from './Notifications.module.css';

export default function Notifications() {
  const { notifications, fetchNotifications, fetchStats, hasLoadedNotifications } = useAppStore();
  const [filter, setFilter] = useState<string>('all');
  const [activeSection, setActiveSection] = useState<'active' | 'read' | 'cleared'>('active');
  const [localLoading, setLocalLoading] = useState(!hasLoadedNotifications);
  const [isSubsequentLoading, setIsSubsequentLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Date Profile Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedNotifForModal, setSelectedNotifForModal] = useState<Notification | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);

  useEffect(() => {
    if (!hasLoadedNotifications) {
      setLocalLoading(true);
      const startTime = Date.now();
      fetchNotifications().then(() => {
        const elapsed   = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => setLocalLoading(false), remaining);
      });
    } else {
      setLocalLoading(false);
      setIsSubsequentLoading(true);
      fetchNotifications().finally(() => setIsSubsequentLoading(false));
    }
  }, [fetchNotifications, hasLoadedNotifications]);

  /**
   * handleCheckEvents
   *
   * Triggers the backend check-events logic to delete stale unread notifications
   * and dynamically regenerate upcoming birthday and anniversary events. Displays
   * a loading state during execution and refreshes store notification lists and stats.
   *
   * @param  None
   * @returns {Promise<void>} - Resolves when the check process finishes and state is refreshed.
   * @validates - None.
   * @redirects - None.
   * @edge-cases - Handles API failures gracefully by dismissing the loader and displaying a red notification toast.
   */
  const handleCheckEvents = async () => {
    setIsSubsequentLoading(true);
    try {
      const result = await api.post('/api/notifications/check-events', {});
      if (result.success) {
        mantineNotifications.show({ title: 'Events Checked', message: 'Birthday and anniversary events have been checked', color: 'green' });
        await Promise.all([fetchNotifications(), fetchStats()]);
      }
    } catch {
      mantineNotifications.show({ title: 'Error', message: 'Failed to check events', color: 'red' });
    } finally {
      setIsSubsequentLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const result = await api.patch(`/api/notifications/${id}/read`);
      if (result.success) { fetchNotifications(); fetchStats(); }
    } catch { /* silent */ }
  };

  const handleMarkAsUnread = async (id: number) => {
    try {
      const result = await api.patch(`/api/notifications/${id}/unread`);
      if (result.success) {
        fetchNotifications();
        fetchStats();
        mantineNotifications.show({ title: 'Marked Unread', message: 'Notification restored to Active reminders', color: 'indigo' });
      }
    } catch {
      mantineNotifications.show({ title: 'Error', message: 'Failed to mark as unread', color: 'red' });
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const result = await api.patch(`/api/notifications/${id}/restore`);
      if (result.success) {
        fetchNotifications();
        fetchStats();
        mantineNotifications.show({ title: 'Restored', message: 'Notification restored successfully', color: 'green' });
      }
    } catch {
      mantineNotifications.show({ title: 'Error', message: 'Failed to restore notification', color: 'red' });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead && !n.isCleared);
      for (const n of unread) await api.patch(`/api/notifications/${n.id}/read`);
      mantineNotifications.show({
        title:   'All Marked as Read',
        message: `${unread.length} notifications marked as read`,
        color:   'green'
      });
      fetchNotifications();
      fetchStats();
    } catch {
      mantineNotifications.show({ title: 'Error', message: 'Failed to mark all as read', color: 'red' });
    }
  };

  const handleDeleteOne = async (id: number) => {
    setDeletingId(id);
    try {
      const result = await api.delete(`/api/notifications/${id}`);
      if (result.success) {
        fetchNotifications();
        fetchStats();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      mantineNotifications.show({ title: 'Error', message: error.message || 'Failed to clear notification', color: 'red' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    modals.openConfirmModal({
      title:    'Clear All Notifications',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure? All reminders in this section will be moved to the Recently Cleared list.
        </Text>
      ),
      labels:       { confirm: 'Clear All', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete('/api/notifications');
          if (result.success) {
            mantineNotifications.show({ title: 'Notifications Cleared', message: 'All notifications cleared', color: 'green' });
            fetchNotifications();
            fetchStats();
          } else {
            throw new Error(result.error);
          }
        } catch (error: any) {
          mantineNotifications.show({ title: 'Error', message: error.message || 'Failed to clear notifications', color: 'red' });
        }
      }
    });
  };

  /**
   * handleCardClick
   *
   * Opens the date profile glassmorphism modal for a given notification entity.
   * Guards against null/undefined entityId and unexpected entity types before
   * dispatching the API request. Closes the modal gracefully on any failure
   * to prevent the Electron renderer from entering a broken state.
   *
   * @param  {Notification} n - The notification record whose date profile to display.
   * @returns {Promise<void>}
   * @edge-cases - Missing entityId closes modal immediately with toast.
   *            - API 404 or network error closes modal and shows error toast.
   *            - Unexpected entityType closes modal with error toast.
   */
  const handleCardClick = async (n: Notification) => {
    if (!n.entityId) {
      mantineNotifications.show({ title: 'No details available', message: 'This notification has no linked profile.', color: 'orange' });
      return;
    }
    setSelectedNotifForModal(n);
    setModalLoading(true);
    setDetailModalOpen(true);
    setDetailData(null);
    try {
      let res: any;
      if (n.entityType === 'DOCTOR') {
        res = await api.get<any>(`/api/doctors/${n.entityId}`);
      } else if (n.entityType === 'PHARMACY_OWNER') {
        res = await api.get<any>(`/api/pharmacies/${n.entityId}`);
      } else {
        throw new Error(`Unsupported entity type: ${n.entityType}`);
      }

      if (res && res.success && res.data) {
        setDetailData(res.data);
      } else {
        throw new Error((res && res.error) ? res.error : 'Failed to load profile details');
      }
    } catch (err: any) {
      console.error('[handleCardClick]', err);
      setDetailModalOpen(false);
      setDetailData(null);
      setSelectedNotifForModal(null);
      mantineNotifications.show({
        title: 'Profile Load Failed',
        message: err.message || 'Could not fetch date profile. Please try again.',
        color: 'red'
      });
    } finally {
      setModalLoading(false);
    }
  };

  const stripEmojis = (str: string): string => {
    if (!str) return '';
    return str.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
  };

  const formatDisplayDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    }
    return dateStr;
  };

  const today = new Date();
  const formatLocal = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr = formatLocal(today);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = formatLocal(tomorrow);

  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);
  const dayAfterStr = formatLocal(dayAfter);

  // Group notifications into tabs
  const activeCount = notifications.filter(n => !n.isCleared && !n.isRead).length;
  const readCount   = notifications.filter(n => !n.isCleared && n.isRead).length;
  const clearedCount = notifications.filter(n => n.isCleared).length;

  const displayedForSection = notifications.filter(n => {
    if (activeSection === 'active') return !n.isCleared && !n.isRead;
    if (activeSection === 'read') return !n.isCleared && n.isRead;
    return n.isCleared; // activeSection === 'cleared'
  });

  const filteredNotifications = displayedForSection.filter(n => {
    const eventTypeUpper = (n.eventType || '').toUpperCase();
    const isBday = eventTypeUpper === 'BIRTHDAY' || eventTypeUpper === 'SPOUSE_BIRTHDAY' || eventTypeUpper.startsWith('CHILD_BIRTHDAY');
    const isAnniv = eventTypeUpper === 'ANNIVERSARY';

    if (filter === 'today') {
      return n.eventDate === todayStr;
    }
    if (filter === 'tomorrow') {
      return n.eventDate === tomorrowStr;
    }
    if (filter === 'dayAfter') {
      return n.eventDate === dayAfterStr;
    }
    if (filter === 'birthday') {
      return isBday;
    }
    if (filter === 'anniversary') {
      return isAnniv;
    }
    return true; // filter === 'all'
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const getTimeAgo = (dateStr: string) => {
    const diffMs    = Date.now() - new Date(dateStr).getTime();
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays  = Math.floor(diffHours / 24);
    if (diffMins  < 1)  return 'Just now';
    if (diffMins  < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays  < 7)  return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  return (
    <div className="max-w-5xl mx-auto py-6 animate-fade-in">
      <PageHeader
        title="Notifications"
        subtitle={activeCount > 0 ? `${activeCount} unread active reminder${activeCount !== 1 ? 's' : ''}` : 'All caught up!'}
        onRefresh={fetchNotifications}
        refreshing={localLoading}
        action={
          <Group>
            <Button
              variant="light"
              color="teal"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                const exportData = filteredNotifications.map(n => ({
                  title:      stripEmojis(n.title),
                  message:    stripEmojis(n.message),
                  type:       n.eventType || '',
                  eventDate:  new Date(n.eventDate).toLocaleDateString('en-IN'),
                  status:     n.isCleared ? 'Cleared' : (n.isRead ? 'Read' : 'Unread')
                }));
                exportListToExcel(
                  exportData,
                  `notifications_${new Date().toISOString().split('T')[0]}`,
                  ['Title', 'Message', 'Type', 'Event Date', 'Status'],
                  ['title', 'message', 'type', 'eventDate', 'status'],
                  'Notifications'
                );
              }}
              disabled={filteredNotifications.length === 0}
            >
              Export Excel
            </Button>
            <Button
              variant="light"
              color="indigo"
              leftSection={<IconRefresh size={16} />}
              onClick={handleCheckEvents}
            >
              Check Events
            </Button>
            {displayedForSection.length > 0 && activeSection !== 'cleared' && (
              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            )}
            {activeCount > 0 && activeSection === 'active' && (
              <Button
                variant="subtle"
                color="indigo"
                leftSection={<IconCheck size={16} />}
                onClick={handleMarkAllAsRead}
              >
                Mark All Read
              </Button>
            )}
          </Group>
        }
      />

      <GlobalLoadingOverlay visible={localLoading} message="Loading notifications..." />

      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className={localLoading ? 'pointer-events-none select-none opacity-50 transition-all duration-300' : 'transition-all duration-300'}>

          {/* Section Tab Switcher (Active / Read / Cleared) */}
          <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/30 mb-4 max-w-lg">
            {[
              { label: 'Active Reminders', value: 'active', count: activeCount, color: 'blue' },
              { label: 'Marked as Read',   value: 'read',   count: readCount,   color: 'gray' },
              { label: 'Recently Cleared', value: 'cleared', count: clearedCount, color: 'red' }
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveSection(tab.value as any);
                  setFilter('all');
                }}
                className={`flex-1 text-center py-2.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex justify-center items-center gap-1.5 ${
                  activeSection === tab.value
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/20'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <Badge size="xs" color={tab.color} variant={activeSection === tab.value ? 'filled' : 'light'} className="font-bold">
                    {tab.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Filter Tab Bar */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 mb-6 max-w-2xl mt-4">
            {[
              { label: 'All',                value: 'all' },
              { label: 'Today',              value: 'today' },
              { label: 'Tomorrow',           value: 'tomorrow' },
              { label: 'Day After Tomorrow', value: 'dayAfter' },
              { label: 'Birthdays',          value: 'birthday' },
              { label: 'Anniversaries',      value: 'anniversary' }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`flex-1 text-center py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  filter === opt.value
                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/20'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isSubsequentLoading ? (
            <NotificationSkeletonStack count={5} />
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className={styles.emptyIcon}>
                <IconBell size={40} stroke={1.5} />
              </div>
              <Text size="lg" fw={800} className="text-slate-700 mt-5">No reminders found</Text>
              <Text c="dimmed" size="sm" className="text-slate-400 max-w-xs mt-2">
                There are no reminders matching your current filter in this section.
              </Text>
              {activeSection === 'active' && (
                <Button
                  variant="light"
                  color="indigo"
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleCheckEvents}
                  className="mt-5"
                >
                  Check for Events
                </Button>
              )}
            </div>
          ) : (
            <Stack gap="sm">
              {filteredNotifications.map((notification, index) => {
                const type = notification.eventType || '';
                const isBirthday = type === 'BIRTHDAY' || type === 'SPOUSE_BIRTHDAY' || type.startsWith('CHILD_BIRTHDAY');
                const cleanTitle   = stripEmojis(notification.title);
                const cleanMessage = stripEmojis(notification.message);
                const isDeleting   = deletingId === notification.id;

                return (
                  <ElectroBorder
                    key={notification.id}
                    borderColor={(notification.isRead || notification.isCleared) ? 'rgba(0, 0, 0, 0.08)' : (isBirthday ? '#8b5cf6' : '#ec4899')}
                    glow={!notification.isRead && !notification.isCleared}
                    aura={!notification.isRead && !notification.isCleared}
                    radius="16px"
                    className={`${styles.notifCardOuter} ${styles.notifCardAnimate}`}
                    style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                  >
                    <div
                      className={`${styles.notifCard} ${!notification.isRead ? styles.notifCardUnread : styles.notifCardRead}`}
                      onClick={() => handleCardClick(notification)}
                    >
                      {/* Icon */}
                      <div className={`${styles.eventIcon} ${isBirthday ? styles.iconBirthday : styles.iconAnniversary}`}>
                        {isBirthday ? <IconGift size={20} /> : <IconHeart size={20} />}
                      </div>

                      {/* Content */}
                      <div className={styles.notifContent}>
                        <Group gap="xs" wrap="nowrap" align="center" className="mb-1">
                          <Text fw={700} size="sm" className="text-slate-800 leading-tight" lineClamp={1}>
                            {cleanTitle}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={isBirthday ? 'violet' : 'pink'}
                            className="shrink-0 font-bold uppercase tracking-wider"
                          >
                            {type === 'SPOUSE_BIRTHDAY' ? 'SPOUSE BIRTHDAY' : 
                             type.startsWith('CHILD_BIRTHDAY') ? 'CHILD BIRTHDAY' : 
                             type}
                          </Badge>
                          {!notification.isRead && !notification.isCleared && (
                            <Badge size="xs" color="blue" variant="filled" className="shrink-0 font-bold">
                              NEW
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm" c="dimmed" className="text-slate-500 leading-relaxed" lineClamp={2}>
                          {cleanMessage}
                        </Text>
                        <Text size="xs" c="dimmed" className="text-slate-400 font-medium mt-1.5">
                          {formatDate(notification.eventDate)} &bull; {getTimeAgo(notification.createdAt)}
                        </Text>
                      </div>

                      {/* Action buttons */}
                      <div className={styles.notifActions} onClick={(e) => e.stopPropagation()}>
                        {activeSection === 'active' && (
                          <Tooltip label="Mark as read" position="left" withArrow>
                            <Button
                              variant="subtle"
                              color="indigo"
                              size="xs"
                              leftSection={<IconCheck size={13} />}
                              onClick={() => handleMarkAsRead(notification.id)}
                              className={styles.markReadBtn}
                            >
                              Mark Read
                            </Button>
                          </Tooltip>
                        )}
                        {activeSection === 'read' && (
                          <Tooltip label="Mark as unread" position="left" withArrow>
                            <Button
                              variant="subtle"
                              color="indigo"
                              size="xs"
                              leftSection={<IconArrowBackUp size={13} />}
                              onClick={() => handleMarkAsUnread(notification.id)}
                              className={styles.markReadBtn}
                            >
                              Mark Unread
                            </Button>
                          </Tooltip>
                        )}
                        {activeSection === 'cleared' && (
                          <Tooltip label="Restore reminder" position="left" withArrow>
                            <Button
                              variant="subtle"
                              color="teal"
                              size="xs"
                              leftSection={<IconArrowBackUp size={13} />}
                              onClick={() => handleRestore(notification.id)}
                              className={styles.markReadBtn}
                            >
                              Restore
                            </Button>
                          </Tooltip>
                        )}
                        {activeSection !== 'cleared' && (
                          <Tooltip label="Clear reminder" position="left" withArrow>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              loading={isDeleting}
                              onClick={() => handleDeleteOne(notification.id)}
                              className={styles.deleteBtn}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </ElectroBorder>
                );
              })}
            </Stack>
          )}
        </div>
      </div>

      {/* ── Date Profile Glassmorphic Modal ── */}
      <Modal
        opened={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailData(null);
          setSelectedNotifForModal(null);
        }}
        title={
          <Group gap="xs">
            {selectedNotifForModal?.entityType === 'DOCTOR' ? (
              <IconStethoscope size={18} className="text-indigo-600" />
            ) : (
              <IconBuildingStore size={18} className="text-amber-500" />
            )}
            <Text fw={800} size="md" className="text-slate-800">
              {selectedNotifForModal?.entityType === 'DOCTOR' ? 'Doctor Date Profile' : 'Pharmacy Date Profile'}
            </Text>
          </Group>
        }
        centered
        size="lg"
        radius="md"
        overlayProps={{
          backgroundOpacity: 0.4,
          blur: 6,
        }}
        styles={{
          content: {
            background: 'rgba(255, 255, 255, 0.72)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            boxShadow: '0 24px 48px -10px rgba(0, 0, 0, 0.1)',
            padding: 0,
            overflow: 'hidden',
          },
          header: {
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            padding: '24px 24px 14px 24px',
            margin: 0,
            zIndex: 10,
          },
          body: {
            padding: '12px 24px 24px 24px',
            maxHeight: '70vh',
            overflowY: 'auto',
          }
        }}
      >
        {modalLoading ? (
          <Group justify="center" py="xl">
            <Loader size="md" color="indigo" />
            <Text size="sm" c="dimmed">Fetching profiles details...</Text>
          </Group>
        ) : detailData ? (
          <Stack gap="md" mt="sm">
            {/* Header info card */}
            <div className="bg-white/40 p-4 rounded-xl border border-white/40">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" className="tracking-wider">Name</Text>
              <Text size="xl" fw={900} className="text-slate-800">
                {selectedNotifForModal?.entityType === 'DOCTOR'
                  ? (detailData.name || 'Unknown Doctor')
                  : (detailData.name || 'Unknown Pharmacy')}
              </Text>
              {selectedNotifForModal?.entityType === 'DOCTOR' && (
                <Text size="xs" fw={600} className="text-indigo-600 uppercase tracking-widest mt-1">
                  {detailData.specialization} &bull; {detailData.qualification}
                </Text>
              )}
              {selectedNotifForModal?.entityType === 'PHARMACY_OWNER' && (
                <Text size="xs" fw={600} className="text-amber-600 uppercase tracking-widest mt-1">
                  Owner: {detailData.ownerName}
                </Text>
              )}
            </div>

            {/* Timelines and Dates */}
            <Text fw={800} size="sm" className="border-b border-slate-100 pb-1 mt-1 text-slate-700">IMPORTANT DATES</Text>
            
            <div className="overflow-hidden border border-slate-200/40 rounded-xl bg-white/40">
              <Table verticalSpacing="xs">
                <Table.Tbody>
                  {/* Entity DOB */}
                  {selectedNotifForModal?.entityType === 'DOCTOR' ? (
                    <Table.Tr>
                      <Table.Td width={50}>
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <IconCalendar size={16} />
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={700} className="text-slate-700">Doctor's Birth Date (DOB)</Text>
                        <Text size="xs" c="dimmed">Dr. {detailData.name}'s Birthday</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Badge color="indigo" size="md" variant="light" className="font-bold">
                          {formatDisplayDate(detailData.birthDate)}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    <Table.Tr>
                      <Table.Td width={50}>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                          <IconCalendar size={16} />
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={700} className="text-slate-700">Owner's Birth Date (DOB)</Text>
                        <Text size="xs" c="dimmed">Owner {detailData.ownerName}'s Birthday</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Badge color="yellow" size="md" variant="light" className="font-bold">
                          {formatDisplayDate(detailData.ownerBirthDate)}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  )}

                  {/* Doctor Marriage Anniversary */}
                  {selectedNotifForModal?.entityType === 'DOCTOR' && detailData.isMarried && (
                    <Table.Tr>
                      <Table.Td>
                        <div className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
                          <IconHeart size={16} />
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={700} className="text-slate-700">Wedding Anniversary</Text>
                        <Text size="xs" c="dimmed">Married to {detailData.spouseName}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Badge color="pink" size="md" variant="light" className="font-bold">
                          {formatDisplayDate(detailData.anniversary)}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  )}

                  {/* Spouse DOB */}
                  {selectedNotifForModal?.entityType === 'DOCTOR' && detailData.isMarried && detailData.spouseBirthDate && (
                    <Table.Tr>
                      <Table.Td>
                        <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                          <IconGift size={16} />
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={700} className="text-slate-700">Spouse Birth Date (DOB)</Text>
                        <Text size="xs" c="dimmed">{detailData.spouseName}'s Birthday</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Badge color="violet" size="md" variant="light" className="font-bold">
                          {formatDisplayDate(detailData.spouseBirthDate)}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  )}

                  {/* Pharmacy opening date */}
                  {selectedNotifForModal?.entityType === 'PHARMACY_OWNER' && (
                    <Table.Tr>
                      <Table.Td>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <IconBuildingStore size={16} />
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={700} className="text-slate-700">Pharmacy Opening Date</Text>
                        <Text size="xs" c="dimmed">Registration timestamp in system</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Badge color="teal" size="md" variant="light" className="font-bold">
                          {formatDisplayDate(detailData.createdAt?.split(' ')[0])}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </div>

            {/* Children Birthdays (if Doctor) */}
            {selectedNotifForModal?.entityType === 'DOCTOR' && detailData.childrenCount > 0 && (() => {
              try {
                const kids = JSON.parse(detailData.childrenNames || '[]');
                if (Array.isArray(kids) && kids.length > 0) {
                  return (
                    <>
                      <Text fw={800} size="sm" className="border-b border-slate-100 pb-1 mt-2 text-slate-700">CHILDREN'S DATES</Text>
                      <div className="overflow-hidden border border-slate-200/40 rounded-xl bg-white/40">
                        <Table verticalSpacing="xs">
                          <Table.Tbody>
                            {kids.map((kid: any, kIdx: number) => (
                              <Table.Tr key={`kid-${kIdx}`}>
                                <Table.Td width={50}>
                                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs">
                                    {kIdx + 1}
                                  </div>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" fw={700} className="text-slate-700">{kid.name?.toUpperCase()}</Text>
                                  <Text size="xs" c="dimmed">Child of Dr. {detailData.name}</Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Badge color="teal" size="md" variant="light" className="font-bold">
                                    {formatDisplayDate(kid.birthDate)}
                                  </Badge>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </div>
                    </>
                  );
                }
                return null;
              } catch {
                return null;
              }
            })()}

            {/* Linked Pharmacies/Hospitals for Doctor */}
            {selectedNotifForModal?.entityType === 'DOCTOR' && detailData.pharmacies && detailData.pharmacies.length > 0 && (
              <>
                <Text fw={800} size="sm" className="border-b border-slate-100 pb-1 mt-2 text-slate-700">ASSOCIATED PHARMACIES & HOSPITALS</Text>
                <div className="overflow-hidden border border-slate-200/40 rounded-xl bg-white/40">
                  <Table verticalSpacing="xs">
                    <Table.Tbody>
                      {detailData.pharmacies.map((pharm: any) => (
                        <Table.Tr key={`pharm-${pharm.id}`}>
                          <Table.Td width={50}>
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                              <IconPill size={16} />
                            </div>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={700} className="text-slate-700">{pharm.name}</Text>
                            <Text size="xs" c="dimmed">Owner: {pharm.ownerName} &bull; Contact: {pharm.contact}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" fw={600} c="dimmed" className="mb-0.5">Opening Date</Text>
                            <Badge color="gray" size="sm" variant="outline" className="font-bold">
                              {formatDisplayDate(pharm.createdAt?.split(' ')[0])}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              </>
            )}

            {/* Linked Doctor for Pharmacy */}
            {selectedNotifForModal?.entityType === 'PHARMACY_OWNER' && detailData.doctor && (
              <>
                <Text fw={800} size="sm" className="border-b border-slate-100 pb-1 mt-2 text-slate-700">LINKED PRESCRIBING DOCTOR</Text>
                <div className="overflow-hidden border border-slate-200/40 rounded-xl bg-white/40">
                  <Table verticalSpacing="xs">
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td width={50}>
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <IconStethoscope size={16} />
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={700} className="text-slate-700">{detailData.doctor.name}</Text>
                          <Text size="xs" c="dimmed">{detailData.doctor.specialization} &bull; {detailData.doctor.qualification}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <div className="flex flex-col items-end gap-1">
                            <Badge color="indigo" size="xs" variant="light" className="font-bold">
                              DOB: {formatDisplayDate(detailData.doctor.birthDate)}
                            </Badge>
                            {detailData.doctor.isMarried && (
                              <Badge color="pink" size="xs" variant="light" className="font-bold">
                                Anniv: {formatDisplayDate(detailData.doctor.anniversary)}
                              </Badge>
                            )}
                          </div>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </div>
              </>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed" py="xl" ta="center">Could not retrieve date profile information.</Text>
        )}
      </Modal>
    </div>
  );
}
