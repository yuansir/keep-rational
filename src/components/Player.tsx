import type { CSSProperties } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { formatTime } from '../utils/media';
import { Icon } from './Icon';

export function PlaybackControls({ full = false }: { full?: boolean }) {
  const {
    playerState, queueState, togglePlay, playPrevious, playNext, toggleShuffle, cycleRepeatMode,
  } = usePlayer();
  const { currentIndex, tracks, repeatMode, isShuffled } = queueState;
  const { isPlaying, isLoading, currentTime, error } = playerState;
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
  const { playerState: { currentTime, duration }, seek } = usePlayer();
  const value = duration > 0 ? Math.min(currentTime, duration) : 0;
  const position = duration > 0 ? value / duration : 0;

  return (
    <div className={`progress ${compact ? 'progress-compact' : ''}`}>
      <input className="player-slider progress-slider" type="range" min={0} max={duration || 1} step={1}
        aria-label="播放进度" aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        style={{ '--progress': `${position * 100}%` } as CSSProperties}
        value={value} disabled={duration <= 0} onChange={(event) => seek(event.currentTarget.valueAsNumber)} />
      {!compact && (
        <div className="time-labels" aria-hidden="true"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
      )}
    </div>
  );
}

export function Volume() {
  const { playerState: { isMuted, volume }, toggleMute, setVolume } = usePlayer();
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
