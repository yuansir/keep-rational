import type { Track } from '../types';
import index from '../data/lyrics-index.json';

const LRCLIB = 'https://lrclib.net';
const client = 'Keep-Rational/1.0 (Li Zhi listening room)';
const maxDurationDrift = 2;
const timeTag = /^\[(\d{1,4}):([0-5]?\d)(?:[.:](\d{1,3}))?\]/;
const inlineTimeTag = /<\d{1,4}:[0-5]?\d(?:[.:]\d{1,3})?>/g;
const metadataTag = /^\[(?:ar|ti|al|au|by|offset|length|re|ve|id|tool):[^\]]*\]$/i;
export const maxLyricBytes = 128 * 1024;

type LyricLine = { time: number; text: string };
export type LyricText = { kind: 'synced'; lines: LyricLine[] } | { kind: 'plain'; lines: string[] };

export type Recording = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  hasSyncedLyrics?: boolean;
  hasPlainLyrics?: boolean;
};

type LyricPayload = Recording & { syncedLyrics?: string | null; plainLyrics?: string | null };
type RecordingIdentity = { name: string; albumName: string; artistName?: string };
type LyricTrack = Track & { artistName?: string };
type IndexEntry = { duration?: number; identity?: RecordingIdentity; exact?: Recording; reference?: Recording };
const catalogueLyrics: Partial<Record<string, IndexEntry>> = index;

export type LyricsResult =
  | { kind: 'available'; text: LyricText }
  | { kind: 'instrumental' }
  | { kind: 'missing'; reference?: Recording };

type CacheEntry = { result: LyricsResult; expires: number };
const lookupCache = new Map<string, CacheEntry>();
let retryAfter = 0;

const traditional = {
  關: '关', 鄭: '郑', 記: '记', 憶: '忆', 陽: '阳', 陰: '阴', 臺: '台', 燈: '灯',
  說: '说', 見: '见', 愛: '爱', 遠: '远', 離: '离', 鳥: '鸟', 動: '动', 靜: '静',
  廣: '广', 場: '场', 門: '门', 電: '电', 樂: '乐', 國: '国', 鐘: '钟',
  綫: '线', 線: '线', 夢: '梦', 著: '着', 對: '对', 幾: '几', 個: '个',
  風: '风', 劍: '剑', 歷: '历', 輕: '轻', 讓: '让', 頭: '头', 還: '还', 兒: '儿',
  響: '响', 飛: '飞', 歡: '欢', 裏: '里', 裡: '里', 時: '时', 網: '网', 羅: '罗',
  體: '体', 東: '东', 沒: '没', 鉛: '铅', 筆: '笔', 牆: '墙',
  來: '来', 闊: '阔', 貴: '贵', 醫: '医', 鐵: '铁', 後: '后', 聲: '声', 會: '会',
  灣: '湾', 陸: '陆', 義: '义', 贊: '赞', 傳: '传', 機: '机', 為: '为',
  寶: '宝', 無: '无', 貓: '猫', 麗: '丽', 劉: '刘', 藝: '艺', 媽: '妈',
  講: '讲', 過: '过', 嫻: '娴', 這: '这', 麼: '么', 話: '话', 訴: '诉',
  華: '华', 寫: '写', 結: '结', 淚: '泪', 藍: '蓝', 單: '单', 獨: '独', 醜: '丑',
} as Record<string, string>;

function fold(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\u3400-\u9fff]/g, (letter) => traditional[letter] ?? letter);
}

function identity(value: string) {
  return fold(value).replace(/[\p{P}\p{Z}\p{S}]/gu, '');
}

function titleKey(value: string) {
  return identity(fold(value)
    .replace(/^李志\s*[-–—:]+\s*/u, '')
    .replace(/\s*[-–—]+\s*李志$/u, '')
    .replace(/\s*(?:\(|\[)(?:feat\.?\s|live\b|\d{4}.*(?:live|现场|版|unplugged)|现场|录音室|unplugged|相信未来版)[^)\]]*(?:\)|\])\s*$/giu, ''));
}

function albumKey(value: string) {
  return identity(fold(value)
    .replace(/^(?:专辑[\s-]*|李志[\s、·,-]+)/u, '')
    .replace(/\s*(?:\(|\[)(?:普通版|(?:\d{4}\s*)?live\b|现场版)[^)\]]*(?:\)|\])\s*$/giu, ''));
}

