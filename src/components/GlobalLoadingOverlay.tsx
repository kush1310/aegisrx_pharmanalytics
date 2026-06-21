import { createPortal } from 'react-dom';
import { LoaderOne } from './ui/loader';
import { Text } from '@mantine/core';

interface GlobalLoadingOverlayProps {
  /** When true the overlay covers the full screen */
  visible: boolean;
  /** Status message shown beneath the spinner */
  message?: string;
}

/**
 * GlobalLoadingOverlay
 *
 * Renders the branded LoaderOne spinner overlay into document.body via a React Portal.
 * Covers the screen while background data loads, keeping animations smooth.
 *
 * @param  {boolean} visible - Decides whether to mount the portal overlay.
 * @param  {string}  message - Descriptive status text shown below the spinner.
 * @returns {React.ReactPortal | null}
 * @validates - None.
 * @redirects - None.
 * @edge-cases - None.
 */
export default function GlobalLoadingOverlay({
  visible,
  message = 'Loading...',
}: GlobalLoadingOverlayProps) {
  if (!visible) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9998,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        transition:     'opacity 250ms ease',
      }}
    >
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            16,
          padding:        '32px 40px',
          background:     '#ffffff',
          border:         '1px solid #e2e8f0',
          borderRadius:   20,
          boxShadow:      '0 25px 60px rgba(0,0,0,0.18)',
          minWidth:       280,
        }}
      >
        <LoaderOne />
        {message && (
          <Text className="text-slate-500 font-semibold text-xs tracking-wider uppercase animate-pulse mt-2">
            {message}
          </Text>
        )}
      </div>
    </div>,
    document.body
  );
}
