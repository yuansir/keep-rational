import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { usePlayerState, usePlayerTime } from '../contexts/PlayerContext';
import { usePlaybackClock } from '../hooks/usePlaybackClock';
import { formatTime } from '../utils/media';
import { Icon } from './Icon';

export function PlaybackControls({ full = false }: { full?: boolean }) {
  const {
    playerState, queueState, togglePlay, playPrevious, playNext, toggleShuffle, cycleRepeatMode,
  } = usePlayerState();
  const currentTime = usePlayerTime();
  const { currentIndex, tracks, repeatMode, isShuffled } = queueState;
  const { isPlaying, isLoading, error } = playerState;
  const toggled = (isPlaying || isLoading) && !error;
  const repeatTitle = { none: '关闭', all: '队列循环', one: '单曲循环' }[repeatMode];

  return (
    <div className={`playback-controls ${full ? 'controls-full' : ''}`} role="group" aria-label="播放控制">
      {full && (
        <button className="icon-button mode-button" aria-label="随机播放" aria-pressed={isShuffled}
          title={isShuffled ? '关闭随机播放' : '开启随机播放'} onClick={toggleShuffle}>
          <Icon name="shuffle" />
        </button>
      )}
      <button className="icon-button previous-button" aria-label="上一首" title="上一首"
        disabled={currentTime <= 3 && currentIndex <= 0 && repeatMode !== 'all'} onClick={playPrevious}>
        <Icon name="previous" />
      </button>
      <button className="icon-button transport-play" aria-label={error ? '重试播放' : toggled ? '暂停' : '播放'}
        title={error ? '重试播放' : toggled ? '暂停' : '播放'} onClick={togglePlay}>
        <Icon name={toggled ? 'pause' : 'play'} />
      </button>
      <button className="icon-button next-button" aria-label="下一首" title="下一首"
        disabled={currentIndex >= tracks.length - 1 && repeatMode !== 'all'} onClick={playNext}>
        <Icon name="next" />
      </button>
      {full && (
        <button className="icon-button mode-button" aria-label={`循环播放：${repeatTitle}`}
          data-active={repeatMode !== 'none'} title={`循环播放：${repeatTitle}`} onClick={cycleRepeatMode}>
          <Icon name={repeatMode === 'one' ? 'repeatOne' : 'repeat'} />
        </button>
      )}
    </div>
  );
}

export function Progress({ compact = false }: { compact?: boolean }) {
  const { playerState: { duration, isPlaying }, getAudioTime, seek } = usePlayerState();
  const fallbackTime = usePlayerTime();
  const liveTime = usePlaybackClock(isPlaying, getAudioTime, fallbackTime, true);

  const [dragValue, setDragValue] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<{ time: number; percent: number } | null>(null);
  const isPointerDown = useRef(false);
  const latestDrag = useRef<number | null>(null);

  const displayTime = dragValue !== null ? dragValue : liveTime;
  const value = duration > 0 ? Math.min(displayTime, duration) : 0;
  const position = duration > 0 ? value / duration : 0;

  function commitDrag() {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    const target = latestDrag.current;
    latestDrag.current = null;
    setDragValue(null);
    if (target !== null) seek(target);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (duration <= 0) return;
    const base = getAudioTime();
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      seek(Math.min(duration, base + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      seek(Math.max(0, base - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      seek(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      seek(duration);
    }
  }

  const tooltip = dragValue !== null
    ? { time: dragValue, percent: duration > 0 ? (dragValue / duration) * 100 : 0 }
    : hoverTime;

  return (
    <div className={`progress ${compact ? 'progress-compact' : ''} ${dragValue !== null ? 'is-scrubbing' : ''}`}>
      <div className="progress-track-wrap">
        {!compact && tooltip && duration > 0 && (
          <span
            className="progress-tooltip"
            style={{ left: `${Math.max(4, Math.min(96, tooltip.percent))}%` }}
            aria-hidden="true"
          >
            {formatTime(tooltip.time)}
          </span>
        )}
        <input
          className="player-slider progress-slider"
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          aria-label="播放进度"
          aria-valuetext={`${formatTime(displayTime)} / ${formatTime(duration)}`}
          style={{ '--progress': `${position * 100}%` } as CSSProperties}
          value={value}
          disabled={duration <= 0}
          onKeyDown={handleKeyDown}
          onPointerDown={(event) => {
            if (duration <= 0) return;
            isPointerDown.current = true;
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            const next = ratio * duration;
            latestDrag.current = next;
            setDragValue(next);
          }}
          onPointerMove={(event) => {
            if (duration <= 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
            setHoverTime({ time: ratio * duration, percent: ratio * 100 });
          }}
          onPointerLeave={() => setHoverTime(null)}
          onPointerUp={commitDrag}
          onPointerCancel={commitDrag}
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (isPointerDown.current) {
              latestDrag.current = next;
              setDragValue(next);
            } else {
              seek(next);
            }
          }}
        />
      </div>
      {!compact && (
        <div className="time-labels" aria-hidden="true">
          <span>{formatTime(displayTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}

export function Volume() {
  const { playerState: { isMuted, volume }, toggleMute, setVolume } = usePlayerState();
  const value = isMuted ? 0 : volume;
  return (
    <div className="volume-control">
      <button className="icon-button" aria-label={isMuted ? '取消静音' : '静音'} title={isMuted ? '取消静音' : '静音'}
        onClick={toggleMute}><Icon name={isMuted || volume === 0 ? 'mute' : 'volume'} /></button>
      <input className="player-slider" type="range" min={0} max={1} step={0.01}
        aria-label="音量" aria-valuetext={`${Math.round(value * 100)}%`} value={value}
        style={{ '--progress': `${value * 100}%` } as CSSProperties}
        onChange={(event) => setVolume(event.currentTarget.valueAsNumber)} />
    </div>
  );
}
