import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Box
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUser, IconLock, IconLogin, IconSparkles } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  
  // Pre-filled credentials as requested
  const [username, setUsername] = useState('Bhavesh Rafaliya');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Input sanitization
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .trim();
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fix the errors before submitting',
        color: 'red'
      });
      return;
    }

    setLoading(true);

    // Simulate slight delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const sanitizedUsername = sanitizeInput(username);
    const result = await login(sanitizedUsername, password);

    setLoading(false);

    if (result.success) {
      notifications.show({
        title: 'Welcome!',
        message: `Hello, ${sanitizedUsername}!`,
        color: 'green'
      });
      navigate('/dashboard');
    } else {
      notifications.show({
        title: 'Login Failed',
        message: result.error || 'Invalid credentials',
        color: 'red'
      });
    }
  };

  return (
    <div className={styles.container}>
      {/* Animated Background */}
      <div className={styles.background}>
        {/* Gradient Orbs */}
        <div className={styles.gradientOrb} />
        <div className={styles.gradientOrb} />
        
        {/* Floating Particles */}
        <div className={styles.particles}>
          {[...Array(12)].map((_, i) => (
            <div key={i} className={styles.particle} />
          ))}
        </div>
      </div>
      
      {/* Login Card */}
      <Paper className={styles.loginCard} shadow="xl" p="xl" radius="xl">
        <Stack gap="lg">
          <Box className={styles.logoContainer}>
            <div className={styles.logoIcon}>
              <IconSparkles size={42} stroke={1.5} />
            </div>
            <Text className={styles.appTitle}>
              SuratPharma Analytics
            </Text>
            <Text className={styles.subtitle}>
              Sign in to access your dashboard
            </Text>
          </Box>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Username"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={errors.username}
                leftSection={<IconUser size={18} />}
                required
                autoFocus
                classNames={{ input: styles.input }}
                radius="md"
                size="md"
              />

              <PasswordInput
                label="Password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                leftSection={<IconLock size={18} />}
                required
                classNames={{ input: styles.input }}
                radius="md"
                size="md"
              />

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                leftSection={<IconLogin size={20} />}
                className={styles.loginButton}
                mt="md"
              >
                Sign In
              </Button>
            </Stack>
          </form>

          <Text className={styles.footer} ta="center" mt="sm">
            SuratPharma Analytics v1.0.0
            <br />
            © 2026 Bhavesh Rafaliya
          </Text>
        </Stack>
      </Paper>
    </div>
  );
}
