import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDb } from './db/index';
import { startServer } from './server';
import { users } from './db/schema';
import { checkEventsLogic } from './routes/notifications';

// ── Crash log setup ─────────────────────────────────────────────────────
// Writes crash details to %APPDATA%/aegisrx-v1/crash-logs/ so they can
// be retrieved for debugging without needing DevTools.
function writeCrashLog(tag: string, detail: string): void {
  try {
    const logDir  = path.join(app.getPath('userData'), 'crash-logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const stamp   = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `${tag}-${stamp}.txt`);
    const header  = `AegisRx Crash Log — ${new Date().toISOString()}\nProcess: ${tag}\n${'─'.repeat(60)}\n`;
    fs.writeFileSync(logFile, header + detail + '\n', 'utf8');
  } catch { /* cannot crash the crash handler */ }
}

process.on('uncaughtException', (err) => {
  writeCrashLog('main-uncaught', `${err?.stack || err}`);
  console.error('[CRASH] uncaughtException:', err);
});

process.on('unhandledRejection', (reason) => {
  writeCrashLog('main-unhandled-rejection', String(reason));
  console.error('[CRASH] unhandledRejection:', reason);
});

// Save original log to print "application started" at the end of initialization
const originalLog = console.log;

// Mute all other terminal logs from Electron and Hono
// console.log = () => {};
// console.warn = () => {};
// console.error = () => {};
// console.info = () => {};

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Load Environment Variables from .env file ──────────────────────────
try {
  const possiblePaths = [
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
    path.join(app.getAppPath(), '.env'),
    // packaged build: .env lands in process.resourcesPath via extraResources
    ...(process.resourcesPath ? [path.join(process.resourcesPath, '.env')] : []),
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

/**
 * initializeDatabase
 *
 * Configures the SQLite database file path. In production builds, if no database
 * exists in the user data directory, the bundled seed database and migrations
 * are automatically copied from the read-only resources package to the writable
 * AppData directory. Connects to the database and applies pending Drizzle migrations.
 *
 * @returns {ReturnType<typeof initDb>} - The initialized database instance.
 */
function initializeDatabase() {
  const userDataDir = app.getPath('userData');
  const configPath = path.join(userDataDir, 'db_config.json');
  let customDbDir = '';

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.databaseDir && fs.existsSync(config.databaseDir)) {
        customDbDir = config.databaseDir;
      }
    } catch (err) {
      console.error('[DB] Failed to read db_config.json:', err);
    }
  }

  const dbPath = customDbDir
    ? path.join(customDbDir, 'suratpharma.db')
    : (isDev
        ? path.join(__dirname, '../data/suratpharma.db')
        : path.join(userDataDir, 'suratpharma.db'));

  // In production, copy seed database and drizzle migrations to writable AppData if missing
  if (!isDev) {
    // Copy the pre-seeded SQLite database file if it does not exist
    if (!fs.existsSync(dbPath)) {
      const seedDbPath = path.join(process.resourcesPath, 'data/suratpharma.db');
      if (fs.existsSync(seedDbPath)) {
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
        try {
          fs.copyFileSync(seedDbPath, dbPath);
          console.log('[DB] Seed database copied successfully to:', dbPath);
        } catch (copyErr) {
          console.error('[DB] Failed to copy seed database:', copyErr);
        }
      } else {
        console.error('[DB] Seed database not found in resources:', seedDbPath);
      }
    }

    // Copy the drizzle migrations folder to ensure the app can run migrations locally
    const destDrizzleDir = path.join(userDataDir, 'drizzle');
    if (!fs.existsSync(destDrizzleDir)) {
      const srcDrizzleDir = path.join(process.resourcesPath, 'drizzle');
      if (fs.existsSync(srcDrizzleDir)) {
        try {
          const recursiveCopyDir = (srcPath: string, destPath: string) => {
            fs.mkdirSync(destPath, { recursive: true });
            const entries = fs.readdirSync(srcPath, { withFileTypes: true });
            for (const entry of entries) {
              const fullSrc = path.join(srcPath, entry.name);
              const fullDest = path.join(destPath, entry.name);
              if (entry.isDirectory()) {
                recursiveCopyDir(fullSrc, fullDest);
              } else {
                fs.copyFileSync(fullSrc, fullDest);
              }
            }
          };
          recursiveCopyDir(srcDrizzleDir, destDrizzleDir);
          console.log('[DB] Drizzle migrations copied to user data directory.');
        } catch (copyErr) {
          console.error('[DB] Failed to copy migrations folder:', copyErr);
        }
      } else {
        console.error('[DB] Source migrations folder not found in resources:', srcDrizzleDir);
      }
    }
  } else {
    // In development mode, ensure the local data folder exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

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

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    writeCrashLog('renderer', JSON.stringify(details, null, 2));
    console.error('[CRASH] render-process-gone:', details);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    writeCrashLog('did-fail-load', `errorCode=${errorCode}\nerrorDescription=${errorDescription}\nurl=${validatedURL}`);
    console.error('[CRASH] did-fail-load:', errorCode, errorDescription, validatedURL);
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

    // Schedule checking events (birthday / anniversary).
    // Dev: 10-second delay so the tombstone fix is immediately verifiable after hot-reload.
    // Production: 1.5-minute delay so the system is fully ready before scanning.
    const startupDelayMs = isDev ? 10000 : 90000;
    setTimeout(() => {
      checkEventsLogic();
      // Keep checking every 12 hours while the machine remains active
      setInterval(checkEventsLogic, 12 * 60 * 60 * 1000);
    }, startupDelayMs);

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