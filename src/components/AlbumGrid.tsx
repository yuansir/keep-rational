import type { Album } from '../types';
import { Artwork } from './Artwork';
import { Icon } from './Icon';

export function albumHref(name: string) {
  return `#/album/${encodeURIComponent(name)}`;
}

export function AlbumGrid({ albums, className = '' }: { albums: Album[]; className?: string }) {
  return (
    <ul className={`album-grid ${className}`}>
      {albums.map((album) => (
        <li key={album.name}>
          <a className="album-card" href={albumHref(album.name)}>
            <Artwork album={album} decorative />
            <span className="album-card-caption">
              <span><strong>{album.name}</strong><small>{album.tracks.length} 首</small></span>
              <Icon name="diagonal" />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
