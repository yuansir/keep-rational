import { usePlayer } from '../contexts/PlayerContext';
import { albumByName } from '../data/catalogue';
import { formatTime } from '../utils/media';
import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { PlaybackControls, Progress } from './Player';

export function MiniPlayer({ onExpand }: { onExpand: (button: HTMLButtonElement, mode?: 'queue' | 'lyrics') => void }) {
  const { playerState } = usePlayer();
  const { currentTrack, isPlaying, isLoading, error, currentTime, duration } = playerState;
  if (!currentTrack) return null;

  const album = albumByName.get(currentTrack.albumName);
  const status = error ? '音源暂不可用' : isLoading ? '音源加载中…' : currentTrack.albumName;

  return (
    <section className="mini-player" aria-label="底部播放器">
      <Progress compact />
      <div className="shell mini-inner">
        <button className="mini-track" aria-label={`展开播放器 · ${currentTrack.name}`}
          onClick={(event) => onExpand(event.currentTarget)}>
          {album && <Artwork album={album} decorative />}
          <span className="mini-track-text">
            <strong>{currentTrack.name}</strong>
            <small role={error ? 'status' : undefined}>{status}</small>
          </span>
          <Icon className="mini-expand-hint" name={isPlaying ? 'bars' : 'expand'} />
        </button>
        <PlaybackControls />
        <div className="mini-end">
          <span className="mini-time" aria-hidden="true">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <button className="icon-button mini-lyrics" aria-label="打开歌词" title="歌词"
            onClick={(event) => onExpand(event.currentTarget, 'lyrics')}><Icon name="lyrics" /></button>
          <button className="icon-button" aria-label="打开播放队列" title="播放队列"
            onClick={(event) => onExpand(event.currentTarget, 'queue')}><Icon name="queue" /></button>
        </div>
      </div>
    </section>
  );
}
