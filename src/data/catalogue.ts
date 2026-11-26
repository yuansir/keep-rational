import data from './catalogue.json';
import type { Album, AlbumCategory, CuratedPlaylist, Track } from '../types';

export const albums: Album[] = data.albums as Album[];
const catalogueAlbums = [...albums, ...data.archivedAlbums as Album[]];
export const albumByName = new Map(catalogueAlbums.map((album) => [album.name, album]));
export const allTracks: Track[] = catalogueAlbums.flatMap((album) => album.tracks);
export const tracksById = new Map(allTracks.map((track) => [track.id, track]));

export function getAlbumByName(name: string): Album | undefined {
  return albumByName.get(name);
}

export function getTrackById(id: string): Track | undefined {
  return tracksById.get(id);
}

export const featured: Album = albumByName.get('1701') ?? albums[0];

export const shelf: Album[] = ['梵高先生', '我爱南京', 'F', '电声与管弦乐', '北京不插电', '看见']
  .map((name) => albumByName.get(name))
  .filter((album): album is Album => album !== undefined);

export const ALBUM_CATEGORY_LABELS: Record<'all' | AlbumCategory, string> = {
  all: '全部',
  studio: '录音室',
  live: '跨年与现场',
  archive: '合集与零碎',
};

const CATEGORY_RANK: Record<AlbumCategory, number> = {
  studio: 0,
  live: 1,
  archive: 2,
};

export function getAlbumsByCategory(category: 'all' | AlbumCategory = 'all'): Album[] {
  const list = category === 'all' ? [...albums] : albums.filter((album) => album.category === category);
  return list.sort((a, b) => {
    const yearDiff = (a.year ?? 9999) - (b.year ?? 9999);
    if (yearDiff !== 0) return yearDiff;
    return CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  });
}

const CANONICAL_TITLE_ALIASES: Record<string, string> = {
  '1990的春天': '1990年的春天',
  '听妈妈讲过去的事情': '听妈妈讲那过去的事情',
  '想起了他': '想起了她',
  '我们不能失去信仰—献给刘艺': '我们不能失去信仰',
  '我和你在一起': '和你在一起',
};

export function getCanonicalSongName(title: string): string {
  const cleaned = title
    .trim()
    .replace(/^李志\s*[-–—:]+\s*/u, '')
    .replace(/\s*[（(][^）)]*[）)]\s*$/gu, '')
    .replace(/\s*(?:20\d{2}(?:\.\d{1,2}\.\d{1,2})?|live|demo)\s*$/iu, '')
    .trim();
  return CANONICAL_TITLE_ALIASES[cleaned] ?? cleaned;
}

const tracksByCanonicalName = new Map<string, Track[]>();
for (const track of allTracks) {
  const canonical = getCanonicalSongName(track.name);
  const bucket = tracksByCanonicalName.get(canonical);
  if (bucket) bucket.push(track);
  else tracksByCanonicalName.set(canonical, [track]);
}

function compareTrackVersions(a: Track, b: Track): number {
  const albumA = albumByName.get(a.albumName);
  const albumB = albumByName.get(b.albumName);
  const rankA = albumA ? CATEGORY_RANK[albumA.category] : 3;
  const rankB = albumB ? CATEGORY_RANK[albumB.category] : 3;
  if (rankA !== rankB) return rankA - rankB;
  return (albumA?.year ?? 9999) - (albumB?.year ?? 9999);
}

for (const list of tracksByCanonicalName.values()) {
  list.sort(compareTrackVersions);
}

export function getOtherVersions(track: Track): Track[] {
  const canonical = getCanonicalSongName(track.name);
  const siblings = tracksByCanonicalName.get(canonical);
  if (!siblings || siblings.length <= 1) return [];
  return siblings.filter((item) => item.id !== track.id);
}

function resolveTracks(ids: string[]): Track[] {
  return ids
    .map((id) => tracksById.get(id))
    .filter((track): track is Track => track !== undefined);
}

export const CURATED_PLAYLISTS: CuratedPlaylist[] = [
  {
    id: 'nanjing-coordinates',
    title: '南京坐标：从山阴路到热河',
    subtitle: '城市记忆 · 8 首',
    description: '沿着山阴路、热河路与应天大街，走一遍南京的四季与夜色。',
    cover: albumByName.get('我爱南京')?.cover ?? featured.cover,
    tracks: resolveTracks([
      'track-215', // 你离开了南京，从此没有人和我说话 (梵高先生)
      'track-29',  // 山阴路的夏天 (F)
      'track-12',  // 热河 (1701)
      'track-147', // 在每一条伤心的应天大街上
      'track-223', // 董卓瑶 (梵高先生)
      'track-219', // 春末的南方城市 (梵高先生)
      'track-205', // 天空之城 (我爱南京)
      'track-199', // 1990年的春天 (我爱南京)
    ]),
  },
  {
    id: 'new-year-symphony',
    title: '跨年之夜：电声与管弦乐',
    subtitle: '交响现场 · 10 首',
    description: '奥体中心灯光亮起，电声乐队与弦乐团共同托起跨年时刻。',
    cover: albumByName.get('电声与管弦乐')?.cover ?? featured.cover,
    tracks: resolveTracks([
      'track-230', // 序曲 (电声与管弦乐)
      'track-232', // 杭州 (电声与管弦乐)
      'track-226', // 墙上的向日葵 (电声与管弦乐)
      'track-228', // 定西 (电声与管弦乐)
      'track-229', // 尽头 (电声与管弦乐)
      'track-224', // 和你在一起 (电声与管弦乐)
      'track-243', // 相信未来序曲 (电声与管弦乐II)
      'track-242', // 山阴路的夏天 (相信未来版)
      'track-239', // 天空之城 (相信未来版)
      'track-244', // 这个世界会好吗 (相信未来版)
    ]),
  },
  {
    id: 'unplugged-soliloquy',
    title: '木吉他与独白：不插电精选',
    subtitle: '原声现场 · 8 首',
    description: '卸下失真与宏大编排，在糖果三层听清每一根琴弦的呼吸。',
    cover: albumByName.get('北京不插电')?.cover ?? featured.cover,
    tracks: resolveTracks([
      'track-140', // 黑色信封 (北京不插电)
      'track-131', // 大象 (北京不插电)
      'track-132', // 定西 (北京不插电)
      'track-135', // 杭州 (北京不插电)
      'track-130', // 关于郑州的记忆 (北京不插电)
      'track-133', // 山阴路的夏天 (北京不插电)
      'track-136', // 热河 (北京不插电)
      'track-138', // 这个世界会好吗 (北京不插电)
    ]),
  },
  {
    id: 'road-334',
    title: '334 公路夜行',
    subtitle: '远行歌单 · 8 首',
    description: '从郑州、杭州到定西与喀纳斯，适合深夜独自开车或赶路时听。',
    cover: albumByName.get('你好，郑州')?.cover ?? featured.cover,
    tracks: resolveTracks([
      'track-92',  // 关于郑州的记忆 (你好，郑州)
      'track-10',  // 定西 (1701)
      'track-31',  // 杭州 (F)
      'track-267', // 喀纳斯 (这个世界会好吗)
      'track-263', // 交河 (这个世界会好吗)
      'track-145', // 克兰河 (在每一条伤心的应天大街上)
      'track-285', // 公路之光 (零碎)
      'track-222', // 梵高先生 (梵高先生)
    ]),
  },
];
