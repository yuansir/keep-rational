import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerState, QueueState, Track } from '../types';
import { allTracks, albumByName, tracksById } from '../data/catalogue';
import { mediaSources } from '../utils/media';
import { getPlaybackHistory, getQueue, getVolume, savePlaybackHistory, saveQueue, saveVolume } from '../utils/storage';

function readQueue(): QueueState {
  const saved = getQueue();
  const resolve = (tracks: Track[]) => [...new Set(tracks.map((track) => track?.id))]
    .map((id) => tracksById.get(id))
    .filter((track): track is Track => track !== undefined);
  const tracks = resolve(saved?.tracks ?? []);
  const active = saved?.tracks[saved.currentIndex]?.id;
  const currentIndex = Math.max(tracks.findIndex((track) => track.id === active), tracks.length ? 0 : -1);
  const isShuffled = saved?.isShuffled === true;
  const originalTracks = isShuffled ? resolve(saved?.originalTracks ?? allTracks.filter((track) => tracks.includes(track))) : tracks;

  return {
    tracks, currentIndex, originalTracks, isShuffled,
    repeatMode: saved?.repeatMode === 'one' || saved?.repeatMode === 'all' ? saved.repeatMode : 'none',
  };
}

function shuffledAfterCurrent(tracks: Track[], current: Track) {
  const remainder = tracks.filter((track) => track.id !== current.id);
  for (let index = remainder.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [remainder[index], remainder[swap]] = [remainder[swap], remainder[index]];
  }
  return [current, ...remainder];
}

