import { useEffect, useRef } from 'react';
import type { Track } from '../types';
import { usePlayer } from '../contexts/PlayerContext';
import { getCanonicalSongName, getOtherVersions } from '../data/catalogue';
import { Icon } from './Icon';

interface TrackListProps {
  tracks: Track[];
  showAlbum?: boolean;
  showVersions?: boolean;
  onChoose?: () => void;
  focusTrackId?: string;
}

export function TrackList({ tracks, showAlbum = false, showVersions = true, onChoose, focusTrackId }: TrackListProps) {
  const { playerState, playTrack, togglePlay, favorites, toggleFavorite } = usePlayer();
  const linkedTrackButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focusTrackId) return;
    const frame = requestAnimationFrame(() => {
      linkedTrackButton.current?.focus({ preventScroll: true });
      linkedTrackButton.current?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTrackId]);

  return (
    <ol className="track-list">
      {tracks.map((track, index) => {
        const active = playerState.currentTrack?.id === track.id;
        const playing = active && playerState.isPlaying && !playerState.error;
        const saved = favorites.has(track.id);
        const format = track.url.toLowerCase().endsWith('.flac') ? 'FLAC' : null;
        const otherVersions = showVersions && !onChoose ? getOtherVersions(track) : [];
        const canonicalName = otherVersions.length > 0 ? getCanonicalSongName(track.name) : '';

        return (
          <li key={track.id} className={`track-row ${active ? 'track-active' : ''}`} aria-current={active ? 'true' : undefined}>
            <button
              ref={track.id === focusTrackId ? linkedTrackButton : undefined}
              className="track-main"
              type="button"
              onClick={() => {
                if (active) togglePlay();
                else playTrack(track, onChoose ? undefined : tracks);
                onChoose?.();
              }}
              aria-label={`${playing ? '暂停' : '播放'} ${track.name}`}
            >
              <span className="track-slot" aria-hidden="true">
                <span className="track-slot-num">
                  {playing ? (
                    <span className="eq-bars">
                      <i /><i /><i />
                    </span>
                  ) : (
                    String(index + 1).padStart(2, '0')
                  )}
                </span>
                <Icon className="track-slot-hover" name={playing ? 'pause' : 'play'} />
              </span>
              <span className="track-label">
                <strong>{track.name}</strong>
                {showAlbum && <small>{track.albumName}</small>}
              </span>
              {format && (
                <span className="track-meta-right">
                  <span className="track-format">{format}</span>
                </span>
              )}
            </button>

            <span className="track-row-extra">
              {otherVersions.length > 0 && (
                <a
                  className="track-version-link"
                  href={`#/search/${encodeURIComponent(canonicalName)}`}
                  title={`查看《${canonicalName}》的 ${otherVersions.length + 1} 个录音版本`}
                >
                  <Icon name="versions" />
                  <span>{otherVersions.length + 1} 版</span>
                </a>
              )}
            </span>

            <button
              className="icon-button favorite-button"
              type="button"
              aria-label={`收藏 ${track.name}`}
              aria-pressed={saved}
              title={saved ? '取消收藏' : '收藏'}
              onClick={() => toggleFavorite(track.id)}
            >
              <Icon name="heart" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
