import { contextBridge } from 'electron';

// Minimal preload — the app now communicates with the backend
// via HTTP on localhost:3001 instead of Electron IPC.
// We only expose a small utility for the renderer if needed.
contextBridge.exposeInMainWorld('electronApp', {
  platform: process.platform,
  version:  process.versions.electron,
});
