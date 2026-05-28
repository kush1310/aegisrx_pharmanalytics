import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDb } from './db/index';
import { startServer } from './server';
import { users } from './db/schema';
import { checkEventsLogic } from './routes/notifications';

// Save original log to print "application started" at the end of initialization
const originalLog = console.log;

// Mute all other terminal logs from Electron and Hono
console.log = () => {};
console.warn = () => {};
console.error = () => {};
console.info = () => {};

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Load Environment Variables from .env file ──────────────────────────
try {
  const possiblePaths = [
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
    path.join(app.getAppPath(), '.env')
  ];
  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (key) {
              process.env[key] = val;
            }
          }
        }
      });
      break;
    }
  }
} catch (e) {
  // Silent fallback
}

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Resolve Windows Access Denied (0x5) by disabling GPU shader disk cache
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Explicitly set userData path to a sub-folder to avoid root permission conflicts
app.setPath('userData', path.join(app.getPath('appData'), 'aegisrx-v1'));
app.setAppUserModelId('com.aegisrx.analytics');

// ── Native module path fix for packaged builds ─────────────────────────
// better-sqlite3 contains a native .node binary that cannot be executed
// from inside an asar archive. electron-builder's asarUnpack copies it to
// app.asar.unpacked/. This patch rewrites the require path so Node finds
// the unpacked binary at runtime in both dev and production modes.
if (app.isPackaged) {
  const asarUnpackedBase = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules');
  // Prepend to NODE_PATH so native requires resolve to the unpacked location
  process.env.NODE_PATH = [
    asarUnpackedBase,
    process.env.NODE_PATH || ''
  ].filter(Boolean).join(path.delimiter);
}

// ── Database init ──────────────────────────────────────────────────────
function initializeDatabase() {
  const dbPath = isDev
    ? path.join(__dirname, '../data/suratpharma.db')
    : path.join(app.getPath('userData'), 'suratpharma.db');

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  process.env.DATABASE_URL = `file:${dbPath}`;

  const db = initDb(dbPath);
  console.log('[DB] Connected at:', dbPath);
  return db;
}

// ── Seed default admin user ────────────────────────────────────────────
function seedUsers(db: ReturnType<typeof initDb>) {
  try {
    const hashPassword = (pw: string) =>
      crypto.pbkdf2Sync(pw, 'suratpharma_salt_2026', 1000, 64, 'sha512').toString('hex');

    const existing = db.select().from(users).all();
    if (existing.length === 0) {
      db.insert(users).values([
        {
          username: 'admin@aegisrx.com',
          prefix:    'Mr.',
          firstName: 'Admin',
          lastName:  'User',
          email:     'admin@aegisrx.com',
          passwordHash: hashPassword('Admin@1234'),
          role: 'ADMIN'
        }
      ]).run();
    }
  } catch (err) {
    console.error('[DB] Seed error (users):', err);
  }
}

// ── Window creation ────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'AegisRx Analytics',
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#f1f5f9',
    show: false,
    frame: true,
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    const isHidden = process.argv.includes('--hidden');
    if (!isHidden) {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── App single instance lock ──────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────
app.whenReady().then(() => {
  if (gotTheLock) {
    const db = initializeDatabase();
    seedUsers(db);

    // Start the Hono HTTP API server
    startServer();

    createWindow();

    // Enable auto-launch on system startup
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: ['--hidden']
      });
    }

    // Schedule checking events (birthday / anniversary) 5 minutes after machine has started
    setTimeout(() => {
      checkEventsLogic();
      // Keep checking every 12 hours while the machine remains active
      setInterval(checkEventsLogic, 12 * 60 * 60 * 1000);
    }, 300000); // 5 minutes delay (300,000 ms)

    // Print exact notification for CLI start recognition
    originalLog('Launching AegisRx Application');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});