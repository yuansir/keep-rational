import { useEffect, useRef, useState } from 'react';
import { PlayerProvider, usePlayer } from './contexts/PlayerContext';
import { Header } from './components/Header';
import { ListeningRoom } from './components/ListeningRoom';
import { AlbumLibrary } from './components/AlbumLibrary';
import { AlbumDetail } from './components/AlbumDetail';
import { ImmersivePlayer } from './components/ImmersivePlayer';
import { MiniPlayer } from './components/MiniPlayer';
import { QueueDialog } from './components/QueueDialog';
import { TrackList } from './components/TrackList';
import { Icon } from './components/Icon';
import { albumByName, allTracks } from './data/catalogue';

type Route =
  | { kind: 'home' | 'library' | 'favorites' }
  | { kind: 'search'; query: string }
  | { kind: 'album'; name: string; returnHref: string };

function readRoute(hash: string, previousHash = ''): Route {
  const [, section, rawValue = ''] = hash.split('/');
  let value = '';
  try { value = decodeURIComponent(rawValue); } catch { /* Invalid bookmarked path. */ }
  if (section === 'album') {
    const parent = /^(#\/$|#\/(library|favorites)$|#\/search\/)/.test(previousHash) ? previousHash : '#/library';
    return { kind: 'album', name: value, returnHref: parent };
  }
  if (section === 'search' && value.trim()) return { kind: 'search', query: value };
  if (section === 'library' || section === 'search') return { kind: 'library' };
  if (section === 'favorites') return { kind: 'favorites' };
  return { kind: 'home' };
}

function Favorites() {
  const { favorites } = usePlayer();
  const tracks = allTracks.filter((track) => favorites.has(track.id));

  return (
    <section className="shell collection-page favorites-page page-enter" aria-labelledby="favorites-title">
      <div className="collection-header">
        <h1 className="display-title" id="favorites-title">我的收藏</h1>
        <p className="subtle">{tracks.length} 首歌曲</p>
      </div>
      {tracks.length > 0 ? <TrackList tracks={tracks} showAlbum /> : (
        <div className="empty-state">
          <Icon name="heart" /><h2>还没有收藏</h2><p>点一下曲目旁的心形，就能把它留在这里。</p>
          <a className="secondary-button" href="#/library">去音乐库选歌<Icon name="arrow" /></a>
        </div>
      )}
    </section>
  );
}

function AppContent() {
  const { favorites, playerState } = usePlayer();
  const [route, setRoute] = useState(() => readRoute(location.hash));
  const [search, setSearch] = useState(route.kind === 'search' ? route.query : '');
  const [expanded, setExpanded] = useState<{ origin?: DOMRect; showLyrics: boolean } | null>(null);
  const [dockQueueOpen, setDockQueueOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const main = useRef<HTMLElement>(null);
  const sectionKey = route.kind === 'album' ? `album:${route.name}` : route.kind;
  const previousSection = useRef(sectionKey);

  useEffect(() => {
    function handleNavigation(event: HashChangeEvent) {
      const oldHash = new URL(event.oldURL).hash || '#/';
      const next = readRoute(location.hash, oldHash);
      setRoute(next);
      setSearch(next.kind === 'search' ? next.query : '');
    }
    window.addEventListener('hashchange', handleNavigation);
    return () => window.removeEventListener('hashchange', handleNavigation);
  }, []);

  useEffect(() => {
    if (previousSection.current === sectionKey) return;
    previousSection.current = sectionKey;
    window.scrollTo(0, 0);
    if (document.activeElement?.tagName !== 'INPUT') main.current?.focus({ preventScroll: true });
  }, [sectionKey]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (!value.trim() && route.kind !== 'search') return;
    const url = value.trim() ? `#/search/${encodeURIComponent(value)}` : '#/library';
    if (route.kind === 'search') history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    setRoute(readRoute(url));
  }

  function expandPlayer(button: HTMLButtonElement, mode?: 'queue' | 'lyrics') {
    opener.current = button;
    if (mode === 'queue') {
      setDockQueueOpen(true);
    } else {
      const origin = document.querySelector('.mini-track .artwork')?.getBoundingClientRect();
      setExpanded({ origin, showLyrics: mode === 'lyrics' });
    }
  }

  function closePlayer() {
    setExpanded(null);
    setDockQueueOpen(false);
    opener.current?.focus({ preventScroll: true });
  }

  const album = route.kind === 'album' ? albumByName.get(route.name) : undefined;

  return (
    <div className={`app ${playerState.currentTrack ? 'has-player' : ''}`}>
      <a href="#main-content" className="skip-link" tabIndex={0} onClick={(event) => { event.preventDefault(); main.current?.focus(); }}>跳到主要内容</a>
      <Header active={route.kind} search={search} onSearchChange={handleSearchChange} favoritesCount={favorites.size} />
      <main id="main-content" ref={main} tabIndex={-1}>
        {route.kind === 'home' && <ListeningRoom />}
        {route.kind === 'library' && <AlbumLibrary key="library" />}
        {route.kind === 'search' && <AlbumLibrary key="search" query={route.query} />}
        {route.kind === 'favorites' && <Favorites />}
        {route.kind === 'album' && (album ? <AlbumDetail album={album} returnHref={route.returnHref} /> : (
          <section className="shell collection-page"><div className="empty-state">
            <Icon name="disc" /><h1>找不到这张专辑</h1><a className="secondary-button" href="#/library">返回音乐库</a>
          </div></section>
        ))}
      </main>
      <MiniPlayer onExpand={expandPlayer} />
      {expanded && <ImmersivePlayer onClose={closePlayer} origin={expanded.origin} showLyricsInitially={expanded.showLyrics} />}
      {dockQueueOpen && <QueueDialog onClose={closePlayer} />}
    </div>
  );
}

export default function App() {
  return <PlayerProvider><AppContent /></PlayerProvider>;
}
