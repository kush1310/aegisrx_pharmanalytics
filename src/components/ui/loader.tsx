import React from 'react';

/**
 * LoaderOne
 *
 * Renders a visually premium, multi-ring gradient animated spinner using Tailwind CSS.
 * It is used throughout the application for background data loading overlay.
 *
 * @param  None
 * @returns {React.ReactElement} - The styled spinner element.
 * @validates - None.
 * @redirects - None.
 * @edge-cases - None.
 */
export function LoaderOne(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center min-h-[120px] w-full">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing ring */}
        <div className="absolute w-16 h-16 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin" />
        {/* Middle pulsing ring */}
        <div className="absolute w-12 h-12 rounded-full border-4 border-violet-500/20 border-b-violet-500 animate-[spin_1.5s_linear_infinite_reverse]" />
        {/* Inner pulsing dot */}
        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-pulse shadow-lg shadow-indigo-500/50" />
      </div>
    </div>
  );
}
