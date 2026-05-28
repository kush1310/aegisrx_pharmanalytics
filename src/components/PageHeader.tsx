import { useNavigate, useLocation } from 'react-router-dom';
import { Group, ActionIcon, Text, Tooltip } from '@mantine/core';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import styles from './PageHeader.module.css';
import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  showBack?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export default function PageHeader({ 
  title, 
  subtitle, 
  action, 
  showBack = true,
  onRefresh,
  refreshing = false
}: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // If we're on the dashboard, we usually don't want a back button unless navigating within a stack, 
  // but we can default it to false if the path is exactly /dashboard
  const isDashboard = location.pathname === '/dashboard';
  const displayBack = showBack && !isDashboard;

  return (
    <div className={styles.headerContainer}>
      <Group justify="space-between" align="center" className={styles.headerContent}>
        <Group gap="md">
          {displayBack && (
            <ActionIcon 
              variant="subtle" 
              size="lg" 
              className={styles.backButton}
              onClick={() => navigate(-1)}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
          )}
          
          <div>
            <Group gap="xs" align="center">
              <Text className={styles.title}>{title}</Text>
              {onRefresh && (
                <Tooltip label="Refresh Data" position="right" withArrow>
                  <ActionIcon 
                    variant="subtle" 
                    color="gray"
                    size="sm"
                    onClick={onRefresh}
                    loading={refreshing}
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
            {subtitle && <Text className={styles.subtitle}>{subtitle}</Text>}
          </div>
        </Group>

        {action && (
          <div className={styles.actionContainer}>
            {action}
          </div>
        )}
      </Group>
    </div>
  );
}
