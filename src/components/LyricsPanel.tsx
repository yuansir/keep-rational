import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { Track } from '../types';
import { albumByName } from '../data/catalogue';
import { usePlayerState, usePlayerTime } from '../contexts/PlayerContext';
import { usePlaybackClock } from '../hooks/usePlaybackClock';
import {
  decodeLyricFile, findLyrics, knownReference, knownTrackDuration, parseLyrics, readReferenceLyrics,
  type LyricsResult, type LyricText, type Recording,
} from '../utils/lyrics';
import { formatTime } from '../utils/media';
import { exportLyricPoster } from '../utils/lyricPoster';
import { Icon } from './Icon';

type Lookup =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | LyricsResult;

const storageKey = (id: string) => `lizhi-local-lyrics:${id}`;
const SPRING_STIFFNESS = 120;
const SPRING_DAMPING = 22;
const AUTO_RESUME_MS = 4500;

function readImport(id: string) {
  try {
    const text = localStorage.getItem(storageKey(id));
    return text ? parseLyrics(text) : null;
  } catch {
    return null;
  }
}

function messageFor(error: unknown) {
  return error instanceof Error && error.message.startsWith('歌词服务请求过多')
    ? error.message
    : '歌词暂时加载不了，请重试。';
}

export function LyricsPanel({ track, visible = true }: { track: Track; visible?: boolean }) {
  const { playerState, getAudioTime, seek } = usePlayerState();
  const fallbackTime = usePlayerTime();
  const duration = playerState.duration || knownTrackDuration(track.id);
  const lookupDuration = Math.round(duration * 10) / 10;

  const [result, setResult] = useState<Lookup>({ kind: 'loading' });
  const [retry, setRetry] = useState(0);
  const [imported, setImported] = useState<LyricText | null>(() => readImport(track.id));
  const [fileMessage, setFileMessage] = useState('');
  const [reference, setReference] = useState<{ text: LyricText; album: string } | null>(null);
  const [referenceMessage, setReferenceMessage] = useState('');
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [follow, setFollow] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [posterMode, setPosterMode] = useState(false);
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [posterBusy, setPosterBusy] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const fileVersion = useRef(0);
  const referenceRequest = useRef<AbortController | null>(null);
  const autoRefLoadedId = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const activeLine = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const springFrame = useRef<number>(0);
  const springVel = useRef<number>(0);
  const resumeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!lookupDuration || imported) return;
    const request = new AbortController();
    setResult({ kind: 'loading' });
    findLyrics(track, lookupDuration, request.signal)
      .then((value) => { if (!request.signal.aborted) setResult(value); })
      .catch((error: unknown) => {
        if (!request.signal.aborted) setResult({ kind: 'failed', message: messageFor(error) });
      });
    return () => request.abort();
  }, [track, lookupDuration, retry, imported]);

  useEffect(() => () => {
    referenceRequest.current?.abort();
    cancelAnimationFrame(springFrame.current);
    window.clearTimeout(resumeTimer.current);
  }, []);

  // Close popover menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const loadReference = useCallback(async (record: Recording, silent = false) => {
    referenceRequest.current?.abort();
    const request = new AbortController();
    referenceRequest.current = request;
    if (!silent) setReferenceMessage('');
    setReferenceLoading(true);
    try {
      const text = await readReferenceLyrics(record, request.signal);
      if (!request.signal.aborted) {
        if (text) {
          setReference({ text, album: record.albumName });
          setFollow(true);
          scroller.current?.scrollTo({ top: 0, behavior: 'instant' });
        } else if (!silent) {
          setReferenceMessage('参考版本暂时没有可显示的文本。');
        }
      }
    } catch (error) {
      if (!request.signal.aborted && !silent) setReferenceMessage(messageFor(error));
    } finally {
      if (!request.signal.aborted) setReferenceLoading(false);
    }
  }, []);

  // Auto-display reference_only lyrics with a subtle non-blocking pill
  const currentReference = !imported
    ? result.kind === 'missing' ? result.reference : !lookupDuration ? knownReference(track.id) : undefined
    : undefined;

  useEffect(() => {
    if (imported || reference || !currentReference) return;
    if (result.kind !== 'missing') return;
    if (autoRefLoadedId.current === currentReference.id) return;
    autoRefLoadedId.current = currentReference.id;
    void loadReference(currentReference, true);
  }, [imported, reference, currentReference, result.kind, loadReference]);

  const lyrics = imported ?? (result.kind === 'available' ? result.text : reference?.text);
  const isSynced = lyrics?.kind === 'synced';

  // 60fps decoupled playback clock ONLY when synced lyrics are visible & playing
  const liveTime = usePlaybackClock(playerState.isPlaying, getAudioTime, fallbackTime, visible && isSynced);

  const active = useMemo(() => {
    if (!lyrics || lyrics.kind !== 'synced') return -1;
    return lyrics.lines.findLastIndex((line) => line.time <= liveTime);
  }, [lyrics, liveTime]);

  const activeProgress = useMemo(() => {
    if (!lyrics || lyrics.kind !== 'synced' || active < 0) return 0;
    const current = lyrics.lines[active];
    const next = lyrics.lines[active + 1];
    const end = next ? next.time : (duration > current.time ? duration : current.time + 4);
    const span = Math.max(0.4, end - current.time);
    return Math.max(0, Math.min(1, (liveTime - current.time) / span));
  }, [lyrics, active, liveTime, duration]);

  const isInterlude = useMemo(() => {
    if (!lyrics || lyrics.kind !== 'synced') return false;
    if (active === -1) return liveTime > 0.2;
    return !lyrics.lines[active]?.text;
  }, [lyrics, active, liveTime]);

  const cancelSpring = useCallback(() => {
    cancelAnimationFrame(springFrame.current);
    springFrame.current = 0;
    springVel.current = 0;
  }, []);

  // Interruptible rAF spring-damper scroll to active line
  useEffect(() => {
    if (!follow || !visible || !scroller.current) return;
    const container = scroller.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const row = activeLine.current;

    if (!row) {
      if (active === -1) {
        cancelSpring();
        container.scrollTo({ top: 0, behavior: 'instant' });
      }
      return;
    }

    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const rawTarget = container.scrollTop
      + row.getBoundingClientRect().top
      - container.getBoundingClientRect().top
      - (container.clientHeight - row.offsetHeight) * 0.40;
    const targetTop = Math.max(0, Math.min(maxScroll, rawTarget));

    if (reduced || Math.abs(targetTop - container.scrollTop) < 1) {
      cancelSpring();
      container.scrollTop = targetTop;
      return;
    }

    cancelSpring();
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;
      const current = container.scrollTop;
      const displacement = targetTop - current;
      const force = SPRING_STIFFNESS * displacement - SPRING_DAMPING * springVel.current;
      springVel.current += force * dt;
      const nextTop = current + springVel.current * dt;

      if (Math.abs(targetTop - nextTop) < 0.6 && Math.abs(springVel.current) < 4) {
        container.scrollTop = targetTop;
        springVel.current = 0;
        springFrame.current = 0;
        return;
      }
      container.scrollTop = nextTop;
      springFrame.current = requestAnimationFrame(step);
    };

    springFrame.current = requestAnimationFrame(step);
    return cancelSpring;
  }, [active, follow, visible, lyrics, cancelSpring]);

  const scheduleAutoResume = useCallback(() => {
    window.clearTimeout(resumeTimer.current);
    if (posterMode) return;
    resumeTimer.current = window.setTimeout(() => {
      setFollow(true);
    }, AUTO_RESUME_MS);
  }, [posterMode]);

  function pauseFollowing() {
    if (!isSynced) return;
    cancelSpring();
    if (follow) setFollow(false);
    scheduleAutoResume();
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const version = ++fileVersion.current;
    setFileMessage('');
    setMenuOpen(false);
    try {
      const text = await decodeLyricFile(file);
      if (version !== fileVersion.current) return;
      const parsed = parseLyrics(text);
      if (!parsed) {
        setFileMessage('文件里没有可显示的歌词。');
        return;
      }
      setImported(parsed);
      setReference(null);
      setFollow(true);
      scroller.current?.scrollTo({ top: 0, behavior: 'instant' });
      try {
        localStorage.setItem(storageKey(track.id), text);
      } catch {
        setFileMessage('已打开歌词，但浏览器没能保存这份导入。');
      }
    } catch (error) {
      if (version !== fileVersion.current) return;
      setFileMessage(error instanceof Error && error.message.startsWith('歌词文件不能')
        ? error.message : '文件无法读取，请使用 LRC 或文本文件。');
    }
  }

  function removeImport() {
    ++fileVersion.current;
    setMenuOpen(false);
    try {
      localStorage.removeItem(storageKey(track.id));
      setImported(null);
      setFileMessage('');
    } catch {
      setFileMessage('浏览器没能移除这份导入。');
    }
  }

  function togglePosterLine(index: number) {
    setSelectedLines((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= 3) return [...prev.slice(1), index];
      return [...prev, index].sort((a, b) => a - b);
    });
  }

  async function handleExportPoster() {
    if (!lyrics || selectedLines.length === 0 || posterBusy) return;
    const chosen = selectedLines
      .map((i) => (lyrics.kind === 'synced' ? lyrics.lines[i]?.text : lyrics.lines[i]))
      .filter((t): t is string => Boolean(t));
    if (!chosen.length) return;
    setPosterBusy(true);
    try {
      const album = albumByName.get(track.albumName);
      await exportLyricPoster({
        lines: chosen,
        trackName: track.name,
        albumName: track.albumName,
        coverUrl: album?.cover,
      });
      setPosterMode(false);
      setSelectedLines([]);
    } catch {
      setFileMessage('生成歌词卡片失败，请稍后重试。');
    } finally {
      setPosterBusy(false);
    }
  }

  let status = lyrics?.kind === 'synced' ? '逐句同步' : lyrics ? '纯文本' : '';
  if (imported) status = `本地导入 · ${status}`;
  else if (reference && (result.kind === 'missing' || !lookupDuration)) {
    status = `参考版本 · ${reference.album || '专辑未知'}（无时间轴）`;
  }

  return (
    <section
      id="player-lyrics"
      className={`lyrics-panel ${!follow ? 'is-browsing' : ''} ${posterMode ? 'is-poster-mode' : ''}`}
      aria-labelledby="lyrics-heading"
      aria-busy={!!lookupDuration && !lyrics && (result.kind === 'loading' || referenceLoading)}
    >
      <div className="lyrics-top">
        <div className="lyrics-top-left">
          <h3 id="lyrics-heading">歌词</h3>
          {status && <span className="lyrics-mode">{status}</span>}
        </div>
        <div className="lyrics-top-actions" ref={menuRef}>
          {posterMode ? (
            <button
              type="button"
              className="lyrics-pill-btn"
              onClick={() => {
                setPosterMode(false);
                setSelectedLines([]);
              }}
            >
              取消选句
            </button>
          ) : (
            <button
              type="button"
              className="icon-button lyrics-more-btn"
              aria-label="歌词选项"
              aria-expanded={menuOpen}
              title="更多歌词选项"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">···</span>
            </button>
          )}
          {menuOpen && (
            <div className="lyrics-popover" role="menu">
              {lyrics && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setPosterMode(true);
                    setFollow(false);
                    setSelectedLines(active >= 0 ? [active] : [0]);
                  }}
                >
                  制作歌词卡片 (PNG)
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  fileInput.current?.click();
                }}
              >
                导入 LRC / 文本
              </button>
              {imported && (
                <button type="button" role="menuitem" onClick={removeImport}>
                  移除导入
                </button>
              )}
              <a
                role="menuitem"
                href="https://lrclib.net/"
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                LRCLIB 歌词源<Icon name="diagonal" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Always mounted so file import and tests can trigger it cleanly */}
      <input type="file" ref={fileInput} accept=".lrc,.txt,text/plain" hidden onChange={(event) => void importFile(event)} />

      <div
        className="lyrics-scroll"
        ref={scroller}
        tabIndex={lyrics ? 0 : undefined}
        aria-label="歌词正文"
        onWheel={pauseFollowing}
        onTouchMove={pauseFollowing}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget &&
            event.currentTarget.getBoundingClientRect().right - event.clientX <= 20) pauseFollowing();
        }}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget &&
            ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) pauseFollowing();
        }}
      >
        {lyrics?.kind === 'synced' ? (
          <ol className="lyric-lines lyric-synced">
            {isInterlude && (
              <li className="lyric-interlude" aria-hidden="true">
                <span /><span /><span />
              </li>
            )}
            {lyrics.lines.map((line, i) => {
              if (!line.text) return null;
              const dist = active < 0 ? 1 : Math.abs(i - active);
              const distAttr = dist === 0 ? '0' : dist === 1 ? '1' : dist === 2 ? '2' : 'far';
              const stateAttr = active < 0 ? 'upcoming' : i < active ? 'past' : i === active ? 'active' : 'upcoming';
              const isSelected = posterMode && selectedLines.includes(i);
              return (
                <li key={line.time}>
                  <button
                    className={`lyric-line ${isSelected ? 'is-poster-selected' : ''}`}
                    ref={i === active ? activeLine : undefined}
                    data-distance={distAttr}
                    data-state={stateAttr}
                    aria-current={i === active ? 'true' : undefined}
                    disabled={!posterMode && playerState.duration <= 0}
                    style={i === active ? ({ '--line-progress': `${(activeProgress * 100).toFixed(1)}%` } as CSSProperties) : undefined}
                    title={posterMode ? '点击选中或取消这句歌词' : `跳到 ${formatTime(line.time)}`}
                    onClick={() => {
                      if (posterMode) {
                        togglePosterLine(i);
                        return;
                      }
                      window.clearTimeout(resumeTimer.current);
                      setFollow(true);
                      seek(line.time);
                    }}
                  >
                    <span className="lyric-line-text">{line.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : lyrics?.kind === 'plain' ? (
          <div className="lyric-lines lyric-plain">
            {lyrics.lines.map((line, i) => posterMode ? (
              <button
                key={i}
                type="button"
                className={`lyric-plain-selectable ${selectedLines.includes(i) ? 'is-poster-selected' : ''}`}
                onClick={() => togglePosterLine(i)}
              >
                {line}
              </button>
            ) : (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <div className="lyrics-empty">
            <Icon name="lyrics" />
            <p role={result.kind === 'loading' && !playerState.error ? undefined : 'status'}>
              {!lookupDuration && playerState.error ? '音频未加载，暂时无法核对歌词版本。'
                : !lookupDuration ? '正在等待音频时长…'
                : result.kind === 'loading' || referenceLoading ? '正在查找歌词…'
                : result.kind === 'failed' ? result.message
                : result.kind === 'instrumental' ? '这个录音标为纯音乐。'
                : '暂未找到与这版录音匹配的歌词。'}
            </p>
            {result.kind === 'failed' && (
              <button className="secondary-button" onClick={() => setRetry((value) => value + 1)}>重试</button>
            )}
            {currentReference && !referenceLoading && (
              <button className="secondary-button" onClick={() => void loadReference(currentReference)}>
                查看同曲其他版本的歌词
              </button>
            )}
            {referenceMessage && <p role="status">{referenceMessage}</p>}
          </div>
        )}
      </div>

      {!follow && !posterMode && isSynced && (
        <button
          className="lyrics-follow"
          onClick={() => {
            window.clearTimeout(resumeTimer.current);
            setFollow(true);
          }}
        >
          <Icon name="down" />回到当前句
        </button>
      )}

      {posterMode && (
        <div className="lyrics-poster-bar">
          <span>已选 {selectedLines.length} / 3 句</span>
          <button
            type="button"
            className="primary-button compact-button"
            disabled={selectedLines.length === 0 || posterBusy}
            onClick={() => void handleExportPoster()}
          >
            {posterBusy ? '生成中…' : '导出歌词卡片 PNG'}
          </button>
        </div>
      )}

      {fileMessage && <p className="lyrics-file-message" role="status">{fileMessage}</p>}
    </section>
  );
}
