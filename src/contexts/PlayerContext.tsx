import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { getFavorites, saveFavorites, subscribeFavorites } from '../utils/storage';

type PlayerContextType = ReturnType<typeof useAudioPlayer> & {
  favorites: Set<string>;
  toggleFavorite: (trackId: string) => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer();
  const [favorites, setFavorites] = useState(getFavorites);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => subscribeFavorites(() => setFavorites(getFavorites())), []);

  function toggleFavorite(trackId: string) {
    setFavorites((previous) => {
      const updated = new Set(previous);
      if (updated.has(trackId)) updated.delete(trackId);
      else updated.add(trackId);
      return updated;
    });
  }

  return <PlayerContext.Provider value={{ ...player, favorites, toggleFavorite }}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used within PlayerProvider');
  return value;
}
