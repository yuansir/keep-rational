import type { LastPlayedEntry, QueueState } from '../types';

const STORAGE_KEYS = {
  FAVORITES: 'lizhi-favorites',
  PLAYBACK_HISTORY: 'lizhi-playback-history',
  VOLUME: 'lizhi-volume',
  QUEUE: 'lizhi-queue',
} as const;

export function getFavoritesList(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    const saved: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(saved)) return [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of saved) {
      if (typeof id === 'string' && !seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
    return ordered;
  } catch {
    return [];
  }
}

export function getFavorites(): Set<string> {
  return new Set(getFavoritesList());
}

export function subscribeFavorites(callback: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEYS.FAVORITES || event.key === null) callback();
  }
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

export function saveFavorites(favorites: Set<string> | string[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.FAVORITES,
      JSON.stringify(Array.from(favorites))
    );
  } catch (error) {
    console.error('Failed to save favorites:', error);
  }
}

export function getPlaybackHistory(trackId: string): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PLAYBACK_HISTORY);
    if (!stored) return 0;
    const history = JSON.parse(stored);
    const position = history[trackId]?.position;
    return typeof position === 'number' && Number.isFinite(position) && position > 0 ? position : 0;
  } catch {
    return 0;
  }
}

export function getLastPlayed(): LastPlayedEntry | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PLAYBACK_HISTORY);
    if (stored) {
      const history = JSON.parse(stored) as Record<string, { position?: unknown; timestamp?: unknown }>;
      let latest: LastPlayedEntry | null = null;
      for (const [trackId, entry] of Object.entries(history)) {
        const position = typeof entry?.position === 'number' && Number.isFinite(entry.position) ? Math.max(0, entry.position) : 0;
        const timestamp = typeof entry?.timestamp === 'number' && Number.isFinite(entry.timestamp) ? entry.timestamp : 0;
        if (timestamp > 0 && (!latest || timestamp > latest.timestamp)) {
          latest = { trackId, position, timestamp };
        }
      }
      if (latest) return latest;
    }
    const queue = getQueue();
    const active = queue?.tracks?.[queue.currentIndex];
    if (active?.id) {
      return { trackId: active.id, position: getPlaybackHistory(active.id), timestamp: 0 };
    }
    return null;
  } catch {
    return null;
  }
}

export function savePlaybackHistory(trackId: string, position: number): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PLAYBACK_HISTORY);
    const history = stored ? JSON.parse(stored) : {};
    history[trackId] = {
      position,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEYS.PLAYBACK_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save playback history:', error);
  }
}

export function getVolume(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.VOLUME);
    const volume = stored === null ? NaN : Number(stored);
    return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.7;
  } catch {
    return 0.7;
  }
}

export function saveVolume(volume: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VOLUME, volume.toString());
  } catch (error) {
    console.error('Failed to save volume:', error);
  }
}

export function getQueue(): (Omit<QueueState, 'originalTracks'> & { originalTracks?: QueueState['tracks'] }) | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.QUEUE);
    const queue = stored ? JSON.parse(stored) : null;
    if (!queue || !Array.isArray(queue.tracks)) return null;
    if (!Array.isArray(queue.originalTracks)) delete queue.originalTracks;
    return queue;
  } catch {
    return null;
  }
}

export function saveQueue(queue: QueueState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to save queue:', error);
  }
}
