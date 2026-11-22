import data from './catalogue.json';
import type { Album } from '../types';

export const albums: Album[] = data.albums;
export const albumByName = new Map(albums.map((album) => [album.name, album]));
export const allTracks = albums.flatMap((album) => album.tracks);
export const featured = albumByName.get('1701') ?? albums[0];
export const shelf = ['F', '我爱南京', '梵高先生', '被禁忌的游戏', '8', '看见']
  .map((name) => albumByName.get(name))
  .filter((album): album is Album => album !== undefined);
