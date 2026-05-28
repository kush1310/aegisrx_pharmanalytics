import { useEffect, useState } from 'react';
import {
  Card,
  Text,
  Group,
  Stack,
  Button,
  ActionIcon,
  Badge,
  Paper,
  Skeleton,
  SegmentedControl
} from '@mantine/core';
import { notifications as mantineNotifications } from '@mantine/notifications';
import {
  IconBell,
  IconCheck,
  IconGift,
  IconHeart,
  IconRefresh,
  IconDownload
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/lib/api';
import { exportToCSV } from '@/utils/export';
import PageHeader from '@/components/PageHeader';
import styles from './Notifications.module.css';

// Type assertion to fix framer-motion + Mantine polymorphic component issue
const MotionPaper = motion(Paper as any);

export default function Notifications() {
  const { notifications, isLoadingNotifications, fetchNotifications, fetchStats } = useAppStore();
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
      // Mark each unread notification as read
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

  const getEventIcon = (eventType: string) => {
    return eventType === 'BIRTHDAY' ? IconGift : IconHeart;
  };

  const getEventColor = (eventType: string) => {
    return eventType === 'BIRTHDAY' ? 'grape' : 'pink';
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      {/* Header */}
      <PageHeader 
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All notifications read'}
        onRefresh={fetchNotifications}
        refreshing={isLoadingNotifications}
        action={
          <Group>
            <Button
              variant="light"
              color="teal"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                const csvData = filteredNotifications.map(n => ({
                  'Title': n.title,
                  'Message': n.message,
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
              leftSection={<IconRefresh size={16} />}
              onClick={handleCheckEvents}
            >
              Check Events
            </Button>
            {unreadCount > 0 && (
              <Button 
                variant="subtle" 
                leftSection={<IconCheck size={16} />}
                onClick={handleMarkAllAsRead}
              >
                Mark All Read
              </Button>
            )}
          </Group>
        }
      />

      {/* Filters */}
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        mb="lg"
        data={[
          { label: 'All', value: 'all' },
          { label: 'Unread', value: 'unread' },
          { label: 'Birthdays', value: 'birthday' },
          { label: 'Anniversaries', value: 'anniversary' }
        ]}
      />

      {/* Notifications List */}
      {isLoadingNotifications ? (
        <Stack gap="md">
          {[...Array(5)].map((_, i) => (
            <Card key={i} shadow="xs" radius="md" p="md">
              <Group>
                <Skeleton circle height={48} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={18} width="50%" mb="xs" />
                  <Skeleton height={14} width="80%" />
                </div>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : filteredNotifications.length === 0 ? (
        <Card shadow="sm" radius="lg" p="xl" className={styles.emptyState}>
          <Stack align="center" gap="md">
            <IconBell size={64} stroke={1} color="var(--color-text-muted)" />
            <Text size="lg" fw={800}>No notifications</Text>
            <Text c="dimmed" size="sm" ta="center">
              {filter === 'unread' ? 'All caught up!' : 'Birthday and anniversary reminders will appear here'}
            </Text>
            <Button 
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={handleCheckEvents}
            >
              Check for Events
            </Button>
          </Stack>
        </Card>
      ) : (
        <AnimatePresence>
          <Stack gap="md">
            {filteredNotifications.map((notification, index) => {
              const Icon = getEventIcon(notification.eventType);
              const color = getEventColor(notification.eventType);
              
              return (
                <MotionPaper
                  key={notification.id}
                  shadow={notification.isRead ? 'xs' : 'sm'}
                  radius="md"
                  p="md"
                  className={`${styles.notificationItem} ${!notification.isRead ? styles.unread : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  withBorder
                >
                  <Group justify="space-between" align="flex-start">
                    <Group>
                      <div 
                        className={styles.iconWrapper}
                        style={{ 
                          background: notification.eventType === 'BIRTHDAY' 
                            ? 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)' 
                            : 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'
                        }}
                      >
                        <Icon size={24} color={notification.eventType === 'BIRTHDAY' ? '#9333ea' : '#ec4899'} />
                      </div>
                      <div>
                        <Group gap="xs">
                          <Text fw={800}>{notification.title}</Text>
                          <Badge size="xs" color={color}>
                            {notification.eventType}
                          </Badge>
                          {!notification.isRead && (
                            <Badge size="xs" color="blue" variant="filled">NEW</Badge>
                          )}
                        </Group>
                        <Text size="sm" c="dimmed" mt={4}>
                          {notification.message}
                        </Text>
                        <Text size="xs" c="dimmed" mt={8}>
                          Event: {formatDate(notification.eventDate)} • {getTimeAgo(notification.createdAt)}
                        </Text>
                      </div>
                    </Group>
                    
                    {!notification.isRead && (
                      <ActionIcon 
                        variant="subtle" 
                        color="gray"
                        onClick={() => handleMarkAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <IconCheck size={18} />
                      </ActionIcon>
                    )}
                  </Group>
                </MotionPaper>
              );
            })}
          </Stack>
        </AnimatePresence>
      )}
    </div>
  );
}
