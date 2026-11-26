import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { usePlayerState } from '../contexts/PlayerContext';
import { Icon } from './Icon';
import { TrackList } from './TrackList';

export function QueueDialog({ onClose }: { onClose: () => void }) {
  const { queueState } = usePlayerState();
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const { tracks, isShuffled } = queueState;
  const firstAlbum = tracks[0]?.albumName;
  const singleAlbum = firstAlbum && tracks.every((track) => track.albumName === firstAlbum) ? firstAlbum : null;

  useLayoutEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    return () => window.clearTimeout(closeTimer.current);
  }, []);

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
    }, 185);
  }, [closing]);

  return (
    <dialog
      className={`queue-dialog ${closing ? 'is-closing' : ''}`}
      ref={dialog}
      aria-labelledby="queue-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
        if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dismiss();
      }}
    >
      <div className="queue-panel">
        <header className="queue-header">
          <div>
            <h2 id="queue-title">播放队列</h2>
            <p>{singleAlbum && `${singleAlbum} · `}{tracks.length} 首 · {isShuffled ? '随机播放' : '按顺序播放'}</p>
          </div>
          <button className="icon-button" aria-label="关闭播放队列" autoFocus onClick={dismiss}><Icon name="close" /></button>
        </header>
        <TrackList tracks={tracks} showAlbum={!singleAlbum} onChoose={dismiss} />
      </div>
    </dialog>
  );
}
