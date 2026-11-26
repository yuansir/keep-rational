import { expect, test } from '@playwright/test';
import data from '../src/data/catalogue.json' with { type: 'json' };
import { audioState, dock, fixtureAudio, openPlayer, player, queue, startFeatured } from './helpers';

test('home and full album library present the original catalogue', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '1701' })).toBeVisible();
  await expect(page.getByRole('button', { name: '播放专辑' })).toBeInViewport();
  await expect(page.locator('.home-shelf li')).toHaveCount(6);
  await expect(page.getByRole('link', { name: '音源与封面' })).toHaveAttribute('href', 'https://github.com/nj-lizhi/song');
  await page.getByRole('link', { name: '查看全部' }).click();
  await expect(page.getByRole('heading', { name: '音乐库' })).toBeVisible();
  await expect(page.locator('.album-card')).toHaveCount(data.albums.length);
  await expect(page.getByText(`${data.albums.length} 张专辑 · ${data.totalTracks} 首曲目`)).toBeVisible();
});

test('all album pages show the complete original track lists', async ({ page }) => {
  const ids = new Set();
  await page.goto('/#/library');
  for (const album of [...data.albums, ...data.archivedAlbums]) {
    await page.goto(`/#/album/${encodeURIComponent(album.name)}`);
    await expect(page.getByRole('heading', { name: album.name, exact: true })).toBeVisible();
    await expect(page.locator('.track-row')).toHaveCount(album.tracks.length);
    await expect(page.locator('.track-label strong')).toHaveText(album.tracks.map((track) => track.name));
    for (const track of album.tracks) {
      expect(track.albumName).toBe(album.name);
      expect(new URL(track.url).protocol).toBe('https:');
      ids.add(track.id);
    }
  }
  expect(ids.size).toBe(data.totalTracks);
});

test('archived 家 recordings keep their bookmarks, favorites and saved queue', async ({ page }) => {
  await fixtureAudio(page);
  await page.addInitScript(() => {
    localStorage.setItem('lizhi-favorites', JSON.stringify(['track-150']));
    localStorage.setItem('lizhi-queue', JSON.stringify({
      tracks: [{ id: 'track-150' }], currentIndex: 0, isShuffled: false, repeatMode: 'none',
    }));
  });
  await page.goto('/#/track/track-150');
  await expect(page.getByRole('heading', { name: '家', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '播放 和你在一起', exact: true })).toBeFocused();
  await expect(dock(page)).toContainText('和你在一起');
  expect((await audioState(page)).paused).toBe(true);
  await page.getByRole('link', { name: /^收藏/ }).click();
  await expect(page.getByRole('button', { name: '收藏 和你在一起', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '播放 和你在一起', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(0);
  expect(decodeURIComponent(new URL((await audioState(page)).src).pathname)).toContain('/audio/家/和你在一起.mp3');
});

test('album links and context return work with browser back and bookmarked paths', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '查看曲目' }).click();
  await expect(page.getByRole('link', { name: '返回听歌室' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '唱片目录' })).toBeVisible();
  await page.goto('/#/album/1701');
  await page.reload();
  await expect(page.getByRole('heading', { name: '1701' })).toBeVisible();
  await page.getByRole('link', { name: '返回音乐库' }).click();
  await expect(page.getByRole('heading', { name: '音乐库' })).toBeVisible();
  await page.goto('/#/album/%E0%A4%A');
  await expect(page.getByRole('heading', { name: '找不到这张专辑' })).toBeVisible();
});

test('search returns albums and tracks, supports filters, clear and empty results', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox');
  await search.fill('  1701  ');
  await expect(page.getByRole('heading', { name: '搜索结果' })).toBeVisible();
  await expect(page.locator('.album-card')).toHaveCount(1);
  await page.getByRole('button', { name: '歌曲 · 0' }).click();
  await expect(page.getByText('这个分类没有匹配结果。')).toBeVisible();
  await page.getByRole('button', { name: '全部 · 1' }).click();
  await page.locator('.album-card').click();
  await expect(page.getByRole('link', { name: '返回搜索结果' })).toBeVisible();
  await page.getByRole('link', { name: '返回搜索结果' }).click();
  await expect(search).toHaveValue('  1701  ');
  await search.fill('热河');
  await expect(page.locator('.track-row').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '播放 热河', exact: true }).first()).toBeVisible();
  await search.fill('不存在的搜索词-xkq');
  await expect(page.getByText('没有找到匹配结果')).toBeVisible();
  await page.getByRole('button', { name: '清除搜索' }).click();
  await expect(page.getByRole('heading', { name: '音乐库' })).toBeVisible();
});

test('search matches case-insensitive album titles and plays from song results', async ({ page }) => {
  await fixtureAudio(page);
  await page.goto('/');
  const search = page.getByRole('searchbox');
  await search.fill('imagine-2011');
  await expect(page.locator('.album-card')).toHaveCount(1);
  await expect(page.locator('.album-card')).toContainText('Imagine-2011');
  await search.fill('不多');
  await page.getByRole('button', { name: '播放 不多', exact: true }).first().click();
  await expect(dock(page)).toContainText('不多');
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(0);
});

