import { useMemo } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import {
  ALBUM_CATEGORY_LABELS,
  CURATED_PLAYLISTS,
  allTracks,
  albums,
  featured,
  getAlbumByName,
  getTrackById,
  shelf,
} from '../data/catalogue';
import { getLastPlayed } from '../utils/storage';
import { formatTime } from '../utils/media';
import { AlbumGrid, albumHref } from './AlbumGrid';
import { Artwork } from './Artwork';
import { Icon } from './Icon';

export function ListeningRoom() {
  const { playerState, playTrack, togglePlay } = usePlayer();
  const current = playerState.currentTrack;
  const featuredPlaying = current?.albumName === featured.name;
  const featuredActive = featuredPlaying && !playerState.error && (playerState.isPlaying || playerState.isLoading);

  const resumeInfo = useMemo(() => {
    const entry = getLastPlayed();
    if (!entry) return null;
    const track = getTrackById(entry.trackId);
    if (!track) return null;
    const album = getAlbumByName(track.albumName);
    if (!album) return null;
    return { track, album, position: entry.position };
  }, [current?.id]);

  const showResume = Boolean(resumeInfo && current?.id !== resumeInfo.track.id);

  function playRandomTrack() {
    if (!allTracks.length) return;
    const picked = allTracks[Math.floor(Math.random() * allTracks.length)];
    const album = getAlbumByName(picked.albumName);
    playTrack(picked, album?.tracks ?? [picked], { restart: true });
  }

  return (
    <>
      <section className="room-hero" aria-labelledby="featured-heading">
        <div className="hero-atmosphere" aria-hidden="true">
          <Artwork album={featured} priority decorative />
        </div>
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="signal-dot" />
              李志黑胶听歌室
              {featured.year && (
                <span className="hero-catalog-tag">
                  · {featured.year} {ALBUM_CATEGORY_LABELS[featured.category]}
                </span>
              )}
            </p>
            <h1 id="featured-heading" className="hero-title">{featured.name}</h1>
            <p className="hero-description">
              {featured.linerNote || '从《大象》到《热河》，在南京的夜色里按曲序听完这张唱片。'}
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => (featuredPlaying
                  ? togglePlay()
                  : playTrack(featured.tracks[0], featured.tracks, { restart: true }))}
              >
                <Icon name={featuredActive ? 'pause' : 'play'} />
                {featuredActive ? '暂停播放' : featuredPlaying ? '继续收听' : '播放专辑'}
              </button>
              <a className="text-link" href={albumHref(featured.name)}>
                查看曲目<Icon name="arrow" />
              </a>
              <button type="button" className="text-link" onClick={playRandomTrack}>
                <Icon name="compass" />随缘放一首
              </button>
            </div>
            <p className="hero-meta">
              <span>{featured.tracks.length} 首曲目</span>
              {featured.tracks.length > 0 && (
                <>
                  <span className="meta-sep" aria-hidden="true" />
                  <span>{featured.tracks[0].name} → {featured.tracks[featured.tracks.length - 1].name}</span>
                </>
              )}
              {featuredPlaying && current && (
                <>
                  <span className="meta-sep" aria-hidden="true" />
                  <span className="now-playing-pill">正在播放：{current.name}</span>
                </>
              )}
            </p>
          </div>
          <div className="hero-figure">
            <div className={`hero-vinyl-stage${featuredActive ? ' is-spinning' : ''}`}>
              <span className="hero-disc" aria-hidden="true" />
              <a className="hero-cover" href={albumHref(featured.name)} aria-label={`打开专辑《${featured.name}》`}>
                <Artwork album={featured} priority decorative />
              </a>
            </div>
          </div>
        </div>
      </section>

      {showResume && resumeInfo && (
        <section className="shell resume-banner" aria-label="继续上次收听">
          <div className="resume-card">
            <div className="resume-left">
              <Artwork album={resumeInfo.album} decorative />
              <div className="resume-meta">
                <span className="resume-kicker">
                  <Icon name="clock" />继续收听
                </span>
                <strong className="resume-title">{resumeInfo.track.name}</strong>
                <span className="resume-sub">
                  {resumeInfo.album.name}
                  {resumeInfo.position > 5 ? ` · 上次停在 ${formatTime(resumeInfo.position)}` : ''}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="secondary-button resume-action"
              onClick={() => playTrack(resumeInfo.track, resumeInfo.album.tracks)}
            >
              <Icon name="play" />接着听
            </button>
          </div>
        </section>
      )}

      {CURATED_PLAYLISTS.length > 0 && (
        <section className="shell shelf" aria-labelledby="curated-heading">
          <div className="section-heading">
            <div>
              <h2 id="curated-heading">主题听单</h2>
              <p>从南京坐标到跨年交响，按情绪与现场切入他的二十年</p>
            </div>
          </div>
          <ul className="curated-grid">
            {CURATED_PLAYLISTS.map((playlist) => (
              <li key={playlist.id}>
                <button
                  type="button"
                  className="curated-card"
                  onClick={() => {
                    if (playlist.tracks.length > 0) {
                      playTrack(playlist.tracks[0], playlist.tracks, { restart: true });
                    }
                  }}
                >
                  <div>
                    <div className="curated-card-top">
                      <span className="curated-tag">{playlist.subtitle}</span>
                      <span className="curated-play-dot" aria-hidden="true">
                        <Icon name="play" />
                      </span>
                    </div>
                    <h3>{playlist.title}</h3>
                    <p>{playlist.description}</p>
                  </div>
                  <div className="curated-footer">
                    <span>{playlist.tracks.length} 首精选</span>
                    <span>立即播放 →</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="shell shelf" aria-labelledby="shelf-heading">
        <div className="section-heading">
          <div>
            <h2 id="shelf-heading">唱片目录</h2>
            <p>{albums.length} 张专辑 · {allTracks.length} 首曲目</p>
          </div>
          <a className="text-link" href="#/library">查看全部<Icon name="arrow" /></a>
        </div>
        <AlbumGrid albums={shelf} className="home-shelf" />
      </section>

      <footer className="shell site-footer">
        <span>保持理智 · 非官方李志个人听歌室</span>
        <a className="text-link" href="https://github.com/nj-lizhi/song" target="_blank" rel="noreferrer">
          音源与封面<Icon name="diagonal" />
        </a>
      </footer>
    </>
  );
}
