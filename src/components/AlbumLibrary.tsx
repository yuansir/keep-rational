import { useState } from 'react';
import { allTracks, albums } from '../data/catalogue';
import { AlbumGrid } from './AlbumGrid';
import { TrackList } from './TrackList';
import { Icon } from './Icon';

export function AlbumLibrary({ query = '' }: { query?: string }) {
  const [filter, setFilter] = useState<'all' | 'tracks' | 'albums'>('all');
  const value = query.trim().toLocaleLowerCase();
  const searching = value.length > 0;
  const matches = (text: string) => text.toLocaleLowerCase().includes(value);
  const matchingAlbums = searching ? albums.filter((album) => matches(album.name)) : albums;
  const matchingTracks = searching ? allTracks.filter((track) => matches(track.name)) : [];
  const count = matchingTracks.length + matchingAlbums.length;

  return (
    <section className="shell collection-page page-enter" aria-labelledby="collection-title">
      <div className="collection-header">
        <h1 id="collection-title" className="display-title">{searching ? '搜索结果' : '音乐库'}</h1>
        <p className="subtle">{searching ? `「${query.trim()}」 · ${count} 项结果` : `${albums.length} 张专辑 · ${allTracks.length} 首曲目`}</p>
      </div>
      {!searching ? <AlbumGrid albums={matchingAlbums} /> : count === 0 ? (
        <div className="empty-state">
          <Icon name="search" /><h2>没有找到匹配结果</h2><p>可以换个歌名或专辑名试试。</p>
          <a className="secondary-button" href="#/library">浏览全部专辑</a>
        </div>
      ) : (
        <>
          <div className="result-filters" role="group" aria-label="筛选搜索结果">
            <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>全部 · {count}</button>
            <button aria-pressed={filter === 'tracks'} onClick={() => setFilter('tracks')}>歌曲 · {matchingTracks.length}</button>
            <button aria-pressed={filter === 'albums'} onClick={() => setFilter('albums')}>专辑 · {matchingAlbums.length}</button>
          </div>
          {filter !== 'tracks' && matchingAlbums.length > 0 && (
            <section className="result-section"><h2>专辑</h2><AlbumGrid albums={matchingAlbums} /></section>
          )}
          {filter !== 'albums' && matchingTracks.length > 0 && (
            <section className="result-section"><h2>歌曲</h2><TrackList tracks={matchingTracks} showAlbum /></section>
          )}
          {((filter === 'tracks' && !matchingTracks.length) || (filter === 'albums' && !matchingAlbums.length))
            && <p className="filter-empty">这个分类没有匹配结果。</p>}
        </>
      )}
    </section>
  );
}
