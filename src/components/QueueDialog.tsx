import { useLayoutEffect, useRef } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { Icon } from './Icon';
import { TrackList } from './TrackList';

export function QueueDialog({ onClose }: { onClose: () => void }) {
  const { queueState } = usePlayer();
  const dialog = useRef<HTMLDialogElement>(null);
  const { tracks, isShuffled } = queueState;
  const firstAlbum = tracks[0]?.albumName;
  const singleAlbum = firstAlbum && tracks.every((track) => track.albumName === firstAlbum) ? firstAlbum : null;

  useLayoutEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  function dismiss() {
    dialog.current?.close();
  }

  return (
    <dialog className="queue-dialog" ref={dialog} aria-labelledby="queue-title" onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
        if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dismiss();
      }}>
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
