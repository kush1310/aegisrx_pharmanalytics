import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Box,
  Select,
  Group
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconLock, IconMail, IconCalendar } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import Medical3DHeart from '../components/Medical3DHeart';
import styles from './Login.module.css'; // sharing background styles from Login

export default function SignUp() {
  const navigate = useNavigate();
  const { signup } = useAuthStore();

  const [prefix, setPrefix] = useState<string>('Mr.');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    
    if (!birthDate) {
      newErrors.birthDate = 'Birth date is required';
    } else {
      const parsedDate = new Date(birthDate as any);
      if (isNaN(parsedDate.getTime())) {
        newErrors.birthDate = 'Invalid birth date';
      }
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'Invalid email format (must contain @ and valid extension like .com)';
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please resolve form errors',
        color: 'red'
      });
      return;
    }

    setLoading(true);
    try {
      let birthDateStr = '';
      if (birthDate) {
        const parsedDate = new Date(birthDate as any);
        if (!isNaN(parsedDate.getTime())) {
          birthDateStr = parsedDate.toISOString().split('T')[0];
        }
      }

      const result = await signup({
        prefix,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: birthDateStr,
        email: email.trim(),
        password,
        confirmPassword
      });

      if (result.success) {
        notifications.show({
          title: 'Account Created',
          message: 'Please log in with your email and password.',
          color: 'green'
        });
        navigate('/login');
      } else {
        notifications.show({
          title: 'Registration Failed',
          message: result.error || 'Failed to create account',
          color: 'red'
        });
      }
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Network error',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.gradientOrb} />
        <div className={styles.gradientOrb} />
        <div className={styles.particles}>
          {[...Array(12)].map((_, i) => (
            <div key={i} className={styles.particle} />
          ))}
        </div>
      </div>

      <Paper className={styles.loginCard} shadow="xl" p="xl" radius="xl" style={{ maxWidth: '480px' }}>
        <Stack gap="md">
          <Box className={styles.logoContainer} style={{ padding: '10px 0' }}>
            <div className={styles.logoIcon}>
              <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <Medical3DHeart />
              </div>
            </div>
            <Text className={styles.appTitle} style={{ fontSize: '1.5rem' }}>
              AegisRx Analytics
            </Text>
            <Text className={styles.subtitle}>
              Create your account to get started
            </Text>
          </Box>

          <form onSubmit={handleSubmit}>
            <Stack gap="xs">
              <Group grow gap="xs">
                <Select
                  label="Prefix"
                  value={prefix}
                  onChange={(val) => setPrefix(val || 'Mr.')}
                  data={['Mr.', 'Mrs.', 'Miss']}
                  radius="md"
                />
                <TextInput
                  label="First Name"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  error={errors.firstName}
                  required
                  radius="md"
                />
              </Group>

              <TextInput
                label="Last Name"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                error={errors.lastName}
                required
                radius="md"
              />

              <DateInput
                label="Birth Date"
                placeholder="Select birth date"
                value={birthDate}
                onChange={(date: any) => setBirthDate(date as Date | null)}
                error={errors.birthDate}
                required
                leftSection={<IconCalendar size={18} />}
                radius="md"
              />

              <div className="relative">
                <TextInput
                  label="Email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  error={errors.email}
                  leftSection={<IconMail size={18} />}
                  required
                  radius="md"
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
                placeholder="Create password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                leftSection={<IconLock size={18} />}
                required
                radius="md"
              />

              <PasswordInput
                label="Confirm Password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                leftSection={<IconLock size={18} />}
                required
                radius="md"
              />

              <Button
                type="submit"
                fullWidth
                size="md"
                loading={loading}
                className={styles.loginButton}
                mt="md"
              >
                Sign Up
              </Button>
            </Stack>
          </form>

          <Text size="sm" ta="center" mt="xs">
            Already have an account?{' '}
            <span
              style={{ color: '#6366f1', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
              onClick={() => navigate('/login')}
            >
              Sign In
            </span>
          </Text>

          <Text className={styles.footer} ta="center" mt="sm">
            AegisRx Analytics v1.8.9
            <br />
            © 2026 The Developers
          </Text>
        </Stack>
      </Paper>
    </div>
  );
}
