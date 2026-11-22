import type { Album } from '../types';
import { usePlayer } from '../contexts/PlayerContext';
import { Artwork } from './Artwork';
import { Icon } from './Icon';
import { TrackList } from './TrackList';

export function AlbumDetail({ album, returnHref }: { album: Album; returnHref: string }) {
  const { playerState, playTrack } = usePlayer();

  return (
    <section className="shell album-page page-enter" aria-labelledby="album-title">
      <a href={returnHref} className="text-link back-link"><Icon name="back" />返回{ returnHref.startsWith('#/search/') ? '搜索结果' : returnHref === '#/' ? '听歌室' : returnHref === '#/favorites' ? '收藏' : '音乐库' }</a>
      <div className="album-layout">
        <div className="album-sidebar">
          <Artwork album={album} priority />
          <div className="album-summary">
            <p className="eyebrow">李志 / 专辑</p>
            <h1 id="album-title" className="display-title">{album.name}</h1>
            <p className="subtle">{album.tracks.length} 首曲目</p>
          </div>
        </div>
        <div className="album-tracks">
          <div className="section-heading track-heading">
            <h2>曲目</h2>
            {album.tracks.length > 0 && <button className="primary-button compact-button"
              onClick={() => playTrack(album.tracks[0], album.tracks, { restart: true })}>
              <Icon name="play" />{playerState.currentTrack?.albumName === album.name ? '从头播放' : '播放专辑'}
            </button>}
          </div>
          <TrackList tracks={album.tracks} />
        </div>
      </div>
    </section>
  );
}