function translatedKey(raw: string) {
  return fold(raw).match(/^[a-z][^([]*\(([㐀-鿿][^)]*)\)/u)?.[1];
}

const albumAliases: Record<string, string[]> = {
  '北京不插电': [
    '李志北京不插电现场', '李志北京不插电现场(2016现场版)', '北京不插电现场',
    '李志北京不插电现场 2016 Live', '北京不插电现场.2016', '李志北京不插电现场 2016.5.29',
  ],
  '看见': ['看见2015', '看见2015(live)', '看见2015北京站'],
  '家': ['李志、电声与管弦乐', '电声与管弦乐'],
  '二零零九年十月十六日事件': ['二零零九年十月十六日事件现场录音', '2009我爱南京首发现场'],
  '电声与管弦乐': ['李志电声与管弦乐', '李志、电声与管弦乐'],
  '电声与管弦乐ii': ['李志电声与管弦乐ii', '李志、电声与管弦乐ii', '电声与管弦乐2'],
  '勾三搭四': ['勾三搭四(2013 live)', '勾三搭四2013'],
  'imagine2011': ['imagine', 'imagine live', 'imagine.2011跨年', 'imagine2011李志跨年音乐会', 'imagine2011跨年音乐会'],
  'io': ['i/o2014跨年音乐会', 'io2014', 'i/o.2014跨年', 'i/o跨年音乐会', 'i/o跨年音乐会[数字版]'],
};

function sameAlbum(track: Track, record: Recording) {
  const key = albumKey(track.albumName);
  const recordKey = albumKey(translatedKey(record.albumName) ?? record.albumName);
  return recordKey === key || albumAliases[key]?.some((alias) => albumKey(alias) === recordKey) === true;
}

function sameSong(track: LyricTrack, record: Recording) {
  const artist = fold(record.artistName).trim();
  const firstName = artist.split(/[、/,;&＋+·（(]/u)[0].trim();
  const firstArtist = track.artistName && track.artistName !== '李志'
    ? identity(firstName) === identity(track.artistName)
    : /^(?:李志|li\s*zhi)(?=$|[\s,、/;&＋+·（(及与])/u.test(artist);
  const title = record.trackName.trim().replace(/^\d+\.\d+\./, '');
  const translated = translatedKey(title);
  const target = titleKey(track.name);
  return firstArtist && (target === titleKey(title) || (!!translated && target === titleKey(translated)));
}

function hasText(record: Recording) {
  return record.hasPlainLyrics === true || record.hasSyncedLyrics === true;
}

export function selectRecordings(track: LyricTrack, duration: number, records: Recording[]) {
  const same = records.filter((record) => sameSong(track, record));
  const exact = same
    .filter((record) => sameAlbum(track, record) && Math.abs(record.duration - duration) <= maxDurationDrift)
    .sort((a, b) => {
      const quality = (record: Recording) => record.hasSyncedLyrics ? 3 : record.hasPlainLyrics ? 2 : record.instrumental ? 1 : 0;
      return quality(b) - quality(a) ||
        Math.abs(a.duration - duration) - Math.abs(b.duration - duration);
    })
    .find((record) => hasText(record) || record.instrumental);
  const reference = same
    .filter((record) => record.id !== exact?.id && !record.instrumental && hasText(record))
    .sort((a, b) => Number(sameAlbum(track, b)) - Number(sameAlbum(track, a)) ||
      Math.abs(a.duration - duration) - Math.abs(b.duration - duration))[0];
  return { exact, reference };
}

export function knownTrackDuration(id: string) {
  return catalogueLyrics[id]?.duration ?? 0;
}

export function knownReference(id: string) {
  return catalogueLyrics[id]?.reference;
}

export function parseLyrics(raw: string): LyricText | null {
  const offsetMs = Number(raw.match(/^\s*\[offset\s*:\s*([+-]?\d+)\s*\]\s*$/im)?.[1] ?? 0);
  const offset = Number.isFinite(offsetMs) ? Math.max(-60, Math.min(60, offsetMs / 1000)) : 0;
  const timed: LyricLine[] = [];
  const plain: string[] = [];

  for (const original of raw.replace(/^\uFEFF/, '').split(/\r\n?|\n/)) {
    let line = original.trim();
    if (!line || metadataTag.test(line)) continue;
    const stamps: number[] = [];
    for (let tag = line.match(timeTag); tag; tag = line.match(timeTag)) {
      const fraction = tag[3] ? Number(`0.${tag[3]}`) : 0;
      stamps.push(Math.max(0, Number(tag[1]) * 60 + Number(tag[2]) + fraction + offset));
      line = line.slice(tag[0].length).trimStart();
    }
    line = line.replace(inlineTimeTag, '').trim();
    if (stamps.length > 0) {
      for (const time of stamps) timed.push({ time, text: line });
    } else if (line) {
      plain.push(line);
    }
  }

  if (timed.some((line) => line.text)) {
    const grouped = new Map<number, Set<string>>();
    for (const { time, text } of timed) {
      const texts = grouped.get(time) ?? new Set<string>();
      if (text) texts.add(text);
      grouped.set(time, texts);
    }
    return {
      kind: 'synced',
      lines: [...grouped].sort(([a], [b]) => a - b)
        .map(([time, texts]) => ({ time, text: [...texts].join('\n') })),
    };
  }
  return plain.length ? { kind: 'plain', lines: plain } : null;
}

export async function decodeLyricFile(file: File) {
  if (file.size > maxLyricBytes) throw new Error('歌词文件不能大于 128 KB。');
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('gb18030', { fatal: true }).decode(buffer);
  }
}

async function fetchRecord<T>(path: string, signal: AbortSignal): Promise<T | null> {
  if (Date.now() < retryAfter) throw new Error('歌词服务请求过多，请稍后再试。');
  const timeout = typeof AbortSignal.timeout === 'function' && typeof AbortSignal.any === 'function'
    ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
    : signal;
  const response = await fetch(`${LRCLIB}${path}`, {
    signal: timeout,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Lrclib-Client': client },
  });
  if (response.status === 404) return null;
  if (response.status === 429) {
    const delay = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
    retryAfter = Date.now() + (Number.isFinite(delay) ? Math.max(1, delay) : 30) * 1000;
    throw new Error('歌词服务请求过多，请稍后再试。');
  }
  if (!response.ok) throw new Error('歌词暂时加载不了。');
  return response.json() as Promise<T>;
}

function textFromPayload(payload: LyricPayload) {
  return (typeof payload.syncedLyrics === 'string' ? parseLyrics(payload.syncedLyrics) : null) ??
    (typeof payload.plainLyrics === 'string' ? parseLyrics(payload.plainLyrics) : null);
}

function isRecording(value: Recording) {
  return value && Number.isSafeInteger(value.id) && typeof value.trackName === 'string' &&
    typeof value.artistName === 'string' && typeof value.albumName === 'string' && Number.isFinite(value.duration);
}

async function readExact(track: LyricTrack, duration: number, recording: Recording, signal: AbortSignal) {
  const payload = await fetchRecord<LyricPayload>(`/api/get/${recording.id}`, signal);
  if (!payload || !isRecording(payload) || !sameSong(track, payload) || !sameAlbum(track, payload) ||
    Math.abs(payload.duration - duration) > maxDurationDrift) return null;
  if (payload.instrumental) return { kind: 'instrumental' } as const;
  const text = textFromPayload(payload);
  return text ? { kind: 'available', text } as const : null;
}

export async function findLyrics(track: Track, duration: number, signal: AbortSignal): Promise<LyricsResult> {
  const cacheKey = `${track.id}:${Math.round(duration)}`;
  const cached = lookupCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.result;

  const saved = catalogueLyrics[track.id];
  const recordingIdentity = saved?.identity ? { ...track, ...saved.identity } : track;
  let result: LyricsResult | null = null;
  if (saved?.exact && Math.abs(saved.exact.duration - duration) <= maxDurationDrift) {
    result = await readExact(recordingIdentity, duration, saved.exact, signal);
  }

  if (!result) {
    const params = new URLSearchParams({ track_name: recordingIdentity.name, artist_name: saved?.identity?.artistName ?? '李志' });
    const response = await fetchRecord<Recording[]>(`/api/v2/search?${params}`, signal);
    const records = (Array.isArray(response) ? response : []).filter(isRecording);
    const remaining = records.filter((record) => record.id !== saved?.exact?.id);
    const picked = selectRecordings(recordingIdentity, duration, remaining);
    result = picked.exact ? await readExact(recordingIdentity, duration, picked.exact, signal) : null;
    result ??= { kind: 'missing', reference: picked.reference ?? saved?.reference };
  }

  lookupCache.set(cacheKey, {
    result,
    expires: Date.now() + (result.kind === 'missing' ? 5 * 60 * 1000 : 60 * 60 * 1000),
  });
  return result;
}

export async function readReferenceLyrics(recording: Recording, signal: AbortSignal): Promise<LyricText | null> {
  const payload = await fetchRecord<LyricPayload>(`/api/get/${recording.id}`, signal);
  if (!payload || !isRecording(payload) || payload.id !== recording.id) return null;
  const text = textFromPayload(payload);
  if (!text || text.kind === 'plain') return text;
  return { kind: 'plain', lines: text.lines.map((line) => line.text).filter(Boolean) };
}
