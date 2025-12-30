import { useState, useCallback } from 'react';
import { TextureMode } from '@/audio/TextureEngine';
import { defaultTextureParams, defaultTextureMode } from '@/constants/initialState';

export interface TextureParams {
  density: number;
  spread: number;
  pitch: number;
  size: number;
  feedback: number;
  mix: number;
}

export interface TextureState {
  textureMuted: boolean;
  textureMode: TextureMode;
  textureParams: TextureParams;
}

export const useTextureState = () => {
  const [textureMuted, setTextureMuted] = useState(false);
  const [textureMode, setTextureMode] = useState<TextureMode>(defaultTextureMode);
  const [textureParams, setTextureParams] = useState<TextureParams>(defaultTextureParams);

  const toggleTextureMute = useCallback(() => {
    setTextureMuted(prev => !prev);
  }, []);

  // Batch setter for scene loading
  const setAllTextureState = useCallback((state: Partial<TextureState>) => {
    if (state.textureMuted !== undefined) setTextureMuted(state.textureMuted);
    if (state.textureMode !== undefined) setTextureMode(state.textureMode);
    if (state.textureParams !== undefined) setTextureParams(state.textureParams);
  }, []);

  return {
    textureMuted,
    setTextureMuted,
    textureMode,
    setTextureMode,
    textureParams,
    setTextureParams,
    toggleTextureMute,
    setAllTextureState,
  };
};

export type UseTextureStateReturn = ReturnType<typeof useTextureState>;
