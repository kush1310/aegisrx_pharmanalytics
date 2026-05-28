import { create } from 'zustand';

interface NavigationState {
  history: string[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  navigate: (path: string) => void;
  undo: () => string | null;
  redo: () => string | null;
  reset: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  history: ['/dashboard'],
  currentIndex: 0,
  canUndo: false,
  canRedo: false,

  navigate: (path: string) => {
    const state = get();
    
    // Don't add duplicate consecutive entries
    if (state.history[state.currentIndex] === path) return;

    // Remove any forward history when navigating to new page
    const newHistory = state.history.slice(0, state.currentIndex + 1);
    newHistory.push(path);

    set({
      history: newHistory,
      currentIndex: newHistory.length - 1,
      canUndo: newHistory.length > 1,
      canRedo: false
    });
  },

  undo: () => {
    const state = get();
    if (state.currentIndex <= 0) return null;

    const newIndex = state.currentIndex - 1;
    set({
      currentIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true
    });

    return state.history[newIndex];
  },

  redo: () => {
    const state = get();
    if (state.currentIndex >= state.history.length - 1) return null;

    const newIndex = state.currentIndex + 1;
    set({
      currentIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < state.history.length - 1
    });

    return state.history[newIndex];
  },

  reset: () => {
    set({
      history: ['/dashboard'],
      currentIndex: 0,
      canUndo: false,
      canRedo: false
    });
  }
}));
