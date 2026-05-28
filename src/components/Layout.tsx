import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppShell,
  Group,
  Button,
  ActionIcon,
  Text,
  Badge,
  Tooltip,
  Box,
  Menu,
  Burger,
  Stack,
  Divider
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconStethoscope,
  IconPrescription,
  IconPackage,
  IconBell,
  IconHistory,
  IconSettings,
  IconArrowLeft,
  IconArrowRight,
  IconLogout,
  IconUpload,
  IconHome,
  IconChevronRight,
  IconChevronLeft
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useAppStore } from '../stores/appStore';
import styles from './Layout.module.css';

const getNavItems = (unreadCount: number) => [
  { path: '/dashboard', label: 'Dashboard', icon: IconHome },
  { path: '/doctors', label: 'Doctors', icon: IconStethoscope },
  { path: '/pharmacies', label: 'Pharmacies', icon: IconPrescription },
  { path: '/products', label: 'Products', icon: IconPackage },
  { path: '/notifications', label: 'Notifications', icon: IconBell, hasBadge: true, badgeCount: unreadCount },
  { path: '/history', label: 'History', icon: IconHistory },
  { path: '/upload', label: 'Upload', icon: IconUpload },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, username, checkSession, updateActivity } = useAuthStore();
  const { navigate: navNavigate, undo, redo, canUndo, canRedo } = useNavigationStore();
  const [opened, { toggle }] = useDisclosure();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Session check and activity tracking
  useEffect(() => {
    const interval = setInterval(() => {
      if (!checkSession()) {
        navigate('/login');
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [checkSession, navigate]);

  // Update activity on route change
  useEffect(() => {
    updateActivity();
    navNavigate(location.pathname);
  }, [location.pathname, updateActivity, navNavigate]);

  const { fetchNotifications, notifications } = useAppStore();
  
  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const navItems = getNavItems(unreadCount);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleUndo = () => {
    const path = undo();
    if (path) {
      navigate(path, { replace: true });
    }
  };

  const handleRedo = () => {
    const path = redo();
    if (path) {
      navigate(path, { replace: true });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <AppShell
      header={{ height: 80 }}
      navbar={{
        width: isCollapsed ? 90 : 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened }
      }}
      padding="0"
      className={styles.appShell}
    >
      <AppShell.Header className={styles.header}>
        <Group justify="space-between" h="100%" px="lg">
          {/* Left: Burger (mobile) & Brand */}
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Box className={styles.logoContainer}>
              <Box className={styles.logo}>
                <IconStethoscope size={24} stroke={2} />
              </Box>
              <Text fw={800} size="lg" className={styles.brandText}>
                SuratPharma
              </Text>
            </Box>
          </Group>

          {/* Right: Undo/Redo, Settings, Logout */}
          <Group gap="md">
            {/* Undo/Redo Controls */}
            <Group gap={4} className={styles.historyControls}>
              <Tooltip label="Go Back (Undo)" position="bottom">
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  disabled={!canUndo}
                  onClick={handleUndo}
                  className={styles.navControl}
                >
                  <IconArrowLeft size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Go Forward (Redo)" position="bottom">
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  disabled={!canRedo}
                  onClick={handleRedo}
                  className={styles.navControl}
                >
                  <IconArrowRight size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Divider orientation="vertical" className={styles.headerDivider} />

            {/* Settings Menu */}
            <Menu shadow="md" width={220} position="bottom-end" radius="md">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg" className={styles.userProfileBtn}>
                  <div className={styles.userInitial}>
                    {username ? username.charAt(0).toUpperCase() : 'U'}
                  </div>
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Logged in as</Menu.Label>
                <Menu.Item disabled>
                  <Text size="sm" fw={600} c="dark">{username}</Text>
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconSettings size={16} />}
                  onClick={() => navigate('/settings')}
                >
                  Settings
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={handleLogout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={styles.navbar}>
        <Stack gap="sm" className={styles.navbarStack}>
          {/* Collapse Toggle */}
          <Group justify={isCollapsed ? "center" : "flex-end"} className={styles.collapseToggleContainer}>
            <ActionIcon 
              variant="subtle" 
              onClick={toggleSidebar}
              className={styles.collapseBtn}
              size="md"
            >
              {isCollapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
            </ActionIcon>
          </Group>
          
          <div className={styles.navLinksWrapper}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              const Icon = item.icon;
              
              return (
                <Tooltip
                  key={item.path}
                  label={item.label}
                  position="right"
                  disabled={!isCollapsed}
                  transitionProps={{ duration: 200 }}
                  withArrow
                >
                  <Button
                    variant={isActive ? 'filled' : 'subtle'}
                    fullWidth
                    justify={isCollapsed ? "center" : "flex-start"}
                    leftSection={<Icon size={isCollapsed ? 24 : 20} className={styles.navIcon} />}
                    onClick={() => handleNavClick(item.path)}
                    className={`${isActive ? styles.activeNavButton : styles.navButton} ${isCollapsed ? styles.navButtonCollapsed : ''}`}
                    px={isCollapsed ? 0 : "md"}
                  >
                    {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
                    
                    {!isCollapsed && item.hasBadge && item.badgeCount > 0 && (
                      <Badge size="sm" circle color="red" ml="auto" variant="filled">
                        {item.badgeCount}
                      </Badge>
                    )}
                    
                    {isCollapsed && item.hasBadge && item.badgeCount > 0 && (
                      <div className={styles.collapsedBadge} />
                    )}
                  </Button>
                </Tooltip>
              );
            })}
          </div>
        </Stack>

        {!isCollapsed && (
          <div className={styles.sidebarFooter}>
            <Text size="xs" c="dimmed" ta="center">SuratPharma v1.0.0</Text>
          </div>
        )}
      </AppShell.Navbar>

      <AppShell.Main className={styles.main}>
        <div className={styles.pageContainer}>
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
