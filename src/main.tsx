import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { HashRouter } from 'react-router-dom';
import App from './App';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './styles/index.css';

/**
 * PharmaLens Analytics — Mantine Theme
 *
 * Primary color: Dark Navy (#0f172a) — sidebar, primary buttons
 * Accent color:  Indigo (#4f46e5) — active states, links, interactive
 * Semantic:
 *   - Amber  → pharmacy metrics
 *   - Green  → product/success states
 *   - Blue   → revenue/financial data
 *   - Red    → errors, destructive actions
 */
const theme = createTheme({
  primaryColor: 'violet',
  colors: {
    violet: [
      '#f5f3ff',
      '#ede9fe',
      '#ddd6fe',
      '#c4b5fd',
      '#a78bfa',
      '#8b5cf6',
      '#7c3aed',
      '#6d28d9',
      '#5b21b6',
      '#4c1d95',
    ],
    indigo: [
      '#eef2ff',
      '#e0e7ff',
      '#c7d2fe',
      '#a5b4fc',
      '#818cf8',
      '#6366f1',
      '#4f46e5',
      '#4338ca',
      '#3730a3',
      '#312e81',
    ],
    slate: [
      '#f8fafc',
      '#f1f5f9',
      '#e2e8f0',
      '#cbd5e1',
      '#94a3b8',
      '#64748b',
      '#475569',
      '#334155',
      '#1e293b',
      '#0f172a',
    ],
  },
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '700',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.04)',
    xl: '0 20px 40px -5px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.05)',
  },
  defaultRadius: 'md',
  components: {
    Button: {
      defaultProps: { fw: 600 },
    },
  },
});

import { ModalsProvider } from '@mantine/modals';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-center" />
      <ModalsProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
);
