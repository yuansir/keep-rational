import { useState } from 'react';
import type { Album } from '../types';
import { mediaSources } from '../utils/media';
import { Icon } from './Icon';

type ArtworkProps = {
  album: Pick<Album, 'name' | 'cover'>;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
};

export function Artwork({ album, className = '', priority = false, decorative = false }: ArtworkProps) {
  return <CoverImage key={album.cover} album={album} className={className} priority={priority} decorative={decorative} />;
}

function CoverImage({ album, className, priority, decorative }: ArtworkProps) {
  const [attempt, setAttempt] = useState(0);
  const src = mediaSources(album.cover)[attempt];

  return (
    <span className={`artwork ${className}`} aria-hidden={decorative || undefined}>
      {src ? (
        <img src={src} alt={decorative ? '' : `${album.name}专辑封面`}
          loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined}
          decoding={priority ? 'auto' : 'async'} onError={() => setAttempt((previous) => previous + 1)} />
      ) : (
        <span className="artwork-fallback" role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : `${album.name}专辑封面暂不可用`}>
          <Icon name="disc" />
        </span>
      )}
    </span>
  );
}
