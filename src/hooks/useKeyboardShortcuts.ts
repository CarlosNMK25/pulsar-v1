import { useEffect } from 'react';

interface Scene {
  id: string;
  name: string;
}

interface UseKeyboardShortcutsProps {
  handlePlayPause: () => Promise<void>;
  handleStop: () => void;
  handleSceneSelect: (sceneId: string) => void;
  handleSceneCopy: (sceneId: string) => void;
  handleScenePaste: (targetId: string) => void;
  activeScene: string;
  hasClipboard: boolean;
  scenes: Scene[];
  handleUndo?: () => void;
  handleRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const useKeyboardShortcuts = ({
  handlePlayPause,
  handleStop,
  handleSceneSelect,
  handleSceneCopy,
  handleScenePaste,
  activeScene,
  hasClipboard,
  scenes,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
}: UseKeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        await handlePlayPause();
      }
      if (e.code === 'Escape') {
        handleStop();
      }
      if (e.shiftKey && e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''));
        if (num >= 1 && num <= 8) {
          handleSceneSelect(scenes[num - 1].id);
        }
      }
      // Copy/Paste shortcuts
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        handleSceneCopy(activeScene);
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV' && hasClipboard) {
        handleScenePaste(activeScene);
      }
      // Undo/Redo shortcuts
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey && handleUndo && canUndo) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ' && handleRedo && canRedo) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleStop, handleSceneSelect, handleSceneCopy, handleScenePaste, activeScene, hasClipboard, scenes, handleUndo, handleRedo, canUndo, canRedo]);
};
