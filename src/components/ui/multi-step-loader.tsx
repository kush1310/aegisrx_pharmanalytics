import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IconCheck, IconLoader2 } from '@tabler/icons-react';

interface LoadingState {
  text: string;
}

interface MultiStepLoaderProps {
  loadingStates: LoadingState[];
  loading?: boolean;
  onComplete?: () => void;
}

/**
 * MultiStepLoader
 *
 * Displays a multi-step sequential loading animation, representing system progress.
 * Cycles through a list of text phrases with animated checkmarks and loading states.
 * Uses a React Portal to mount to document.body, ensuring a full-screen overlay above everything.
 *
 * @param  {LoadingState[]} loadingStates - List of progress steps/texts.
 * @param  {boolean}        loading       - Triggers visibility and interval timer.
 * @param  {function}       onComplete    - Callback triggered after all steps are checked and animation finishes.
 * @returns {React.ReactPortal | null}
 * @validates - Ensures step index stays within bounds of the loadingStates array.
 * @redirects - None.
 * @edge-cases - If backend completes early, it preserves the 3-second minimum duration.
 *             - If backend is slow, it hangs on the last step until loading is false.
 */
export function MultiStepLoader({
  loadingStates,
  loading = false,
  onComplete,
}: MultiStepLoaderProps): React.ReactPortal | null {
  const [checkedCount, setCheckedCount] = useState(0);
  const [isVisible, setIsVisible] = useState(loading);
  const totalSteps = loadingStates.length;
  
  // Keep refs to avoid effect dependencies issues
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  
  useEffect(() => {
    if (loading) {
      setIsVisible(true);
      setCheckedCount(0);
    }
  }, [loading]);

  useEffect(() => {
    if (!isVisible) return;

    let stepTimer: NodeJS.Timeout;
    const intervalMs = 500; // 3 seconds / 6 steps = 500ms

    const runStep = () => {
      setCheckedCount((prev) => {
        // If we are at the last step (index totalSteps - 1, which means prev === totalSteps - 1)
        if (prev === totalSteps - 1) {
          // We wait until backend loading is done
          if (loadingRef.current) {
            // Backend is still running, check again in 200ms
            stepTimer = setTimeout(runStep, 200);
            return prev;
          } else {
            // Backend is done, check off the last step after a small delay
            stepTimer = setTimeout(() => {
              setCheckedCount(totalSteps);
              // Wait another 500ms so the user sees all items checked, then complete!
              stepTimer = setTimeout(() => {
                setIsVisible(false);
                if (onComplete) onComplete();
              }, 500);
            }, 500);
            return prev;
          }
        }
        
        // Normal progression: check off next step
        stepTimer = setTimeout(runStep, intervalMs);
        return prev + 1;
      });
    };

    // Start progression
    stepTimer = setTimeout(runStep, intervalMs);

    return () => clearTimeout(stepTimer);
  }, [isVisible, totalSteps, onComplete]);

  if (!isVisible) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="relative max-w-xl w-full mx-4 p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col justify-start"
        >
          <div className="flex flex-col gap-6">
            {loadingStates.map((state, index) => {
              const isCompleted = index < checkedCount;
              const isActive = index === checkedCount;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`flex items-start gap-4 transition-colors duration-300 ${
                    isActive ? 'text-indigo-400 font-semibold' : isCompleted ? 'text-slate-400 font-medium' : 'text-slate-600'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30"
                      >
                        <IconCheck size={12} strokeWidth={3} />
                      </motion.div>
                    ) : isActive ? (
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                        <IconLoader2 size={12} className="animate-spin" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-700 bg-slate-800/40" />
                    )}
                  </div>
                  <div className="text-sm leading-tight">{state.text}</div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
