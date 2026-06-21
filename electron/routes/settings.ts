import { Hono } from 'hono';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDb } from '../db/index';

const settingsRouter = new Hono();

/**
 * getDbPaths
 *
 * Helper to determine current active and default database paths.
 */
function getDbPaths() {
  const userDataDir = app.getPath('userData');
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const defaultDir = isDev
    ? path.join(process.cwd(), 'data')
    : userDataDir;
  
  const defaultDbPath = path.join(defaultDir, 'suratpharma.db');

  const configPath = path.join(userDataDir, 'db_config.json');
  let customDbDir = '';
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.databaseDir && fs.existsSync(config.databaseDir)) {
        customDbDir = config.databaseDir;
      }
    } catch (err) {
      console.error('[Settings] Failed to parse db_config.json:', err);
    }
  }

  const activeDbPath = customDbDir
    ? path.join(customDbDir, 'suratpharma.db')
    : defaultDbPath;

  return {
    defaultDir,
    defaultDbPath,
    customDbDir,
    activeDbPath,
    isCustom: !!customDbDir
  };
}

// GET /api/settings/db-path
settingsRouter.get('/db-path', async (c) => {
  try {
    const paths = getDbPaths();
    return c.json({
      success: true,
      data: {
        defaultDir: paths.defaultDir,
        customDir: paths.customDbDir || '',
        activeDbPath: paths.activeDbPath,
        isCustom: paths.isCustom
      }
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/settings/db-path
settingsRouter.post('/db-path', async (c) => {
  try {
    const body = await c.req.json();
    const targetDir = body.databaseDir as string;

    if (!targetDir) {
      return c.json({ success: false, error: 'Database directory is required' }, 400);
    }

    // Check if target directory is a valid absolute path
    const isAbsolutePath = path.isAbsolute(targetDir);
    if (!isAbsolutePath) {
      return c.json({ success: false, error: 'Please provide a valid absolute directory path.' }, 400);
    }

    // Attempt to create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch (mkdirErr: any) {
        return c.json({ success: false, error: `Failed to create database directory: ${mkdirErr.message}` }, 400);
      }
    }

    const paths = getDbPaths();
    const currentDbPath = paths.activeDbPath;
    const targetDbPath = path.join(targetDir, 'suratpharma.db');

    // If target directory does not have the database, copy current database to target
    if (!fs.existsSync(targetDbPath)) {
      if (fs.existsSync(currentDbPath)) {
        try {
          fs.copyFileSync(currentDbPath, targetDbPath);
          console.log(`[Settings] Copied database file to: ${targetDbPath}`);
        } catch (copyErr: any) {
          return c.json({ success: false, error: `Failed to copy database file to new location: ${copyErr.message}` }, 500);
        }
      }
    }

    // Save configuration
    const userDataDir = app.getPath('userData');
    const configPath = path.join(userDataDir, 'db_config.json');
    fs.writeFileSync(configPath, JSON.stringify({ databaseDir: targetDir }, null, 2), 'utf8');

    // Re-initialize SQLite connection with new path
    console.log(`[Settings] Re-initializing SQLite connection at: ${targetDbPath}`);
    initDb(targetDbPath);

    return c.json({
      success: true,
      message: 'Database directory updated successfully',
      data: {
        activeDbPath: targetDbPath,
        isCustom: true
      }
    });

  } catch (err: any) {
    console.error('[Settings/db-path] Update failed:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/settings/reset-db-path
settingsRouter.post('/reset-db-path', async (c) => {
  try {
    const userDataDir = app.getPath('userData');
    const configPath = path.join(userDataDir, 'db_config.json');

    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }

    const paths = getDbPaths();
    const defaultDbPath = paths.defaultDbPath;

    // Re-initialize SQLite with default path
    console.log(`[Settings] Re-initializing database connection to default: ${defaultDbPath}`);
    initDb(defaultDbPath);

    return c.json({
      success: true,
      message: 'Database directory reset to default successfully',
      data: {
        activeDbPath: defaultDbPath,
        isCustom: false
      }
    });

  } catch (err: any) {
    console.error('[Settings/reset-db-path] Reset failed:', err);
    return c.json({ success: false, error: err.message }, 500);
  }
});

export { settingsRouter };
