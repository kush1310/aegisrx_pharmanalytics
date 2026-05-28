import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Box,
  Group
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUser, IconLock, IconLogin, IconSparkles, IconMail, IconArrowLeft, IconKey } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import PageLoader from '../components/PageLoader';
import styles from './Login.module.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  
  // Pre-filled credentials as requested - cleared by default
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [view, setView] = useState<'login' | 'forgot' | 'otp' | 'reset' | 'change'>('login');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  // Email suggestions
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const SUGGESTED_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aegisrx.com'];

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (val.includes('@')) {
      const parts = val.split('@');
      const prefix = parts[0];
      const typedDomain = parts[1] || '';
      
      const filtered = SUGGESTED_DOMAINS
        .filter(d => d.startsWith(typedDomain))
        .map(d => `${prefix}@${d}`);
      setEmailSuggestions(filtered);
    } else {
      setEmailSuggestions([]);
    }
  };

  // Redirect if already authenticated (only on initial mount/page load, not during active login)
  useEffect(() => {
    if (isAuthenticated && !isLoggingIn) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoggingIn, navigate]);

  // Input sanitization
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .trim();
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'Invalid email format';
      }
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      notifications.show({ title: 'Error', message: 'Email is required', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<any>('/api/auth/forgot-password', { email });
      if (res.success) {
        notifications.show({ title: 'Success', message: 'Verification OTP sent to your email', color: 'green' });
        setView('otp');
      } else {
        notifications.show({ title: 'Error', message: res.error || 'Failed to send OTP', color: 'red' });
      }
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message || 'Network error', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      notifications.show({ title: 'Error', message: 'Verification OTP code is required', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<any>('/api/auth/verify-otp', { email, otp });
      if (res.success) {
        notifications.show({ title: 'Success', message: 'Code verified successfully', color: 'green' });
        setView('reset');
      } else {
        notifications.show({ title: 'Error', message: res.error || 'Invalid verification code', color: 'red' });
      }
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message || 'Network error', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      notifications.show({ title: 'Error', message: 'Password must be at least 6 characters', color: 'red' });
      return;
    }
    if (newPassword !== confirmPassword) {
      notifications.show({ title: 'Error', message: 'Passwords do not match', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<any>('/api/auth/reset-password', { email, otp, newPassword, confirmPassword });
      if (res.success) {
        notifications.show({ title: 'Success', message: 'Password reset successfully. Please log in.', color: 'green' });
        setView('login');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtp('');
      } else {
        notifications.show({ title: 'Error', message: res.error || 'Reset failed', color: 'red' });
      }
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message || 'Network error', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !currentPassword || !newPassword || !confirmPassword) {
      notifications.show({ title: 'Error', message: 'All fields are required', color: 'red' });
      return;
    }
    if (newPassword.length < 6) {
      notifications.show({ title: 'Error', message: 'New password must be at least 6 characters', color: 'red' });
      return;
    }
    if (newPassword !== confirmPassword) {
      notifications.show({ title: 'Error', message: 'New passwords do not match', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<any>('/api/auth/change-password', { email, currentPassword, newPassword, confirmPassword });
      if (res.success) {
        notifications.show({ title: 'Success', message: 'Password changed successfully. Please log in.', color: 'green' });
        setView('login');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        notifications.show({ title: 'Error', message: res.error || 'Change failed', color: 'red' });
      }
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message || 'Network error', color: 'red' });
    } finally {
      setLoading(false);
    }
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

    setIsLoggingIn(true);
    const startTime = Date.now();

    const sanitizedEmail = sanitizeInput(email);
    const result = await login(sanitizedEmail, password);

    // Guarantee the loader runs for at least 4.5 seconds (4500ms)
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, 4500 - elapsed);
    await new Promise(resolve => setTimeout(resolve, remaining));

    setIsLoggingIn(false);

    if (result.success) {
      notifications.show({
        title: 'Welcome!',
        message: 'Log in successful',
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
              AegisRx Analytics
            </Text>
            
            {view === 'login' && (
              <Text className={styles.subtitle}>
                Sign in to access your dashboard
              </Text>
            )}
            {view === 'forgot' && (
              <Text className={styles.subtitle}>
                Enter email to receive reset code
              </Text>
            )}
            {view === 'otp' && (
              <Text className={styles.subtitle}>
                Verify verification code sent to {email}
              </Text>
            )}
            {view === 'reset' && (
              <Text className={styles.subtitle}>
                Choose a secure new password
              </Text>
            )}
            {view === 'change' && (
              <Text className={styles.subtitle}>
                Change password using current password
              </Text>
            )}
          </Box>

          {/* ── VIEW: login ────────────────────────────────────────── */}
          {view === 'login' && (
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <div className="relative">
                  <TextInput
                    label="Email"
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    error={errors.email}
                    leftSection={<IconUser size={18} />}
                    required
                    autoFocus
                    classNames={{ input: styles.input }}
                    radius="md"
                    size="md"
                  />
                  {emailSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {emailSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium cursor-pointer"
                          onClick={() => {
                            setEmail(suggestion);
                            setEmailSuggestions([]);
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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

                <Group justify="space-between" mt="-xs">
                  <span
                    style={{ color: '#6366f1', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'underline' }}
                    onClick={() => setView('forgot')}
                  >
                    Forgot Password?
                  </span>
                  <span
                    style={{ color: '#6366f1', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'underline' }}
                    onClick={() => setView('change')}
                  >
                    Change Password
                  </span>
                </Group>

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                  leftSection={<IconLogin size={20} />}
                  className={styles.loginButton}
                  mt="sm"
                >
                  Sign In
                </Button>
              </Stack>
            </form>
          )}

          {/* ── VIEW: forgot ───────────────────────────────────────── */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword}>
              <Stack gap="md">
                <TextInput
                  label="Email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftSection={<IconMail size={18} />}
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
                  className={styles.loginButton}
                >
                  Send Reset Code
                </Button>

                <Button
                  variant="subtle"
                  color="gray"
                  size="md"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => setView('login')}
                >
                  Back to Sign In
                </Button>
              </Stack>
            </form>
          )}

          {/* ── VIEW: otp ──────────────────────────────────────────── */}
          {view === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              <Stack gap="md">
                <TextInput
                  label="Verification Code"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  leftSection={<IconKey size={18} />}
                  required
                  classNames={{ input: styles.input }}
                  radius="md"
                  size="md"
                  maxLength={6}
                  autoFocus
                />
                
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                  className={styles.loginButton}
                >
                  Verify Code
                </Button>

                <Button
                  variant="subtle"
                  color="gray"
                  size="md"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => setView('forgot')}
                >
                  Change Email
                </Button>
              </Stack>
            </form>
          )}

          {/* ── VIEW: reset ────────────────────────────────────────── */}
          {view === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <Stack gap="md">
                <PasswordInput
                  label="New Password"
                  placeholder="Enter new password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  leftSection={<IconLock size={18} />}
                  required
                  classNames={{ input: styles.input }}
                  radius="md"
                  size="md"
                />
                <PasswordInput
                  label="Confirm New Password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  className={styles.loginButton}
                >
                  Reset Password
                </Button>
              </Stack>
            </form>
          )}

          {/* ── VIEW: change ───────────────────────────────────────── */}
          {view === 'change' && (
            <form onSubmit={handleChangePassword}>
              <Stack gap="md">
                <TextInput
                  label="Email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftSection={<IconMail size={18} />}
                  required
                  classNames={{ input: styles.input }}
                  radius="md"
                  size="md"
                />
                <PasswordInput
                  label="Current Password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  leftSection={<IconLock size={18} />}
                  required
                  classNames={{ input: styles.input }}
                  radius="md"
                  size="md"
                />
                <PasswordInput
                  label="New Password"
                  placeholder="Enter new password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  leftSection={<IconLock size={18} />}
                  required
                  classNames={{ input: styles.input }}
                  radius="md"
                  size="md"
                />
                <PasswordInput
                  label="Confirm New Password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  className={styles.loginButton}
                >
                  Change Password
                </Button>

                <Button
                  variant="subtle"
                  color="gray"
                  size="md"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => setView('login')}
                >
                  Back to Sign In
                </Button>
              </Stack>
            </form>
          )}

          {view === 'login' && (
            <Text size="sm" ta="center" mt="xs">
              Don't have an account?{' '}
              <span
                style={{ color: '#6366f1', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                onClick={() => navigate('/signup')}
              >
                Sign Up
              </span>
            </Text>
          )}

          <Text className={styles.footer} ta="center" mt="sm">
            AegisRx Analytics v1.0.0
            <br />
            © 2026 AegisRx Analytics. All rights reserved.
          </Text>
        </Stack>
      </Paper>

      {isLoggingIn && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md transition-all duration-300">
          <div className="flex flex-col items-center gap-6 p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm text-center">
            <PageLoader size={2.2} message="Establishing Secure JWT Session..." variant="dark" />
          </div>
        </div>
      )}
    </div>
  );
}
