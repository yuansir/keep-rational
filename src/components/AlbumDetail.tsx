import type { Album } from '../types';
import { usePlayer } from '../contexts/PlayerContext';
import { ALBUM_CATEGORY_LABELS } from '../data/catalogue';
import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { TrackList } from './TrackList';

export function AlbumDetail({ album, returnHref, focusTrackId }: {
  album: Album;
  returnHref: string;
  focusTrackId?: string;
}) {
  const { playerState, playTrack } = usePlayer();
  const returnLabel = returnHref.startsWith('#/search/')
    ? '搜索结果'
    : returnHref === '#/'
      ? '听歌室'
      : returnHref === '#/favorites'
        ? '收藏'
        : '音乐库';

  return (
    <div className="album-page-wrap">
      <div className="album-hero-wash" aria-hidden="true">
        <Artwork album={album} priority decorative />
      </div>
      <section className="shell album-page page-enter" aria-labelledby="album-title">
        <a href={returnHref} className="text-link back-link">
          <Icon name="back" />返回{returnLabel}
        </a>
        <div className="album-layout">
          <aside className="album-sidebar">
            <Artwork album={album} priority />
            <div className="album-summary">
              <p className="eyebrow">
                李志 · {ALBUM_CATEGORY_LABELS[album.category]}
              </p>
              <h1 id="album-title" className="display-title">{album.name}</h1>
              <div className="album-badges">
                {album.year && <span className="album-badge">{album.year}</span>}
                <span className={`album-badge${album.category === 'live' ? ' album-badge-live' : ''}`}>
                  {ALBUM_CATEGORY_LABELS[album.category]}
                </span>
                <span className="album-badge">{album.tracks.length} 首曲目</span>
                {album.venue && <span className="album-badge">{album.venue}</span>}
              </div>
              {album.linerNote && <p className="album-liner-note">{album.linerNote}</p>}
            </div>
          </aside>
          <div className="album-tracks">
            <div className="section-heading track-heading">
              <h2>曲目</h2>
              {album.tracks.length > 0 && (
                <button
                  className="primary-button compact-button"
                  onClick={() => playTrack(album.tracks[0], album.tracks, { restart: true })}
                >
                  <Icon name="play" />
                  {playerState.currentTrack?.albumName === album.name ? '从头播放' : '播放专辑'}
                </button>
              )}
            </div>
            <TrackList tracks={album.tracks} focusTrackId={focusTrackId} />
          </div>
        </div>
      </section>
    </div>
  );
}
