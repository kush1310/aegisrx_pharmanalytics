import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDb } from './db/index';
import { startServer } from './server';
import { users, doctors } from './db/schema';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Resolve Windows Access Denied (0x5) by disabling GPU shader disk cache
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Explicitly set userData path to a sub-folder to avoid root permission conflicts
app.setPath('userData', path.join(app.getPath('appData'), 'surat-pharma-v2'));

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

// ── Seed default users ─────────────────────────────────────────────────
function seedUsers(db: ReturnType<typeof initDb>) {
  try {
    const hashPassword = (pw: string) =>
      crypto.pbkdf2Sync(pw, 'suratpharma_salt_2026', 1000, 64, 'sha512').toString('hex');

    const existing = db.select().from(users).all();
    if (existing.length === 0) {
      db.insert(users).values([
        { username: 'Bhavesh Rafaliya', passwordHash: hashPassword('kush1111'), role: 'ADMIN' },
        { username: 'Technical Team',   passwordHash: hashPassword('dev123'),   role: 'DEVELOPER' },
      ]).run();
      console.log('[DB] Default users seeded.');
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
    title: 'SuratPharma Analytics',
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
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── App lifecycle ──────────────────────────────────────────────────────
app.whenReady().then(() => {
  const db = initializeDatabase();
  seedUsers(db);

  // Start the Hono HTTP API server
  startServer();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});