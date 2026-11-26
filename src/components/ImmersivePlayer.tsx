import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePlayerState, usePlayerTime } from '../contexts/PlayerContext';
import { getAlbumByName, getOtherVersions } from '../data/catalogue';
import { Artwork } from './Artwork';
import { albumHref } from './AlbumGrid';
import { Icon } from './Icon';
import { PlaybackControls, Progress, Volume } from './Player';
import { QueueDialog } from './QueueDialog';
import { LyricsPanel } from './LyricsPanel';
import { VinylTurntable } from './VinylTurntable';
import '../styles/player.css';

interface ImmersivePlayerProps {
  onClose: () => void;
  origin: DOMRect | undefined;
  showLyricsInitially: boolean;
}

export function ImmersivePlayer({ onClose, origin, showLyricsInitially }: ImmersivePlayerProps) {
  const { playerState, queueState, favorites, toggleFavorite, playTrack } = usePlayerState();
  const currentTime = usePlayerTime();
  const [showLyrics, setShowLyrics] = useState(showLyricsInitially);
  const [queueOpen, setQueueOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const dialog = useRef<HTMLDialogElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const queueButton = useRef<HTMLButtonElement>(null);
  const versionsRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

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
          { transform: `translate(${x}px,${y}px) scale(${origin.width / target.width})`, opacity: 0.65 },
          { transform: 'none', opacity: 1 },
        ], { duration: 400, easing: 'cubic-bezier(.22, 1, .36, 1)' });
      }
    }
    return () => window.clearTimeout(closeTimer.current);
  }, [origin]);

  useEffect(() => {
    if (!versionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (versionsRef.current && !versionsRef.current.contains(event.target as Node)) {
        setVersionsOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [versionsOpen]);

  const dismiss = useCallback(() => {
    const element = dialog.current;
    if (!element || !element.open || closing) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.close();
      return;
    }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      element.close();
    }, 190);
  }, [closing]);

  const { currentTrack, isPlaying, isLoading, error, duration } = playerState;

  const otherVersions = useMemo(
    () => (currentTrack ? getOtherVersions(currentTrack) : []),
    [currentTrack],
  );

  if (!currentTrack) return null;

  const album = getAlbumByName(currentTrack.albumName);
  const saved = favorites.has(currentTrack.id);
  const status = error ? '播放遇到问题' : isLoading ? '正在加载' : isPlaying ? '正在播放' : '已暂停';
  const trackPosition = queueState.currentIndex + 1;
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <>
      <dialog
        className={`immersive-dialog${showLyrics ? ' is-lyrics' : ''}${closing ? ' is-closing' : ''}${isPlaying && !isLoading && !error ? ' is-playing' : ''}`}
        ref={dialog}
        aria-labelledby="now-playing-title"
        onClose={onClose}
      >
        {album && (
          <div className="player-atmosphere" aria-hidden="true">
            <Artwork album={album} priority decorative />
          </div>
        )}
        <div className="player-shell">
          <header className="player-header">
            <button className="secondary-button" autoFocus onClick={dismiss}>
              <Icon name="down" /><span>收起播放器</span>
            </button>
            <div className="player-header-actions">
              <button
                className="secondary-button"
                aria-pressed={showLyrics}
                aria-controls={showLyrics ? 'player-lyrics' : undefined}
                onClick={() => setShowLyrics((visible) => !visible)}
              >
                <Icon name="lyrics" /><span>歌词</span>
              </button>
              <button
                className="secondary-button"
                ref={queueButton}
                aria-expanded={queueOpen}
                onClick={() => setQueueOpen(true)}
              >
                <Icon name="queue" /><span>播放队列</span>
              </button>
            </div>
          </header>

          <div className={`player-layout ${showLyrics ? 'player-layout-lyrics' : ''}`}>
            <div className="player-stage-column">
              {album && (
                <div className="player-turntable-slot">
                  <VinylTurntable
                    album={album}
                    isPlaying={isPlaying}
                    isLoading={isLoading}
                    hasError={Boolean(error)}
                    progress={progress}
                    coverRef={cover}
                  />
                </div>
              )}

              <div className="player-content">
                <div className="player-title-block">
                  <p className="eyebrow player-status" role="status">
                    <span className={`signal-dot ${isPlaying && !isLoading ? 'signal-playing' : ''}`} />
                    {status}
                    {trackPosition > 0 && (
                      <span className="queue-position">
                        {String(trackPosition).padStart(2, '0')} / {String(queueState.tracks.length).padStart(2, '0')}
                      </span>
                    )}
                  </p>

                  <div className="player-track-identification">
                    {showLyrics && album && <Artwork album={album} className="player-lyrics-cover" decorative />}
                    <div className="player-track-labels">
                      <h2 id="now-playing-title" className="display-title">{currentTrack.name}</h2>
                      <div className="player-meta-row">
                        <a
                          className="text-link player-album"
                          href={albumHref(currentTrack.albumName)}
                          onClick={dismiss}
                        >
                          {currentTrack.albumName}<Icon name="diagonal" />
                        </a>

                        {otherVersions.length > 0 && (
                          <div className="version-switcher" ref={versionsRef}>
                            <button
                              type="button"
                              className="version-switcher-trigger"
                              aria-expanded={versionsOpen}
                              onClick={() => setVersionsOpen((open) => !open)}
                            >
                              其他版本 ({otherVersions.length}) ▾
                            </button>
                            {versionsOpen && (
                              <div className="version-switcher-menu" role="menu">
                                {otherVersions.map((ver) => {
                                  const verAlbum = getAlbumByName(ver.albumName);
                                  return (
                                    <button
                                      key={ver.id}
                                      type="button"
                                      role="menuitem"
                                      className="version-switcher-item"
                                      onClick={() => {
                                        setVersionsOpen(false);
                                        playTrack(ver, verAlbum?.tracks, { restart: true });
                                      }}
                                    >
                                      <strong>{ver.albumName}</strong>
                                      <span>
                                        {verAlbum?.year ? `${verAlbum.year} · ` : ''}
                                        {verAlbum?.category === 'studio' ? '录音室' : verAlbum?.category === 'live' ? '现场' : '珍藏'}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {error && <p className="player-error" role="alert">{error}</p>}
                <Progress />
                <PlaybackControls full />
                <div className="player-utilities">
                  <button
                    className="icon-button favorite-button"
                    aria-pressed={saved}
                    aria-label={`收藏 ${currentTrack.name}`}
                    title={saved ? '取消收藏' : '收藏'}
                    onClick={() => toggleFavorite(currentTrack.id)}
                  >
                    <Icon name="heart" />
                  </button>
                  <Volume />
                </div>
              </div>
            </div>

            <div className={`player-lyrics-slot ${showLyrics ? 'is-visible' : 'is-hidden'}`} aria-hidden={!showLyrics}>
              {showLyrics && <LyricsPanel key={currentTrack.id} track={currentTrack} visible={showLyrics} />}
            </div>
          </div>
        </div>
      </dialog>

      {queueOpen && (
        <QueueDialog
          onClose={() => {
            setQueueOpen(false);
            queueButton.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}
