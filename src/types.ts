export type AlbumCategory = 'studio' | 'live' | 'archive';

export interface Track {
  id: string;
  name: string;
  url: string;
  albumName: string;
}

export interface Album {
  name: string;
  cover: string;
  tracks: Track[];
  year?: number;
  category: AlbumCategory;
  venue?: string;
  linerNote?: string;
}

export interface CuratedPlaylist {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  cover: string;
  tracks: Track[];
}

export interface Catalogue {
  albums: Album[];
  archivedAlbums: Album[];
  totalTracks: number;
  generatedAt: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface QueueState {
  tracks: Track[];
  originalTracks: Track[];
  currentIndex: number;
  isShuffled: boolean;
  repeatMode: 'none' | 'all' | 'one';
}

export interface FavoritesState {
  trackIds: Set<string>;
}

export interface PlaybackHistory {
  trackId: string;
  position: number;
  timestamp: number;
}

export interface LastPlayedEntry {
  trackId: string;
  position: number;
  timestamp: number;
}
