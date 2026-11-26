import { useState } from 'react';
import type { AlbumCategory } from '../types';
import { ALBUM_CATEGORY_LABELS, allTracks, albums, getAlbumsByCategory } from '../data/catalogue';
import { AlbumGrid } from './AlbumGrid';
import { TrackList } from './TrackList';
import { Icon } from './Icon';

const CATEGORIES: Array<'all' | AlbumCategory> = ['all', 'studio', 'live', 'archive'];

export function AlbumLibrary({ query = '' }: { query?: string }) {
  const [category, setCategory] = useState<'all' | AlbumCategory>('all');
  const [filter, setFilter] = useState<'all' | 'tracks' | 'albums'>('all');
  const value = query.trim().toLocaleLowerCase();
  const searching = value.length > 0;
  const matches = (text: string) => text.toLocaleLowerCase().includes(value);

  const visibleAlbums = searching
    ? albums.filter((album) => matches(album.name) || (album.venue ? matches(album.venue) : false))
    : getAlbumsByCategory(category);
  const matchingTracks = searching ? allTracks.filter((track) => matches(track.name)) : [];
  const count = matchingTracks.length + visibleAlbums.length;

  return (
    <section className="shell collection-page page-enter" aria-labelledby="collection-title">
      <div className="collection-header">
        <div>
          <h1 id="collection-title" className="display-title">{searching ? '搜索结果' : '音乐库'}</h1>
          <p className="subtle">
            {searching
              ? `「${query.trim()}」 · ${count} 项结果`
              : `${albums.length} 张专辑 · ${allTracks.length} 首曲目 · 按年代整理`}
          </p>
        </div>
      </div>

      {!searching ? (
        <>
          <div className="library-tabs" role="group" aria-label="按唱片类型筛选">
            {CATEGORIES.map((cat) => {
              const catCount = getAlbumsByCategory(cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={category === cat}
                  onClick={() => setCategory(cat)}
                >
                  {ALBUM_CATEGORY_LABELS[cat]} · {catCount}
                </button>
              );
            })}
          </div>
          <AlbumGrid albums={visibleAlbums} />
        </>
      ) : count === 0 ? (
        <div className="empty-state">
          <Icon name="search" />
          <h2>没有找到匹配结果</h2>
          <p>南京的唱片架上暂时没有这张，换个歌名、专辑名或演出年份试试。</p>
          <a className="secondary-button" href="#/library">浏览全部专辑</a>
        </div>
      ) : (
        <>
          <div className="result-filters" role="group" aria-label="筛选搜索结果">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>全部 · {count}</button>
            <button type="button" aria-pressed={filter === 'tracks'} onClick={() => setFilter('tracks')}>歌曲 · {matchingTracks.length}</button>
            <button type="button" aria-pressed={filter === 'albums'} onClick={() => setFilter('albums')}>专辑 · {visibleAlbums.length}</button>
          </div>
          {filter !== 'tracks' && visibleAlbums.length > 0 && (
            <section className="result-section">
              <h2>专辑</h2>
              <AlbumGrid albums={visibleAlbums} />
            </section>
          )}
          {filter !== 'albums' && matchingTracks.length > 0 && (
            <section className="result-section">
              <h2>歌曲</h2>
              <TrackList tracks={matchingTracks} showAlbum />
            </section>
          )}
          {((filter === 'tracks' && !matchingTracks.length) || (filter === 'albums' && !visibleAlbums.length)) && (
            <p className="filter-empty">这个分类没有匹配结果。</p>
          )}
        </>
      )}
    </section>
  );
}
