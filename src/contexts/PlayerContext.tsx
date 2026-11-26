import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { getFavorites, saveFavorites, subscribeFavorites } from '../utils/storage';
import type { PlayerState } from '../types';

type AudioPlayerReturn = ReturnType<typeof useAudioPlayer>;

export type PlayerStableState = Omit<PlayerState, 'currentTime'>;

type PlayerStateContextType = Omit<AudioPlayerReturn, 'playerState'> & {
  playerState: PlayerStableState;
  favorites: Set<string>;
  toggleFavorite: (trackId: string) => void;
};

type PlayerContextType = AudioPlayerReturn & {
  favorites: Set<string>;
  toggleFavorite: (trackId: string) => void;
};

const PlayerStateContext = createContext<PlayerStateContextType | null>(null);
const PlayerTimeContext = createContext<number>(0);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const {
    playerState,
    queueState,
    getAudioTime,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    playTrack,
    playNext,
    playPrevious,
    toggleShuffle,
    cycleRepeatMode,
  } = useAudioPlayer();

  const [favorites, setFavorites] = useState(getFavorites);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => subscribeFavorites(() => setFavorites(getFavorites())), []);

  const toggleFavorite = useCallback((trackId: string) => {
    setFavorites((previous) => {
      const updated = new Set(previous);
      if (updated.has(trackId)) updated.delete(trackId);
      else updated.add(trackId);
      return updated;
    });
  }, []);

  const {
    currentTrack,
    isPlaying,
    duration,
    volume,
    isMuted,
    isLoading,
    error,
    currentTime,
  } = playerState;

  const stablePlayerState = useMemo<PlayerStableState>(
    () => ({ currentTrack, isPlaying, duration, volume, isMuted, isLoading, error }),
    [currentTrack, isPlaying, duration, volume, isMuted, isLoading, error],
  );

  const stableValue = useMemo<PlayerStateContextType>(
    () => ({
      playerState: stablePlayerState,
      queueState,
      getAudioTime,
      togglePlay,
      seek,
      setVolume,
      toggleMute,
      playTrack,
      playNext,
      playPrevious,
      toggleShuffle,
      cycleRepeatMode,
      favorites,
      toggleFavorite,
    }),
    [
      stablePlayerState,
      queueState,
      getAudioTime,
      togglePlay,
      seek,
      setVolume,
      toggleMute,
      playTrack,
      playNext,
      playPrevious,
      toggleShuffle,
      cycleRepeatMode,
      favorites,
      toggleFavorite,
    ],
  );

  return (
    <PlayerStateContext.Provider value={stableValue}>
      <PlayerTimeContext.Provider value={currentTime}>
        {children}
      </PlayerTimeContext.Provider>
    </PlayerStateContext.Provider>
  );
}

/**
 * Subscribe to playback/queue/favorites state WITHOUT re-rendering on every timeupdate tick.
 */
export function usePlayerState(): PlayerStateContextType {
  const value = useContext(PlayerStateContext);
  if (!value) throw new Error('usePlayerState must be used within PlayerProvider');
  return value;
}

/**
 * Subscribe only to coarse currentTime updates (~4Hz from timeupdate).
 */
export function usePlayerTime(): number {
  return useContext(PlayerTimeContext);
}

/**
 * Backwards-compatible hook combining stable state + currentTime.
 */
export function usePlayer(): PlayerContextType {
  const stable = usePlayerState();
  const currentTime = usePlayerTime();
  return useMemo(
    () => ({
      ...stable,
      playerState: { ...stable.playerState, currentTime },
    }),
    [stable, currentTime],
  );
}
