import { useState, useEffect, useCallback } from 'react';

export type DockState = 'hidden' | 'mini' | 'expanded';

export interface UILayoutState {
  // Panels
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  dockState: DockState;
  
  // Collapsible sections
  generatorsOpen: boolean;
  processingOpen: boolean;
  controlOpen: boolean;
  
  // Dock tab
  activeDockTab: string;
}

const STORAGE_KEY = 'pulsar_ui_layout';

const defaultState: UILayoutState = {
  leftPanelOpen: false,
  rightPanelOpen: false,
  dockState: 'hidden',
  generatorsOpen: true,
  processingOpen: true,
  controlOpen: true,
  activeDockTab: 'mixer',
};

export const useUILayout = () => {
  const [state, setState] = useState<UILayoutState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaultState, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load UI layout state:', e);
    }
    return defaultState;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save UI layout state:', e);
    }
  }, [state]);

  // Panel toggles
  const toggleLeftPanel = useCallback(() => {
    setState(prev => ({ ...prev, leftPanelOpen: !prev.leftPanelOpen }));
  }, []);

  const toggleRightPanel = useCallback(() => {
    setState(prev => ({ ...prev, rightPanelOpen: !prev.rightPanelOpen }));
  }, []);

  // Dock state cycling: hidden -> mini -> expanded -> hidden
  const cycleDockState = useCallback(() => {
    setState(prev => {
      const nextState: DockState = 
        prev.dockState === 'hidden' ? 'mini' :
        prev.dockState === 'mini' ? 'expanded' : 'hidden';
      return { ...prev, dockState: nextState };
    });
  }, []);

  const setDockState = useCallback((dockState: DockState) => {
    setState(prev => ({ ...prev, dockState }));
  }, []);

  // Section toggles
  const toggleGenerators = useCallback(() => {
    setState(prev => ({ ...prev, generatorsOpen: !prev.generatorsOpen }));
  }, []);

  const toggleProcessing = useCallback(() => {
    setState(prev => ({ ...prev, processingOpen: !prev.processingOpen }));
  }, []);

  const toggleControl = useCallback(() => {
    setState(prev => ({ ...prev, controlOpen: !prev.controlOpen }));
  }, []);

  // Dock tab
  const setActiveDockTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, activeDockTab: tab }));
  }, []);

  return {
    ...state,
    toggleLeftPanel,
    toggleRightPanel,
    cycleDockState,
    setDockState,
    toggleGenerators,
    toggleProcessing,
    toggleControl,
    setActiveDockTab,
  };
};