test('favorites empty state, add, refresh, playback and removal', async ({ page }) => {
  await fixtureAudio(page);
  await page.goto('/#/favorites');
  await expect(page.getByText('还没有收藏')).toBeVisible();
  await page.getByRole('link', { name: '去音乐库选歌' }).click();
  await expect(page.getByRole('heading', { name: '音乐库' })).toBeVisible();
  await page.locator('.album-card').filter({ hasText: '1701' }).click();
  await page.getByRole('button', { name: '收藏 不多', exact: true }).click();
  await expect(page.getByRole('button', { name: '收藏 不多', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: /^收藏/ }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '我的收藏' })).toBeVisible();
  await expect(page.getByText('1 首歌曲')).toBeVisible();
  await page.getByRole('button', { name: '播放 不多', exact: true }).click();
  await expect(dock(page)).toContainText('不多');
  await page.getByRole('button', { name: '收藏 不多', exact: true }).click();
  await expect(page.getByText('还没有收藏')).toBeVisible();
});

test('broken cover uses all known hosts and retains navigation when unavailable', async ({ page }) => {
  const hosts = new Set<string>();
  await page.route((url) => url.pathname.includes('/1701/') && url.pathname.endsWith('/cover.png'), (request) => {
    hosts.add(new URL(request.request().url()).hostname);
    return request.abort('failed');
  });
  await page.goto('/');
  await expect(page.locator('.hero-cover .artwork-fallback')).toBeVisible();
  expect(hosts.size).toBe(3);
  await page.getByRole('link', { name: '打开专辑《1701》' }).click();
  await expect(page.getByRole('button', { name: '播放 不多', exact: true })).toBeVisible();
});

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
  test(`all page types and player fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await fixtureAudio(page);
    await startFeatured(page);
    const noOverflow = () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await noOverflow();
    await expect(page.getByRole('button', { name: '暂停播放' })).toBeInViewport();
    await page.getByRole('link', { name: '查看曲目' }).click();
    await expect(page.getByRole('button', { name: '播放 鼠说', exact: true })).toBeInViewport();
    await expect(dock(page).getByRole('button', { name: '暂停', exact: true })).toBeInViewport();
    await noOverflow();
    await page.getByRole('link', { name: '音乐库', exact: true }).click();
    await expect(page.locator('.album-card')).toHaveCount(23);
    await noOverflow();
    if (width <= 600) {
      await page.getByRole('button', { name: '搜索歌曲或专辑' }).click();
    }
    await page.getByRole('searchbox').fill('热河');
    await expect(page.getByRole('heading', { name: '搜索结果' })).toBeVisible();
    await noOverflow();
    await page.getByRole('link', { name: '收藏', exact: true }).click();
    await expect(page.getByRole('heading', { name: '我的收藏' })).toBeVisible();
    await noOverflow();
    await openPlayer(page);
    await expect(player(page).getByRole('button', { name: '暂停', exact: true })).toBeInViewport();
    expect(await player(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await player(page).getByRole('button', { name: '播放队列', exact: true }).click();
    await expect(queue(page).getByRole('button', { name: '关闭播放队列' })).toBeInViewport();
    await expect(queue(page).getByRole('button', { name: '播放 鼠说', exact: true })).toBeInViewport();
  });
}

test('skip link, dialog Escape and focus restoration work with the keyboard', async ({ page }) => {
  await fixtureAudio(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('button', { name: '播放专辑' }).press('Enter');
  const opener = dock(page).getByRole('button', { name: /^展开播放器/ });
  await opener.press('Enter');
  await expect(player(page).getByRole('button', { name: '收起播放器' })).toBeFocused();
  const queueButton = player(page).getByRole('button', { name: '播放队列', exact: true });
  await queueButton.press('Enter');
  await expect(queue(page).getByRole('button', { name: '关闭播放队列' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(queue(page)).toHaveCount(0);
  await expect(queueButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(player(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('favorites also update across tabs on the same origin', async ({ page, context }) => {
  const otherTab = await context.newPage();
  await otherTab.goto('/#/favorites');
  await expect(otherTab.getByText('还没有收藏')).toBeVisible();
  await page.goto('/#/album/1701');
  const heart = page.getByRole('button', { name: '收藏 不多', exact: true });
  await heart.click();
  await expect(otherTab.getByRole('button', { name: '播放 不多', exact: true })).toBeVisible();
  await heart.click();
  await expect(otherTab.getByText('还没有收藏')).toBeVisible();
});

test('opening the dock queue is a single step that preserves the current page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtureAudio(page);
  await startFeatured(page);
  await page.getByRole('link', { name: '查看曲目' }).click();
  const queueButton = dock(page).getByRole('button', { name: '打开播放队列' });
  await queueButton.click();
  await expect(queue(page)).toBeVisible();
  await expect(player(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(queue(page)).toHaveCount(0);
  await expect(queueButton).toBeFocused();
  await expect(page.getByRole('heading', { name: '1701' })).toBeVisible();
  await queueButton.click();
  await page.mouse.click(20, 120);
  await expect(queue(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '1701' })).toBeVisible();
});
