import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Track } from '../types';
import { usePlayer } from '../contexts/PlayerContext';
import { decodeLyricFile, findLyrics, knownReference, knownTrackDuration, parseLyrics, readReferenceLyrics,
  type LyricsResult, type LyricText, type Recording } from '../utils/lyrics';
import { formatTime } from '../utils/media';
import { Icon } from './Icon';

type Lookup =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | LyricsResult;

const storageKey = (id: string) => `lizhi-local-lyrics:${id}`;

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

export function LyricsPanel({ track }: { track: Track }) {
  const { playerState, seek } = usePlayer();
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
  const fileInput = useRef<HTMLInputElement>(null);
  const fileVersion = useRef(0);
  const referenceRequest = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const activeLine = useRef<HTMLButtonElement>(null);

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

  useEffect(() => () => referenceRequest.current?.abort(), []);

  const lyrics = imported ?? (result.kind === 'available' ? result.text : reference?.text);
  const active = lyrics?.kind === 'synced'
    ? lyrics.lines.findLastIndex((line) => line.time <= playerState.currentTime)
    : -1;

  useEffect(() => {
    if (!follow || !scroller.current) return;
    const container = scroller.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const row = activeLine.current;
    if (!row) {
      if (active === -1) container.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const top = container.scrollTop + row.getBoundingClientRect().top - container.getBoundingClientRect().top
      - (container.clientHeight - row.offsetHeight) * 0.44;
    container.scrollTo({ top, behavior: reduced ? 'instant' : 'smooth' });
  }, [active, follow, lyrics]);

  function pauseFollowing() {
    if (!follow || lyrics?.kind !== 'synced') return;
    const container = scroller.current;
    if (container) container.scrollTo({ top: container.scrollTop, behavior: 'instant' });
    setFollow(false);
  }

  async function loadReference(record: Recording) {
    referenceRequest.current?.abort();
    const request = new AbortController();
    referenceRequest.current = request;
    setReferenceMessage('');
    setReferenceLoading(true);
    try {
      const text = await readReferenceLyrics(record, request.signal);
      if (!request.signal.aborted) {
        if (text) {
          setReference({ text, album: record.albumName });
          setFollow(true);
          scroller.current?.scrollTo({ top: 0, behavior: 'instant' });
        } else {
          setReferenceMessage('参考版本暂时没有可显示的文本。');
        }
      }
    } catch (error) {
      if (!request.signal.aborted) setReferenceMessage(messageFor(error));
    } finally {
      if (!request.signal.aborted) setReferenceLoading(false);
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const version = ++fileVersion.current;
    setFileMessage('');
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
    try {
      localStorage.removeItem(storageKey(track.id));
      setImported(null);
      setFileMessage('');
    } catch {
      setFileMessage('浏览器没能移除这份导入。');
    }
  }

  const currentReference = !imported
    ? result.kind === 'missing' ? result.reference : !lookupDuration ? knownReference(track.id) : undefined
    : undefined;
  let status = lyrics?.kind === 'synced' ? '逐句同步' : lyrics ? '纯文本' : '';
  if (imported) status = `本地导入 · ${status}`;
  else if (reference && (result.kind === 'missing' || !lookupDuration)) status = `参考版本 · ${reference.album || '专辑未知'}`;

  return (
    <section id="player-lyrics" className="lyrics-panel" aria-labelledby="lyrics-heading"
      aria-busy={!!lookupDuration && !lyrics && result.kind === 'loading'}>
      <div className="lyrics-top">
        <h3 id="lyrics-heading">歌词</h3>
        {status && <span className="lyrics-mode">{status}</span>}
        {lyrics?.kind === 'synced' && <span className="lyrics-seek-hint">点一句跳转</span>}
      </div>

      <div className="lyrics-scroll" ref={scroller} tabIndex={lyrics ? 0 : undefined}
        aria-label="歌词正文" onWheel={pauseFollowing} onTouchMove={pauseFollowing}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget &&
            event.currentTarget.getBoundingClientRect().right - event.clientX <= 20) pauseFollowing();
        }}
        onKeyDown={(event) => {
          if (event.target === event.currentTarget &&
            ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) pauseFollowing();
        }}>
        {lyrics?.kind === 'synced' ? (
          <ol className="lyric-lines lyric-synced">
            {lyrics.lines.map((line, i) => line.text ? (
              <li key={line.time}>
                <button className="lyric-line" ref={i === active ? activeLine : undefined}
                  aria-current={i === active ? 'true' : undefined} disabled={playerState.duration <= 0}
                  title={`跳到 ${formatTime(line.time)}`} onClick={() => {
                    setFollow(true);
                    seek(line.time);
                  }}>{line.text}</button>
              </li>
            ) : null)}
          </ol>
        ) : lyrics?.kind === 'plain' ? (
          <div className="lyric-lines lyric-plain">{lyrics.lines.map((line, i) => <p key={i}>{line}</p>)}</div>
        ) : (
          <div className="lyrics-empty">
            <Icon name="lyrics" />
            <p role={result.kind === 'loading' && !playerState.error ? undefined : 'status'}>{!lookupDuration && playerState.error ? '音频未加载，暂时无法核对歌词版本。'
              : !lookupDuration ? '正在等待音频时长…'
              : result.kind === 'loading' ? '正在查找歌词…'
              : result.kind === 'failed' ? result.message
              : result.kind === 'instrumental' ? '这个录音标为纯音乐。'
              : '暂未找到与这版录音匹配的歌词。'}</p>
            {result.kind === 'failed' && <button className="secondary-button" onClick={() => setRetry((value) => value + 1)}>重试</button>}
            {currentReference && <button className="secondary-button" disabled={referenceLoading}
              onClick={() => void loadReference(currentReference)}>
              {referenceLoading ? '正在加载参考版本…' : '查看同曲其他版本的歌词'}
            </button>}
            {referenceMessage && <p role="status">{referenceMessage}</p>}
          </div>
        )}
      </div>

      {!follow && lyrics?.kind === 'synced' && (
        <button className="lyrics-follow" onClick={() => setFollow(true)}>
          <Icon name="down" />回到当前句
        </button>
      )}

      <div className="lyrics-footer">
        <input type="file" ref={fileInput} accept=".lrc,.txt,text/plain" hidden onChange={(event) => void importFile(event)} />
        <button className="text-link" onClick={() => fileInput.current?.click()}>导入 LRC / 文本</button>
        {imported ? <button className="text-link" onClick={removeImport}>移除导入</button>
          : <a className="text-link" href="https://lrclib.net/" target="_blank" rel="noreferrer">LRCLIB<Icon name="diagonal" /></a>}
      </div>
      {fileMessage && <p className="lyrics-file-message" role="status">{fileMessage}</p>}
    </section>
  );
}
