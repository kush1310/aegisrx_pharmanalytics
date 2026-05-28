import { useEffect, useState } from 'react';
import {
  Text,
  Group,
  Stack,
  Button,
  Badge,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { modals } from '@mantine/modals';
import PageLoader from '../components/PageLoader';
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
  IconX
} from '@tabler/icons-react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { exportToCSV } from '@/utils/export';
import PageHeader from '@/components/PageHeader';
import styles from './Notifications.module.css';

export default function Notifications() {
  const { notifications, fetchNotifications, fetchStats, hasLoadedNotifications } = useAppStore();
  const [filter, setFilter] = useState<string>('all');
  const [localLoading, setLocalLoading] = useState(!hasLoadedNotifications);
  const [isSubsequentLoading, setIsSubsequentLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleCheckEvents = async () => {
    try {
      const result = await api.post('/api/notifications/check-events', {});
      if (result.success) {
        mantineNotifications.show({ title: 'Events Checked', message: 'Birthday and anniversary events have been checked', color: 'green' });
        fetchNotifications();
        fetchStats();
      }
    } catch {
      mantineNotifications.show({ title: 'Error', message: 'Failed to check events', color: 'red' });
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const result = await api.patch(`/api/notifications/${id}/read`);
      if (result.success) { fetchNotifications(); fetchStats(); }
    } catch { /* silent */ }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
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

  /**
   * handleDeleteOne — deletes a single notification and writes a persistent tombstone.
   * The backend will INSERT a DismissedNotification row before deleting the Notification row,
   * preventing the same push notification from reappearing after the next app restart.
   *
   * @param id   - Notification row PK.
   * @param name - Display name for the toast message.
   */
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
      mantineNotifications.show({ title: 'Error', message: error.message || 'Failed to delete notification', color: 'red' });
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * handleClearAll — writes a tombstone for every current notification THEN bulk-deletes them.
   * After this, checkEventsLogic on next startup will skip all of today's dismissed events.
   */
  const handleClearAll = async () => {
    modals.openConfirmModal({
      title:    'Clear All Notifications',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure? All notifications will be permanently cleared. The same events will
          NOT reappear as push notifications, even after restarting the application.
        </Text>
      ),
      labels:       { confirm: 'Clear All', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete('/api/notifications');
          if (result.success) {
            mantineNotifications.show({ title: 'Notifications Cleared', message: 'All notifications removed and suppressed', color: 'green' });
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

  const stripEmojis = (str: string): string => {
    if (!str) return '';
    return str.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread')      return !n.isRead;
    if (filter === 'birthday')    return n.eventType === 'BIRTHDAY';
    if (filter === 'anniversary') return n.eventType === 'ANNIVERSARY';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

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
        subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All notifications read'}
        onRefresh={fetchNotifications}
        refreshing={localLoading}
        action={
          <Group>
            <Button
              variant="light"
              color="teal"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                const csvData = filteredNotifications.map(n => ({
                  'Title':      stripEmojis(n.title),
                  'Message':    stripEmojis(n.message),
                  'Type':       n.eventType,
                  'Event Date': new Date(n.eventDate).toLocaleDateString('en-IN'),
                  'Status':     n.isRead ? 'Read' : 'Unread'
                }));
                exportToCSV(csvData, `notifications_${new Date().toISOString().split('T')[0]}`, ['Title', 'Message', 'Type', 'Event Date', 'Status']);
              }}
              disabled={filteredNotifications.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="light"
              color="indigo"
              leftSection={<IconRefresh size={16} />}
              onClick={handleCheckEvents}
            >
              Check Events
            </Button>
            {notifications.length > 0 && (
              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            )}
            {unreadCount > 0 && (
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

      <div className="relative mt-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {localLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-2xl transition-all duration-300">
            <PageLoader message="Loading notifications..." />
          </div>
        )}
        <div className={localLoading ? 'blur-[3px] pointer-events-none select-none transition-all duration-300' : 'transition-all duration-300'}>

          {/* Filter Tab Bar */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 mb-6 max-w-md mt-4">
            {[
              { label: 'All',           value: 'all' },
              { label: 'Unread',        value: 'unread' },
              { label: 'Birthdays',     value: 'birthday' },
              { label: 'Anniversaries', value: 'anniversary' }
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
              <Text size="lg" fw={800} className="text-slate-700 mt-5">No notifications</Text>
              <Text c="dimmed" size="sm" className="text-slate-400 max-w-xs mt-2">
                {filter === 'unread' ? 'All caught up! No unread reminders.' : 'Birthday and anniversary reminders will appear here.'}
              </Text>
              <Button
                variant="light"
                color="indigo"
                leftSection={<IconRefresh size={16} />}
                onClick={handleCheckEvents}
                className="mt-5"
              >
                Check for Events
              </Button>
            </div>
          ) : (
            <Stack gap="sm">
              {filteredNotifications.map((notification, index) => {
                const isBirthday = notification.eventType === 'BIRTHDAY';
                const cleanTitle   = stripEmojis(notification.title);
                const cleanMessage = stripEmojis(notification.message);
                const isDeleting   = deletingId === notification.id;

                return (
                  <div
                    key={notification.id}
                    className={`${styles.notifCard} ${!notification.isRead ? styles.notifCardUnread : styles.notifCardRead} ${styles.notifCardAnimate}`}
                    style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
                  >
                    {/* Coloured left accent stripe for unread */}
                    {!notification.isRead && (
                      <div className={`${styles.accentStripe} ${isBirthday ? styles.accentBirthday : styles.accentAnniversary}`} />
                    )}

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
                          {notification.eventType}
                        </Badge>
                        {!notification.isRead && (
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
                    <div className={styles.notifActions}>
                      {!notification.isRead && (
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
                      <Tooltip label="Delete and suppress" position="left" withArrow>
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
                    </div>
                  </div>
                );
              })}
            </Stack>
          )}
        </div>
      </div>
    </div>
  );
}
