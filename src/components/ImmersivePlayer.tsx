import { useLayoutEffect, useRef, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { albumByName } from '../data/catalogue';
import { Artwork } from './Artwork';
import { albumHref } from './AlbumGrid';
import { Icon } from './Icon';
import { PlaybackControls, Progress, Volume } from './Player';
import { QueueDialog } from './QueueDialog';
import { LyricsPanel } from './LyricsPanel';

interface ImmersivePlayerProps {
  onClose: () => void;
  origin: DOMRect | undefined;
  showLyricsInitially: boolean;
}

export function ImmersivePlayer({ onClose, origin, showLyricsInitially }: ImmersivePlayerProps) {
  const { playerState, queueState, favorites, toggleFavorite } = usePlayer();
  const [showLyrics, setShowLyrics] = useState(showLyricsInitially);
  const [queueOpen, setQueueOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const queueButton = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    element.showModal();
    const art = cover.current;
    if (art && origin && origin.width > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const target = art.getBoundingClientRect();
      if (target.width > 0) {
        const x = origin.x + origin.width / 2 - target.x - target.width / 2;
        const y = origin.y + origin.height / 2 - target.y - target.height / 2;
        art.animate([
          { transform: `translate(${x}px,${y}px) scale(${origin.width / target.width})`, opacity: 0.6 },
          { transform: 'none', opacity: 1 },
        ], { duration: 380, easing: 'cubic-bezier(.2,.72,.25,1)' });
      }
    }
  }, [origin]);

  const { currentTrack, isPlaying, isLoading, error } = playerState;
  if (!currentTrack) return null;

  const album = albumByName.get(currentTrack.albumName);
  const saved = favorites.has(currentTrack.id);
  const status = error ? '播放遇到问题' : isLoading ? '正在加载' : isPlaying ? '正在播放' : '已暂停';
  const trackPosition = queueState.currentIndex + 1;

  return (
    <>
      <dialog className={`immersive-dialog${showLyrics ? ' is-lyrics' : ''}`} ref={dialog} aria-labelledby="now-playing-title" onClose={onClose}>
        {album && <div className="player-atmosphere" aria-hidden="true"><Artwork album={album} priority decorative /></div>}
        <div className="player-shell">
          <header className="player-header">
            <button className="secondary-button" autoFocus onClick={() => dialog.current?.close()}>
              <Icon name="down" /><span>收起播放器</span>
            </button>
            <div className="player-header-actions">
              <button className="secondary-button" aria-pressed={showLyrics} aria-controls={showLyrics ? 'player-lyrics' : undefined}
                onClick={() => setShowLyrics((visible) => !visible)}><Icon name="lyrics" /><span>歌词</span></button>
              <button className="secondary-button" ref={queueButton} aria-expanded={queueOpen}
                onClick={() => setQueueOpen(true)}><Icon name="queue" /><span>播放队列</span></button>
            </div>
          </header>
          <div className={`player-layout ${showLyrics ? 'player-layout-lyrics' : ''}`}>
            {showLyrics ? <LyricsPanel key={currentTrack.id} track={currentTrack} /> : (
              <div className="player-art" ref={cover}>{album && <Artwork album={album} priority />}</div>
            )}
            <div className="player-content">
              <div className="player-title-block">
                <p className="eyebrow player-status" role="status">
                  <span className={`signal-dot ${isPlaying && !isLoading ? 'signal-playing' : ''}`} />
                  {status}
                  {trackPosition > 0 && <span className="queue-position">{String(trackPosition).padStart(2, '0')} / {String(queueState.tracks.length).padStart(2, '0')}</span>}
                </p>
                <div className="player-track-identification">
                  {showLyrics && album && <Artwork album={album} className="player-lyrics-cover" decorative />}
                  <div className="player-track-labels">
                    <h2 id="now-playing-title" className="display-title">{currentTrack.name}</h2>
                    <a className="text-link player-album" href={albumHref(currentTrack.albumName)}
                      onClick={() => dialog.current?.close()}>{currentTrack.albumName}<Icon name="diagonal" /></a>
                  </div>
                </div>
              </div>

              {error && <p className="player-error" role="alert">{error}</p>}
              <Progress />
              <PlaybackControls full />
              <div className="player-utilities">
                <button className="icon-button favorite-button" aria-pressed={saved}
                  aria-label={`收藏 ${currentTrack.name}`} title={saved ? '取消收藏' : '收藏'}
                  onClick={() => toggleFavorite(currentTrack.id)}><Icon name="heart" /></button>
                <Volume />
              </div>
            </div>
          </div>
        </div>
      </dialog>

      {queueOpen && <QueueDialog onClose={() => {
        setQueueOpen(false);
        queueButton.current?.focus({ preventScroll: true });
      }} />}
    </>
  );
}
