import { useEffect, useState } from 'react';

/**
 * Decoupled 60fps playback clock that reads audio.currentTime via rAF
 * ONLY in the component that mounts it (e.g. LyricsPanel, Progress),
 * without pushing 60fps updates into React Context.
 */
export function usePlaybackClock(
  isPlaying: boolean,
  getAudioTime: () => number,
  fallbackTime: number,
  enabled = true,
) {
  const [time, setTime] = useState(fallbackTime);

  useEffect(() => {
    setTime(getAudioTime());
  }, [fallbackTime, getAudioTime]);

  useEffect(() => {
    if (!enabled || !isPlaying) {
      setTime(getAudioTime());
      return;
    }

    let frame = 0;
    const tick = () => {
      setTime(getAudioTime());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, isPlaying, getAudioTime]);

  return time;
}
