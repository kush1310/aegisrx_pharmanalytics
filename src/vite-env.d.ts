/// <reference types="vite/client" />

// The app communicates with the backend via HTTP (Hono on localhost:3001)
// The old window.electronAPI IPC bridge has been replaced.
interface Window {
  electronApp?: {
    platform: string;
    version:  string;
  };
}
