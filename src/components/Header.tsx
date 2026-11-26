import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface HeaderProps {
  active: 'home' | 'library' | 'search' | 'favorites' | 'album';
  search: string;
  favoritesCount: number;
  onSearchChange: (value: string) => void;
}

export function Header({ active, search, favoritesCount, onSearchChange }: HeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(Boolean(search));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search) setMobileSearchOpen(true);
  }, [search]);

  function openMobileSearch() {
    setMobileSearchOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function closeMobileSearch() {
    if (search) onSearchChange('');
    setMobileSearchOpen(false);
  }

  return (
    <header className={`site-header${mobileSearchOpen ? ' search-expanded' : ''}`}>
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
        <button
          type="button"
          className="icon-button mobile-search-toggle"
          aria-label={mobileSearchOpen ? '收起搜索' : '搜索歌曲或专辑'}
          aria-expanded={mobileSearchOpen}
          onClick={() => (mobileSearchOpen ? closeMobileSearch() : openMobileSearch())}
        >
          <Icon name={mobileSearchOpen ? 'close' : 'search'} />
        </button>
        <form
          className="search-form"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchChange(search);
          }}
        >
          <Icon name="search" />
          <input
            ref={inputRef}
            type="search"
            aria-label="搜索歌曲或专辑"
            placeholder="搜索歌名、专辑或坐标…"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && mobileSearchOpen) {
                closeMobileSearch();
              }
            }}
          />
          {search && (
            <button
              type="button"
              className="icon-button search-clear"
              aria-label="清除搜索"
              onClick={() => onSearchChange('')}
            >
              <Icon name="close" />
            </button>
          )}
        </form>
      </div>
    </header>
  );
}
