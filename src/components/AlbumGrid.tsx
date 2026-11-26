import type { Album } from '../types';
import { ALBUM_CATEGORY_LABELS } from '../data/catalogue';
import { Artwork } from './Artwork';

export function albumHref(name: string) {
  return `#/album/${encodeURIComponent(name)}`;
}

export function AlbumGrid({ albums, className = '' }: { albums: Album[]; className?: string }) {
  return (
    <ul className={`album-grid ${className}`}>
      {albums.map((album) => {
        const metaParts = [
          album.year ? String(album.year) : null,
          ALBUM_CATEGORY_LABELS[album.category],
          `${album.tracks.length} 首`,
        ].filter(Boolean);

        return (
          <li key={album.name}>
            <a className="album-card" href={albumHref(album.name)}>
              <span className="album-sleeve-wrap">
                <Artwork album={album} decorative />
              </span>
              <span className="album-card-caption">
                <strong>{album.name}</strong>
                <small>{metaParts.join(' · ')}</small>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
