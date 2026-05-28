import {
  Card,
  Text,
  Group,
  Stack,
  Button,
  Divider,
  Badge
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconLogout,
  IconRefresh,
  IconCheck
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import PageHeader from '@/components/PageHeader';
import styles from './Settings.module.css';

export default function Settings() {
  const navigate = useNavigate();
  const { logout, username } = useAuthStore();
  const { reset: resetNavigation } = useNavigationStore();

  const handleLogout = () => {
    logout();
    resetNavigation();
    navigate('/login');
  };

  const handleClearCache = () => {
    // Clear navigation history and local storage
    resetNavigation();
    localStorage.removeItem('suratpharma-auth');
    
    notifications.show({
      title: 'Cache Cleared',
      message: 'Application cache has been cleared',
      color: 'green',
      icon: <IconCheck size={18} />
    });
  };

  return (
    <div className={styles.container}>
      <PageHeader 
        title="Settings"
        subtitle="Manage your application preferences"
      />

      {/* Account Section */}
      <Card p="lg" radius="lg" mt="lg" className={styles.sectionCard}>
        <Text fw={800} mb="md">Account</Text>
        <Stack gap="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={800}>Logged in as</Text>
              <Text size="sm" c="dimmed">{username}</Text>
            </Stack>
            <Badge variant="light" size="lg">Active</Badge>
          </Group>
          <Divider />
          <Button
            variant="outline"
            color="red"
            leftSection={<IconLogout size={18} />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Stack>
      </Card>

      {/* Application Section */}
      <Card p="lg" radius="lg" mt="lg" className={styles.sectionCard}>
        <Text fw={800} mb="md">Application</Text>
        <Stack gap="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={800}>Version</Text>
              <Text size="sm" c="dimmed">SuratPharma Analytics</Text>
            </Stack>
            <Badge variant="light">v1.0.0</Badge>
          </Group>
          <Divider />
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={800}>Database</Text>
              <Text size="sm" c="dimmed">SQLite (Local)</Text>
            </Stack>
            <Badge color="green" variant="dot">Connected</Badge>
          </Group>
        </Stack>
      </Card>

      {/* Data Management */}
      <Card p="lg" radius="lg" mt="lg" className={styles.sectionCard}>
        <Text fw={800} mb="md">Data Management</Text>
        <Stack gap="md">
          <Button
            variant="light"
            leftSection={<IconRefresh size={18} />}
            onClick={handleClearCache}
          >
            Clear Application Cache
          </Button>
          <Text size="xs" c="dimmed">
            This will clear navigation history and temporary data. Your database records will not be affected.
          </Text>
        </Stack>
      </Card>

      {/* About */}
      <Card p="lg" radius="lg" mt="lg" className={styles.sectionCard}>
        <Text fw={800} mb="md">About</Text>
        <Stack gap="xs">
          <Text size="sm">
            <strong>SuratPharma Analytics</strong> is a pharmaceutical network management and analytics application.
          </Text>
          <Text size="sm" c="dimmed">
            Designed for Bhavesh Rafaliya
          </Text>
          <Text size="xs" c="dimmed" mt="sm">
            © 2026 All rights reserved.
          </Text>
        </Stack>
      </Card>
    </div>
  );
}
