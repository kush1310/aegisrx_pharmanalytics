import { useEffect, useState } from 'react';
import {
  Card,
  Text,
  Group,
  Stack,
  Button,
  Badge
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
  IconTrash
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { exportToCSV } from '@/utils/export';
import PageHeader from '@/components/PageHeader';

const MotionDiv = motion.create('div' as any);

export default function Notifications() {
  const { notifications, fetchNotifications, fetchStats, hasLoadedNotifications } = useAppStore();
  const [filter, setFilter] = useState<string>('all');
  const [localLoading, setLocalLoading] = useState(!hasLoadedNotifications);
  const [isSubsequentLoading, setIsSubsequentLoading] = useState(false);

  useEffect(() => {
    if (!hasLoadedNotifications) {
      setLocalLoading(true);
      const startTime = Date.now();
      fetchNotifications().then(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          setLocalLoading(false);
        }, remaining);
      });
    } else {
      setLocalLoading(false);
      setIsSubsequentLoading(true);
      fetchNotifications().finally(() => {
        setIsSubsequentLoading(false);
      });
    }
  }, [fetchNotifications, hasLoadedNotifications]);

  const handleCheckEvents = async () => {
    try {
      const result = await api.post('/api/notifications/check-events', {});
      if (result.success) {
        mantineNotifications.show({
          title: 'Events Checked',
          message: 'Birthday and anniversary events have been checked',
          color: 'green'
        });
        fetchNotifications();
        fetchStats();
      }
    } catch (error) {
      mantineNotifications.show({
        title: 'Error',
        message: 'Failed to check events',
        color: 'red'
      });
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const result = await api.patch(`/api/notifications/${id}/read`);
      if (result.success) {
        fetchNotifications();
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      for (const n of unread) {
        await api.patch(`/api/notifications/${n.id}/read`);
      }
      mantineNotifications.show({
        title: 'All Marked as Read',
        message: `${unread.length} notifications marked as read`,
        color: 'green'
      });
      fetchNotifications();
      fetchStats();
    } catch (error) {
      mantineNotifications.show({
        title: 'Error',
        message: 'Failed to mark all as read',
        color: 'red'
      });
    }
  };

  const handleClearAll = async () => {
    modals.openConfirmModal({
      title: 'Clear All Notifications',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete all notifications? This action will clear all records from the database and cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Clear All', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await api.delete('/api/notifications');
          if (result.success) {
            mantineNotifications.show({
              title: 'Notifications Cleared',
              message: 'All notifications have been removed',
              color: 'green'
            });
            fetchNotifications();
            fetchStats();
          } else {
            throw new Error(result.error);
          }
        } catch (error: any) {
          mantineNotifications.show({
            title: 'Error',
            message: error.message || 'Failed to clear notifications',
            color: 'red'
          });
        }
      }
    });
  };

  // Safe emoji stripping utility
  const stripEmojis = (str: string): string => {
    if (!str) return '';
    return str.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'birthday') return n.eventType === 'BIRTHDAY';
    if (filter === 'anniversary') return n.eventType === 'ANNIVERSARY';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
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
              className="border border-teal-100 hover:bg-teal-50"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                const csvData = filteredNotifications.map(n => ({
                  'Title': stripEmojis(n.title),
                  'Message': stripEmojis(n.message),
                  'Type': n.eventType,
                  'Event Date': new Date(n.eventDate).toLocaleDateString('en-IN'),
                  'Status': n.isRead ? 'Read' : 'Unread'
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
              className="border border-indigo-100 hover:bg-indigo-50"
              leftSection={<IconRefresh size={16} />}
              onClick={handleCheckEvents}
            >
              Check Events
            </Button>
            {notifications.length > 0 && (
              <Button
                variant="light"
                color="red"
                className="border border-red-100 hover:bg-red-50"
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

      {/* Filters (Segmented Control replaced by Premium Tab Bar) */}
      <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 mb-6 max-w-md mt-4">
        {[
          { label: 'All', value: 'all' },
          { label: 'Unread', value: 'unread' },
          { label: 'Birthdays', value: 'birthday' },
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
        <Card shadow="sm" radius="lg" p="xl" className="border-2 border-dashed border-slate-200/60 bg-slate-50/40 text-center py-16 flex flex-col items-center justify-center">
          <Stack align="center" gap="md">
            <IconBell size={64} stroke={1} className="text-slate-300 stroke-1 animate-float" />
            <Text size="lg" fw={800} className="text-slate-700">No notifications</Text>
            <Text c="dimmed" size="sm" className="text-slate-400 max-w-xs">
              {filter === 'unread' ? 'All caught up! No unread reminders.' : 'Birthday and anniversary reminders will appear here.'}
            </Text>
            <Button 
              variant="light"
              color="indigo"
              leftSection={<IconRefresh size={16} />}
              onClick={handleCheckEvents}
              className="mt-2"
            >
              Check for Events
            </Button>
          </Stack>
        </Card>
      ) : (
        <AnimatePresence>
          <Stack gap="md">
            {filteredNotifications.map((notification, index) => {
              const color = notification.eventType === 'BIRTHDAY' ? 'indigo' : 'pink';
              const cleanTitle = stripEmojis(notification.title);
              const cleanMessage = stripEmojis(notification.message);

              return (
                <MotionDiv
                  key={notification.id}
                  className={`border bg-white rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 flex items-start justify-between gap-4 relative overflow-hidden ${
                    !notification.isRead 
                      ? 'border-indigo-200/60 bg-gradient-to-r from-indigo-50/10 via-white/80 to-white/80 border-l-4 border-l-indigo-500' 
                      : 'border-slate-200/60'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Group align="flex-start" className="flex-1" wrap="nowrap">
                    <div 
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        notification.eventType === 'BIRTHDAY'
                          ? 'bg-purple-100/70 text-purple-600'
                          : 'bg-pink-100/70 text-pink-600'
                      }`}
                    >
                      {notification.eventType === 'BIRTHDAY' ? (
                        <IconGift size={22} className="animate-pulse" />
                      ) : (
                        <IconHeart size={22} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Group gap="xs" wrap="nowrap" align="center" className="mb-1">
                        <Text fw={800} className="text-slate-800 text-sm font-extrabold truncate">{cleanTitle}</Text>
                        <Badge size="xs" color={color} className="font-bold shrink-0">
                          {notification.eventType}
                        </Badge>
                        {!notification.isRead && (
                          <Badge size="xs" color="blue" variant="filled" className="font-bold shrink-0">NEW</Badge>
                        )}
                      </Group>
                      <Text size="sm" c="dimmed" className="text-slate-500 font-medium leading-relaxed">
                        {cleanMessage}
                      </Text>
                      <Text size="xs" c="dimmed" className="text-slate-400 font-semibold mt-2">
                        Event Date: {formatDate(notification.eventDate)} • {getTimeAgo(notification.createdAt)}
                      </Text>
                    </div>
                  </Group>
                  
                  {!notification.isRead && (
                    <Button
                      variant="light"
                      color="indigo"
                      size="xs"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="shrink-0 h-8 text-[11px] font-semibold active:scale-95 transition-transform"
                    >
                      Mark Read
                    </Button>
                  )}
                </MotionDiv>
              );
            })}
          </Stack>
        </AnimatePresence>
      )}
        </div>
      </div>
    </div>
  );
}