export function useAudioPlayer() {
  const [queueState, setQueueState] = useState(readQueue);
  const queue = useRef(queueState);
  const [playerState, setPlayerState] = useState<PlayerState>(() => {
    const currentTrack = queueState.tracks[queueState.currentIndex] ?? null;
    return {
      currentTrack, isPlaying: false, currentTime: currentTrack ? getPlaybackHistory(currentTrack.id) : 0,
      duration: 0, volume: getVolume(), isMuted: false, isLoading: false, error: null,
    };
  });
  const track = useRef(playerState.currentTrack);
  const position = useRef(playerState.currentTime);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedTrackId = useRef<string | null>(null);
  const source = useRef({ urls: [] as string[], index: 0 });
  const pendingPosition = useRef(0);
  const wantsPlayback = useRef(false);
  const watchdog = useRef<number | undefined>(undefined);
  const lastSavedAt = useRef(0);
  const mountedVolume = useRef(playerState.volume);

  const update = useCallback((changes: Partial<PlayerState>) => {
    setPlayerState((previous) => ({ ...previous, ...changes }));
  }, []);

  const commitQueue = useCallback((next: QueueState) => {
    queue.current = next;
    if (audioRef.current) audioRef.current.loop = next.repeatMode === 'one';
    setQueueState(next);
    saveQueue(next);
  }, []);

  const persistPosition = useCallback(() => {
    if (track.current) savePlaybackHistory(track.current.id, position.current);
  }, []);

  const clearWatchdog = useCallback(() => {
    window.clearTimeout(watchdog.current);
    watchdog.current = undefined;
  }, []);

  const requestPlayback = useCallback((audio: HTMLAudioElement) => {
    const requestedSource = audio.src;
    void audio.play().catch((error: DOMException) => {
      if (error.name === 'AbortError' || audio.src !== requestedSource || !wantsPlayback.current) return;
      // The media error event owns source fallback, including rejected unsupported sources.
      if (audio.error || error.name === 'NotSupportedError') return;
      wantsPlayback.current = false;
      clearWatchdog();
      update({ error: '播放未能开始，请再试一次。', isPlaying: false, isLoading: false });
    });
  }, [clearWatchdog, update]);

  const loadSource = useCallback((audio: HTMLAudioElement) => {
    const url = source.current.urls[source.current.index];
    if (!url) return;
    audio.src = url;
    audio.load();
    if (wantsPlayback.current) requestPlayback(audio);
  }, [requestPlayback]);

  const startTrack = useCallback((next: Track, restart = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    clearWatchdog();
    persistPosition();
    track.current = next;
    loadedTrackId.current = next.id;
    wantsPlayback.current = true;
    source.current = { urls: mediaSources(next.url), index: 0 };
    pendingPosition.current = restart ? 0 : getPlaybackHistory(next.id);
    position.current = pendingPosition.current;
    lastSavedAt.current = performance.now();
    update({
      currentTrack: next, isPlaying: false, currentTime: position.current, duration: 0,
      isLoading: true, error: null,
    });
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      const cover = albumByName.get(next.albumName)?.cover;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: next.name, artist: '李志', album: next.albumName,
        artwork: cover ? [{ src: cover }] : [],
      });
    }
    loadSource(audio);
  }, [clearWatchdog, loadSource, persistPosition, update]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    const current = track.current;
    if (!audio || !current) return;
    if (audio.error || loadedTrackId.current !== current.id) {
      startTrack(current);
      return;
    }
    if (audio.ended) audio.currentTime = 0;
    wantsPlayback.current = true;
    update({ error: null, isLoading: audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA });
    requestPlayback(audio);
  }, [requestPlayback, startTrack, update]);

  const pause = useCallback(() => {
    wantsPlayback.current = false;
    clearWatchdog();
    audioRef.current?.pause();
    persistPosition();
    update({ isPlaying: false, isLoading: false });
  }, [clearWatchdog, persistPosition, update]);

  const togglePlay = useCallback(() => {
    if (wantsPlayback.current) pause();
    else play();
  }, [pause, play]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0 || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.min(audio.duration, Math.max(0, seconds));
    position.current = audio.currentTime;
    update({ currentTime: position.current });
    persistPosition();
  }, [persistPosition, update]);

  const playTrack = useCallback((next: Track, playlist?: Track[], options?: { restart?: boolean }) => {
    const state = queue.current;
    const original = playlist?.length ? playlist : state.originalTracks;
    const nextOriginal = original.some((item) => item.id === next.id) ? original : [next];
    const sameContext = state.originalTracks.length === nextOriginal.length &&
      state.originalTracks.every((item, index) => item.id === nextOriginal[index].id);
    const order = sameContext ? state.tracks : state.isShuffled ? shuffledAfterCurrent(nextOriginal, next) : nextOriginal;
    commitQueue({
      ...state, tracks: order, originalTracks: nextOriginal,
      currentIndex: order.findIndex((item) => item.id === next.id),
    });
    startTrack(next, options?.restart);
  }, [commitQueue, startTrack]);

  const move = useCallback((offset: number, auto = false) => {
    const state = queue.current;
    if (!state.tracks.length) return;
    const target = state.currentIndex + offset;
    const index = state.repeatMode === 'all'
      ? (target + state.tracks.length) % state.tracks.length : target;
    const next = state.tracks[index];
    if (!next) {
      if (auto) pause();
      return;
    }
    commitQueue({ ...state, currentIndex: index });
    startTrack(next, true);
  }, [commitQueue, pause, startTrack]);

  const playNext = useCallback(() => move(1), [move]);
  const playPrevious = useCallback(() => {
    if (position.current > 3) seek(0);
    else move(-1);
  }, [move, seek]);

  const toggleShuffle = useCallback(() => {
    const state = queue.current;
    const current = track.current;
    if (!current) return;
    const tracks = state.isShuffled ? state.originalTracks : shuffledAfterCurrent(state.originalTracks, current);
    commitQueue({
      ...state, tracks, isShuffled: !state.isShuffled,
      currentIndex: tracks.findIndex((item) => item.id === current.id),
    });
  }, [commitQueue]);

  const cycleRepeatMode = useCallback(() => {
    const state = queue.current;
    const repeatMode = state.repeatMode === 'none' ? 'all' : state.repeatMode === 'all' ? 'one' : 'none';
    commitQueue({ ...state, repeatMode });
  }, [commitQueue]);

  const setVolume = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    const audio = audioRef.current;
    if (!audio) return;
    const volume = Math.max(0, Math.min(1, value));
    audio.volume = volume;
    if (audio.muted && volume > 0) audio.muted = false;
    update({ volume, isMuted: audio.muted });
    saveVolume(volume);
  }, [update]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
      update({ isMuted: audio.muted });
    }
  }, [update]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.loop = queue.current.repeatMode === 'one';
    audio.volume = mountedVolume.current;
    audio.id = 'lizhi-audio-player';
    document.body.appendChild(audio);
    audioRef.current = audio;

    function recoverSource() {
      clearWatchdog();
      if (!track.current || !audio.getAttribute('src')) return;
      if (source.current.index + 1 < source.current.urls.length) {
        source.current.index++;
        pendingPosition.current = position.current;
        update({ isPlaying: false, isLoading: wantsPlayback.current });
        loadSource(audio);
      } else {
        wantsPlayback.current = false;
        loadedTrackId.current = null;
        audio.pause();
        update({ error: '音源暂时不可用，请重试或换一首。', isPlaying: false, isLoading: false });
      }
    }

    function armWatchdog() {
      clearWatchdog();
      if (wantsPlayback.current) watchdog.current = window.setTimeout(recoverSource, 14000);
    }

    function updateTime() {
      if (audio.readyState < HTMLMediaElement.HAVE_METADATA || audio.ended) return;
      position.current = audio.currentTime;
      update({ currentTime: position.current });
      if (performance.now() - lastSavedAt.current >= 2500) {
        persistPosition();
        lastSavedAt.current = performance.now();
      }
    }

    function metadata() {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const resume = pendingPosition.current;
      if (resume > 0 && resume < duration - 2) audio.currentTime = resume;
      pendingPosition.current = 0;
      position.current = audio.currentTime;
      update({ duration, currentTime: position.current });
    }

    function canPlay() {
      clearWatchdog();
      update({ isLoading: false });
    }

    function waiting() {
      if (!wantsPlayback.current) return;
      update({ isLoading: true });
      armWatchdog();
    }

    function playing() {
      clearWatchdog();
      update({ isPlaying: true, isLoading: false, error: null });
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    }

    function paused() {
      if (!audio.paused || audio.ended) return;
      if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        wantsPlayback.current = false;
        clearWatchdog();
        persistPosition();
      }
      update({ isPlaying: false, isLoading: wantsPlayback.current });
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }

    function ended() {
      position.current = 0;
      persistPosition();
      update({ currentTime: audio.duration, isPlaying: false });
      move(1, true);
    }

    const events = {
      timeupdate: updateTime, loadedmetadata: metadata, durationchange: () => {
        if (Number.isFinite(audio.duration)) update({ duration: audio.duration });
      },
      loadstart: armWatchdog, canplay: canPlay, waiting, playing, pause: paused, ended, error: recoverSource,
    };
    for (const [type, handler] of Object.entries(events)) audio.addEventListener(type, handler);
    window.addEventListener('pagehide', persistPosition);

    const mediaActions = { play, pause, previoustrack: playPrevious, nexttrack: playNext };
    function setMediaActions(register: boolean) {
      if (!('mediaSession' in navigator)) return;
      for (const [action, handler] of Object.entries(mediaActions)) {
        try {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, register ? handler : null);
        } catch {
          // Support for individual Media Session actions varies by platform.
        }
      }
    }
    setMediaActions(true);

    return () => {
      clearWatchdog();
      for (const [type, handler] of Object.entries(events)) audio.removeEventListener(type, handler);
      window.removeEventListener('pagehide', persistPosition);
      setMediaActions(false);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.remove();
      audioRef.current = null;
    };
  }, [clearWatchdog, loadSource, move, pause, persistPosition, play, playNext, playPrevious, update]);

  const getAudioTime = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.readyState >= HTMLMediaElement.HAVE_METADATA && Number.isFinite(audio.currentTime)) {
      return audio.currentTime;
    }
    return position.current;
  }, []);

  return {
    playerState, queueState, getAudioTime, togglePlay, seek, setVolume, toggleMute,
    playTrack, playNext, playPrevious, toggleShuffle, cycleRepeatMode,
  };
}
