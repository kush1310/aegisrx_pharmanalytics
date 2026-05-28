import { useId } from 'react';
import { Text } from '@mantine/core';

interface PageLoaderProps {
  size?: number;
  message?: string;
  variant?: 'light' | 'dark';
}

/**
 * PageLoader
 *
 * Displays the animated AegisRx lettering (A E G I S R X) using synchronized
 * gradient stroke-dash draw animations.
 *
 * Each letter uses clean single-stroke SVG paths with self-contained defs,
 * preventing layout bugs and ensuring robust rendering on Chromium/Electron.
 *
 * @param  {number} size    - Scale multiplier applied to the letter group; default 1.8.
 * @param  {string} message - Status text rendered beneath the letters.
 * @param  {string} variant - 'light' = slate text, 'dark' = white text.
 */
export default function PageLoader({
  size = 1.8,
  message = 'Loading...',
  variant = 'light'
}: PageLoaderProps) {
  const uniqueId = useId().replace(/:/g, '-');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: '120px',
      }}
      className="aegisrx-loader-host"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Letter draw/undraw animation ─────────────────────────────── */
        @keyframes aegis-dash {
          0%   { stroke-dashoffset: 360; opacity: 0; }
          10%  { opacity: 1; }
          50%  { stroke-dashoffset: 0;   opacity: 1; }
          90%  { opacity: 1; }
          100% { stroke-dashoffset: -360; opacity: 0; }
        }

        /* ── Vertical float for the whole group ──────────────────────── */
        @keyframes aegis-float {
          0%, 100% { transform: translateY(0px) scale(${size}); }
          50%       { transform: translateY(-6px) scale(${size}); }
        }

        /* ── Message text fade pulse ──────────────────────────────────── */
        @keyframes aegis-pulse {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 1;    }
        }

        .aegisrx-loader-host .aegis-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transform-origin: center center;
          animation: aegis-float 3s ease-in-out infinite;
          margin-bottom: 20px;
        }

        .aegisrx-loader-host .aegis-letter {
          overflow: visible;
        }

        .aegisrx-loader-host .aegis-letter path {
          stroke-dasharray: 360;
          stroke-dashoffset: 360;
          fill: none;
          animation: aegis-dash 2.4s cubic-bezier(0.42, 0, 0.58, 1) infinite;
        }

        /* Each letter starts its animation at a staggered delay */
        .aegisrx-loader-host .aegis-letter:nth-child(1) path { animation-delay: 0.00s; }
        .aegisrx-loader-host .aegis-letter:nth-child(2) path { animation-delay: 0.18s; }
        .aegisrx-loader-host .aegis-letter:nth-child(3) path { animation-delay: 0.36s; }
        .aegisrx-loader-host .aegis-letter:nth-child(4) path { animation-delay: 0.54s; }
        .aegisrx-loader-host .aegis-letter:nth-child(5) path { animation-delay: 0.72s; }
        .aegisrx-loader-host .aegis-letter:nth-child(6) path { animation-delay: 0.90s; }
        .aegisrx-loader-host .aegis-letter:nth-child(7) path { animation-delay: 1.08s; }

        .aegisrx-loader-host .aegis-msg {
          animation: aegis-pulse 2s ease-in-out infinite;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
      `}} />

      {/* Letter group — floats up/down as a unit */}
      <div className="aegis-group">
        {/* A */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-a-${uniqueId}`}>
              <stop stopColor="#973BED" />
              <stop stopColor="#007CFF" offset="1" />
              <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
            </linearGradient>
          </defs>
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="5" stroke={`url(#ag-a-${uniqueId})`} d="M 14 52 L 32 12 L 50 52 M 20 38 L 44 38" pathLength="360" />
        </svg>

        {/* E */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-e-${uniqueId}`}>
              <stop stopColor="#007CFF" />
              <stop stopColor="#00E0ED" offset="1" />
              <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
            </linearGradient>
          </defs>
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="5" stroke={`url(#ag-e-${uniqueId})`} d="M 46 14 L 18 14 L 18 50 L 46 50 M 18 32 L 40 32" pathLength="360" />
        </svg>

        {/* G */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-g-${uniqueId}`}>
              <stop stopColor="#00E0ED" />
              <stop stopColor="#00DA72" offset="1" />
              <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
            </linearGradient>
          </defs>
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="5" stroke={`url(#ag-g-${uniqueId})`} d="M 46 22 C 43 14, 20 14, 20 32 C 20 50, 43 50, 46 42 L 46 32 L 32 32" pathLength="360" />
        </svg>

        {/* I */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-i-${uniqueId}`}>
              <stop stopColor="#FFC800" />
              <stop stopColor="#FF00FF" offset="1" />
              <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
            </linearGradient>
          </defs>
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="5" stroke={`url(#ag-i-${uniqueId})`} d="M 22 14 L 42 14 M 32 14 L 32 50 M 22 50 L 42 50" pathLength="360" />
        </svg>

        {/* S */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-s-${uniqueId}`}>
              <stop stopColor="#FF00FF" />
              <stop stopColor="#FF7C00" offset="1" />
              <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
            </linearGradient>
          </defs>
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="5" stroke={`url(#ag-s-${uniqueId})`} d="M 44 20 C 44 11, 20 11, 20 26 C 20 41, 44 39, 44 49 C 44 57, 20 57, 20 48" pathLength="360" />
        </svg>

        {/* R */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-r-${uniqueId}`}>
              <stop stopColor="#FF7C00" />
              <stop stopColor="#973BED" offset="1" />
              <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
            </linearGradient>
          </defs>
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="5" stroke={`url(#ag-r-${uniqueId})`} d="M 18 50 L 18 14 L 38 14 C 47 14, 47 30, 38 30 L 18 30 M 32 30 L 46 50" pathLength="360" />
        </svg>

        {/* X */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <defs>
            <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-x-${uniqueId}`}>
              <stop stopColor="#6366F1" />
              <stop stopColor="#10B981" offset="1" />
              <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
            </linearGradient>
          </defs>
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="5" stroke={`url(#ag-x-${uniqueId})`} d="M 16 14 L 48 50 M 48 14 L 16 50" pathLength="360" />
        </svg>
      </div>

      {message && (
        <Text
          className={`aegis-msg ${variant === 'dark' ? 'text-slate-200' : 'text-slate-500'}`}
        >
          {message}
        </Text>
      )}
    </div>
  );
}
