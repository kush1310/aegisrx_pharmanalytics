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
    <div className="max-w-4xl mx-auto py-6 animate-fade-in">
      <PageHeader 
        title="Settings"
        subtitle="Manage your application preferences"
      />

      {/* Account Section */}
      <Card p="xl" radius="lg" mt="lg" className="border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300">
        <Text fw={800} className="text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">Account</Text>
        <Stack gap="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={800} className="text-slate-700">Logged in as</Text>
              <Text size="sm" c="dimmed" className="font-mono text-slate-500">{username}</Text>
            </Stack>
            <Badge variant="gradient" gradient={{ from: 'indigo', to: 'violet', deg: 90 }} size="lg">Active</Badge>
          </Group>
          <Divider className="border-slate-100" />
          <Button
            variant="light"
            color="red"
            className="hover:bg-red-50 active:scale-95 transition-all w-fit border border-red-100"
            leftSection={<IconLogout size={18} />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Stack>
      </Card>

      {/* Application Section */}
      <Card p="xl" radius="lg" mt="lg" className="border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300">
        <Text fw={800} className="text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">Application</Text>
        <Stack gap="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={800} className="text-slate-700">Version</Text>
              <Text size="sm" c="dimmed" className="text-slate-500">AegisRx Analytics Platform</Text>
            </Stack>
            <Badge variant="outline" color="indigo" size="md">v1.7.6</Badge>
          </Group>
          <Divider className="border-slate-100" />
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={800} className="text-slate-700">Database</Text>
              <Text size="sm" c="dimmed" className="text-slate-500">SQLite (Local)</Text>
            </Stack>
            <Badge color="teal" variant="dot" size="md">Connected</Badge>
          </Group>
        </Stack>
      </Card>

      {/* Data Management */}
      <Card p="xl" radius="lg" mt="lg" className="border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300">
        <Text fw={800} className="text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">Data Management</Text>
        <Stack gap="md">
          <Button
            variant="light"
            color="indigo"
            className="hover:bg-indigo-50 active:scale-95 transition-all w-fit border border-indigo-100"
            leftSection={<IconRefresh size={18} />}
            onClick={handleClearCache}
          >
            Clear Application Cache
          </Button>
          <Text size="xs" c="dimmed" className="text-slate-400">
            This will clear navigation history and temporary data. Your database records will not be affected.
          </Text>
        </Stack>
      </Card>

      {/* About */}
      <Card p="xl" radius="lg" mt="lg" className="border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-300 mb-8">
        <Text fw={800} className="text-slate-800 text-lg border-b border-slate-100 pb-2 mb-4">About Platform</Text>
        <Stack gap="md">
          <Text size="sm" className="text-slate-600 leading-relaxed">
            <strong>AegisRx Analytics</strong> is a secure pharmaceutical network management and business intelligence platform. It helps pharmaceutical teams clean product lists, automatically link doctors with pharmacies, and gain key insights into product sales distribution.
          </Text>
          <Divider className="border-slate-100" />
          
          <Text size="sm" fw={800} className="text-slate-700 font-bold tracking-tight">The Development Team</Text>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
            {/* Kush Shah */}
            <div className="flex flex-col items-center text-center p-4 bg-slate-50/60 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/90 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md group-hover:scale-105 transition-transform duration-300">
                KS
              </div>
              <span className="font-bold text-slate-800 text-sm mt-3">Kush Shah</span>
              <span className="text-indigo-600 font-semibold text-xs mt-1">Team Lead &amp; Lead Security</span>
            </div>

            {/* Krina Parikh */}
            <div className="flex flex-col items-center text-center p-4 bg-slate-50/60 rounded-xl border border-slate-100 hover:border-pink-200 hover:bg-slate-50/90 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-pink-500 to-rose-600 shadow-md group-hover:scale-105 transition-transform duration-300">
                KP
              </div>
              <span className="font-bold text-slate-800 text-sm mt-3">Krina Parikh</span>
              <span className="text-pink-600 font-semibold text-xs mt-1">Frontend Developer</span>
            </div>

            {/* Ishan Shastri */}
            <div className="flex flex-col items-center text-center p-4 bg-slate-50/60 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50/90 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md group-hover:scale-105 transition-transform duration-300">
                IS
              </div>
              <span className="font-bold text-slate-800 text-sm mt-3">Ishan Shastri</span>
              <span className="text-blue-600 font-semibold text-xs mt-1">Full-Stack Developer</span>
            </div>

            {/* Visha Kardani */}
            <div className="flex flex-col items-center text-center p-4 bg-slate-50/60 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-slate-50/90 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md group-hover:scale-105 transition-transform duration-300">
                VK
              </div>
              <span className="font-bold text-slate-800 text-sm mt-3">Visha Kardani</span>
              <span className="text-emerald-600 font-semibold text-xs mt-1">Backend Developer</span>
            </div>
          </div>

          <Text size="xs" c="dimmed" className="text-slate-400 mt-4 text-center">
            © 2026 AegisRx Analytics. All rights reserved.
          </Text>
        </Stack>
      </Card>
    </div>
  );
}
