import { Icon } from './Icon';

interface HeaderProps {
  active: 'home' | 'library' | 'search' | 'favorites' | 'album';
  search: string;
  favoritesCount: number;
  onSearchChange: (value: string) => void;
}

export function Header({ active, search, favoritesCount, onSearchChange }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a className="wordmark" href="#/" aria-label="保持理智，回到听歌室">
          <span className="wordmark-icon"><Icon name="disc" /></span>
          <span>保持理智</span>
        </a>
        <nav className="site-nav" aria-label="主导航">
          <a href="#/" aria-current={active === 'home' ? 'page' : undefined}>听歌室</a>
          <a href="#/library" aria-current={active === 'library' || active === 'search' || active === 'album' ? 'page' : undefined}>音乐库</a>
          <a href="#/favorites" aria-current={active === 'favorites' ? 'page' : undefined}>
            收藏{favoritesCount > 0 && <span className="nav-count">{favoritesCount}</span>}
          </a>
        </nav>
        <form className="search-form" role="search" onSubmit={(event) => { event.preventDefault(); onSearchChange(search); }}>
          <Icon name="search" />
          <input type="search" aria-label="搜索歌曲或专辑" placeholder="搜索歌曲或专辑"
            value={search} onChange={(event) => onSearchChange(event.target.value)} />
          {search && <button type="button" className="icon-button search-clear"
            aria-label="清除搜索" onClick={() => onSearchChange('')}><Icon name="close" /></button>}
        </form>
      </div>
    </header>
  );
}
