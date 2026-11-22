import { usePlayer } from '../contexts/PlayerContext';
import { allTracks, albums, featured, shelf } from '../data/catalogue';
import { AlbumGrid, albumHref } from './AlbumGrid';
import { Artwork } from './Artwork';
import { Icon } from './Icon';

export function ListeningRoom() {
  const { playerState, playTrack, togglePlay } = usePlayer();
  const current = playerState.currentTrack;
  const featuredPlaying = current?.albumName === featured.name;
  const featuredActive = featuredPlaying && !playerState.error && (playerState.isPlaying || playerState.isLoading);

  return (
    <>
      <section className="room-hero" aria-labelledby="featured-heading">
        <div className="hero-atmosphere" aria-hidden="true"><Artwork album={featured} priority decorative /></div>
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span className="signal-dot" />李志音乐听歌室</p>
            <h1 id="featured-heading" className="hero-title">{featured.name}</h1>
            <p className="hero-description">从《不多》到《鼠说》，按曲序听完这张唱片。</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => featuredPlaying
                ? togglePlay()
                : playTrack(featured.tracks[0], featured.tracks, { restart: true })}>
                <Icon name={featuredActive ? 'pause' : 'play'} />
                {featuredActive ? '暂停播放' : featuredPlaying ? '继续收听' : '播放专辑'}
              </button>
              <a className="text-link" href={albumHref(featured.name)}>查看曲目<Icon name="arrow" /></a>
            </div>
            <p className="hero-meta">{featured.tracks.length} 首曲目{featuredPlaying && <><span />{current.name}</>}</p>
          </div>
          <div className="hero-figure">
            <a className="hero-cover" href={albumHref(featured.name)} aria-label={`打开专辑《${featured.name}》`}>
              <Artwork album={featured} priority decorative />
            </a>
          </div>
        </div>
      </section>
      <section className="shell shelf" aria-labelledby="shelf-heading">
        <div className="section-heading">
          <div><h2 id="shelf-heading">唱片目录</h2><p>{albums.length} 张专辑 · {allTracks.length} 首曲目</p></div>
          <a className="text-link" href="#/library">查看全部<Icon name="arrow" /></a>
        </div>
        <AlbumGrid albums={shelf} className="home-shelf" />
      </section>
      <footer className="shell site-footer">
        <span>保持理智 · 非官方个人听歌室</span>
        <a className="text-link" href="https://github.com/nj-lizhi/song" target="_blank" rel="noreferrer">音源与封面<Icon name="diagonal" /></a>
      </footer>
    </>
  );
}
