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
 * gradient stroke-dash draw animations, identical to the SelfMadeSystem reference.
 * Each letter sequentially draws and undraws its stroke path using strokeDashoffset
 * keyframe animation. Gradient hues rotate continuously via animateTransform.
 *
 * Always renders centered inside whatever container wraps it.
 * Use inside an absolute-positioned flex container for overlay use.
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
          gap: 6px;
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

      {/* Hidden gradient defs — must be in DOM, positioned out-of-flow */}
      <svg height="0" width="0" viewBox="0 0 64 64" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <defs>
          <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-a-${uniqueId}`}>
            <stop stopColor="#973BED" />
            <stop stopColor="#007CFF" offset="1" />
            <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-e-${uniqueId}`}>
            <stop stopColor="#007CFF" />
            <stop stopColor="#00E0ED" offset="1" />
            <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-g-${uniqueId}`}>
            <stop stopColor="#00E0ED" />
            <stop stopColor="#00DA72" offset="1" />
            <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-i-${uniqueId}`}>
            <stop stopColor="#FFC800" />
            <stop stopColor="#FF00FF" offset="1" />
            <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-s-${uniqueId}`}>
            <stop stopColor="#FF00FF" />
            <stop stopColor="#FF7C00" offset="1" />
            <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-r-${uniqueId}`}>
            <stop stopColor="#FF7C00" />
            <stop stopColor="#973BED" offset="1" />
            <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
          </linearGradient>
          <linearGradient gradientUnits="userSpaceOnUse" y2="0" x2="0" y1="64" x1="0" id={`ag-x-${uniqueId}`}>
            <stop stopColor="#6366F1" />
            <stop stopColor="#10B981" offset="1" />
            <animateTransform repeatCount="indefinite" keySplines=".42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1;.42,0,.58,1" keyTimes="0; 0.125; 0.25; 0.375; 0.5; 0.625; 0.75; 0.875; 1" dur="8s" values="0 32 32;-270 32 32;-270 32 32;-540 32 32;-540 32 32;-810 32 32;-810 32 32;-1080 32 32;-1080 32 32" type="rotate" attributeName="gradientTransform" />
          </linearGradient>
        </defs>
      </svg>

      {/* Letter group — floats up/down as a unit */}
      <div className="aegis-group">
        {/* A */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke={`url(#ag-a-${uniqueId})`} d="M 12 54 L 28 10 L 36 10 L 52 54 L 44 54 L 38 38 L 26 38 L 20 54 Z M 32 20 L 37 32 L 27 32 Z" pathLength="360" />
        </svg>
        {/* E */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke={`url(#ag-e-${uniqueId})`} d="M 48 12 L 16 12 L 16 52 L 48 52 L 48 44 L 24 44 L 24 36 L 40 36 L 40 28 L 24 28 L 24 20 L 48 20 Z" pathLength="360" />
        </svg>
        {/* G */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke={`url(#ag-g-${uniqueId})`} d="M 46 18 A 20 20 0 1 0 46 46 L 46 32 L 32 32 L 32 38 L 40 38 A 12 12 0 1 1 40 24 Z" pathLength="360" />
        </svg>
        {/* I */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke={`url(#ag-i-${uniqueId})`} d="M 20 12 L 44 12 L 44 20 L 36 20 L 36 44 L 44 44 L 44 52 L 20 52 L 20 44 L 28 44 L 28 20 L 20 20 Z" pathLength="360" />
        </svg>
        {/* S */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke={`url(#ag-s-${uniqueId})`} d="M 46 16 C 46 8, 18 8, 18 24 C 18 34, 46 32, 46 42 C 46 50, 26 50, 20 46 L 20 40 C 26 44, 40 44, 40 42 C 40 34, 12 36, 12 24 C 12 14, 32 14, 38 18 Z" pathLength="360" />
        </svg>
        {/* R */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke={`url(#ag-r-${uniqueId})`} d="M 16 54 L 16 12 L 36 12 A 11 11 0 0 1 36 34 L 48 54 L 38 54 L 28 34 L 24 34 L 24 54 Z M 24 20 L 32 20 A 5 5 0 0 1 32 30 L 24 30 Z" pathLength="360" />
        </svg>
        {/* X */}
        <svg className="aegis-letter" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 64 64" height="32" width="32">
          <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="3" stroke={`url(#ag-x-${uniqueId})`} d="M 12 12 L 24 12 L 32 24 L 40 12 L 52 12 L 40 32 L 52 52 L 40 52 L 32 40 L 24 52 L 12 52 L 24 32 Z" pathLength="360" />
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
