import type { Track } from '../types';
import { usePlayer } from '../contexts/PlayerContext';
import { Icon } from './Icon';

interface TrackListProps {
  tracks: Track[];
  showAlbum?: boolean;
  onChoose?: () => void;
}

export function TrackList({ tracks, showAlbum = false, onChoose }: TrackListProps) {
  const { playerState, playTrack, togglePlay, favorites, toggleFavorite } = usePlayer();

  return (
    <ol className="track-list">
      {tracks.map((track, index) => {
        const active = playerState.currentTrack?.id === track.id;
        const playing = active && playerState.isPlaying && !playerState.error;
        const saved = favorites.has(track.id);
        const format = track.url.toLowerCase().endsWith('.flac') ? 'FLAC' : null;

        return (
          <li key={track.id} className={`track-row ${active ? 'track-active' : ''}`} aria-current={active ? 'true' : undefined}>
            <button className="track-main" type="button" onClick={() => {
              if (active) togglePlay();
              else playTrack(track, onChoose ? undefined : tracks);
              onChoose?.();
            }} aria-label={`${playing ? '暂停' : '播放'} ${track.name}`}>
              <span className="track-number" aria-hidden="true">
                {playing ? <Icon name="bars" /> : String(index + 1).padStart(2, '0')}
              </span>
              <Icon className="track-action" name={playing ? 'pause' : 'play'} />
              <span className="track-label">
                <strong>{track.name}</strong>
                {showAlbum && <small>{track.albumName}</small>}
              </span>
              {format && <span className="track-format">{format}</span>}
            </button>
            <button className="icon-button favorite-button" type="button"
              aria-label={`收藏 ${track.name}`} aria-pressed={saved} title={saved ? '取消收藏' : '收藏'}
              onClick={() => toggleFavorite(track.id)}>
              <Icon name="heart" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
