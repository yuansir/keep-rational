import { expect, test, type Page } from '@playwright/test';
import { audioState, dock, fixtureAudio, openPlayer, player, startFeatured } from './helpers';

const timed = '[ar:测试歌手]\n[offset:+200]\n[00:00.50]测试甲\n[00:04.00][00:07.00]测试乙\n[00:09.00]\n[00:10.00]测试丙';
const plain = '测试文字第一行\n测试文字第二行';
const mockRecording = (options: Partial<{ id: number; title: string; album: string; duration: number;
  timed: string | null; plain: string | null; instrumental: boolean }> = {}) => ({
  id: options.id ?? 7101,
  trackName: options.title ?? '不多', artistName: '李志', albumName: options.album ?? '1701', duration: options.duration ?? 20,
  instrumental: options.instrumental ?? false,
  syncedLyrics: options.timed === undefined ? timed : options.timed,
  plainLyrics: options.plain === undefined ? plain : options.plain,
  hasSyncedLyrics: options.timed !== null,
  hasPlainLyrics: options.plain !== null,
});

async function mockLyrics(page: Page, response: ReturnType<typeof mockRecording>[]) {
  await page.route('https://lrclib.net/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v2/search') {
      return route.fulfill({ json: response.filter((item) => item.trackName === url.searchParams.get('track_name')) });
    }
    const matched = response.find((item) => url.pathname === `/api/get/${item.id}`);
    return matched ? route.fulfill({ json: matched }) : route.fulfill({ status: 404 });
  });
}

async function showLyrics(page: Page) {
  await openPlayer(page);
  await player(page).getByRole('button', { name: '歌词', exact: true }).click();
  const panel = player(page).getByRole('region', { name: '歌词' });
  await expect(panel).toBeVisible();
  return panel;
}

test('timed lyrics follow playback and jump to clicked lines', async ({ page }) => {
  await fixtureAudio(page);
  await mockLyrics(page, [mockRecording()]);
  await startFeatured(page);
  const panel = await showLyrics(page);
  await expect(panel.getByText('逐句同步')).toBeVisible();
  const first = panel.getByRole('button', { name: '测试甲', exact: true });
  await expect(first).toHaveAttribute('aria-current', 'true');
  await player(page).getByRole('button', { name: '暂停', exact: true }).click();
  const repeat = panel.getByRole('button', { name: '测试乙', exact: true });
  await expect(repeat).toHaveCount(2);
  await repeat.first().click();
  await expect.poll(async () => (await audioState(page)).time).toBeCloseTo(4.2, 1);
  await expect(repeat.first()).toHaveAttribute('aria-current', 'true');
  await repeat.last().click();
  await expect.poll(async () => (await audioState(page)).time).toBeCloseTo(7.2, 1);
  await expect(repeat.last()).toHaveAttribute('aria-current', 'true');
  await panel.locator('.lyrics-scroll').focus();
  await page.keyboard.press('PageDown');
  await expect(panel.getByRole('button', { name: '回到当前句' })).toBeVisible();
  await panel.getByRole('button', { name: '回到当前句' }).click();
  await expect(panel.getByRole('button', { name: '回到当前句' })).toHaveCount(0);
});

test('a mismatched recording appears only as optional untimed reference text', async ({ page }) => {
  await fixtureAudio(page);
  await mockLyrics(page, [mockRecording({ album: '另一个现场录音版本' })]);
  await startFeatured(page);
  const panel = await showLyrics(page);
  await expect(panel.getByText('暂未找到与这版录音匹配的歌词。')).toBeVisible();
  await expect(panel.getByText('测试甲')).toHaveCount(0);
  await panel.getByRole('button', { name: '查看同曲其他版本的歌词' }).click();
  await expect(panel.getByText('参考版本 · 另一个现场录音版本')).toBeVisible();
  await expect(panel.getByText('测试甲')).toBeVisible();
  await expect(panel.getByRole('button', { name: '测试甲' })).toHaveCount(0);
});

test('plain text is shown without false synchronization and an instrumental is clearly labelled', async ({ page }) => {
  await fixtureAudio(page);
  await mockLyrics(page, [
    mockRecording({ timed: null }),
    mockRecording({ id: 7102, title: '大象', timed: null, plain: null, instrumental: true }),
  ]);
  await startFeatured(page);
  const panel = await showLyrics(page);
  await expect(panel.getByText('纯文本', { exact: true })).toBeVisible();
  await expect(panel.getByText('测试文字第二行')).toBeVisible();
  await player(page).getByRole('button', { name: '下一首' }).click();
  await expect(panel.getByText('这个录音标为纯音乐。')).toBeVisible();
  await expect(panel.getByText('测试文字第二行')).toHaveCount(0);
});

test('imported LRC survives reload and can be removed without changing another track', async ({ page }) => {
  await fixtureAudio(page);
  await mockLyrics(page, []);
  await startFeatured(page);
  const panel = await showLyrics(page);
  const file = panel.locator('input[type=file]');
  await file.setInputFiles({ name: '本地.lrc', mimeType: 'text/plain',
    buffer: Buffer.from('\uFEFF[ar:测试]\r\n[00:04.00]私有测试歌词\r\n[00:01.25]测试开头', 'utf16le') });
  await expect(panel.getByText('本地导入 · 逐句同步')).toBeVisible();
  await expect(panel.locator('.lyric-line')).toHaveText(['测试开头', '私有测试歌词']);
  await player(page).getByRole('button', { name: '下一首' }).click();
  await expect(panel.getByText('私有测试歌词')).toHaveCount(0);
  await player(page).getByRole('button', { name: '上一首' }).click();
  await expect(panel.getByText('私有测试歌词')).toBeVisible();
  await page.reload();
  await expect.poll(async () => (await audioState(page)).paused).toBe(true);
  await dock(page).getByRole('button', { name: '打开歌词' }).click();
  await expect(panel.getByText('私有测试歌词')).toBeVisible();
  await panel.getByRole('button', { name: '移除导入' }).click();
  await expect(panel.getByText('私有测试歌词')).toHaveCount(0);
  await expect(panel.getByText('暂未找到与这版录音匹配的歌词。')).toBeVisible();
});

test('unavailable lyrics retry and invalid local files give visible feedback', async ({ page }) => {
  await fixtureAudio(page);
  let unavailable = true;
  await page.route('https://lrclib.net/api/**', (route) => unavailable
    ? route.fulfill({ status: 503 }) : route.fulfill({ json: [] }));
  await startFeatured(page);
  const panel = await showLyrics(page);
  await expect(panel.getByText('歌词暂时加载不了，请重试。')).toBeVisible();
  unavailable = false;
  await panel.getByRole('button', { name: '重试', exact: true }).click();
  await expect(panel.getByText('暂未找到与这版录音匹配的歌词。')).toBeVisible();
  await panel.locator('input[type=file]').setInputFiles({
    name: '空.lrc', mimeType: 'text/plain', buffer: Buffer.from('[ar:测试]\n[00:02.03]'),
  });
  await expect(panel.getByText('文件里没有可显示的歌词。')).toBeVisible();
});

test('the lyric sheet scrolls on a 320px phone without moving playback controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await fixtureAudio(page);
  await mockLyrics(page, [mockRecording()]);
  await startFeatured(page);
  const panel = await showLyrics(page);
  await expect(panel.getByText('逐句同步')).toBeVisible();
  const pause = player(page).getByRole('button', { name: '暂停', exact: true });
  await expect(pause).toBeInViewport();
  await expect(player(page).getByRole('button', { name: '播放队列', exact: true })).toBeInViewport();
  const before = await pause.boundingBox();
  await panel.locator('.lyrics-scroll').focus();
  await page.keyboard.press('PageDown');
  await expect(panel.getByRole('button', { name: '回到当前句' })).toBeVisible();
  await expect(pause).toBeInViewport();
  expect((await pause.boundingBox())?.y).toBeCloseTo(before!.y, 0);
  expect(await player(page).evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(player(page)).toHaveCount(0);
});

test('@live the provider returns synchronized lyrics for the real 1701 recording', async ({ page }) => {
  test.setTimeout(40000);
  await startFeatured(page);
  const panel = await showLyrics(page);
  await expect(panel.getByText('逐句同步')).toBeVisible({ timeout: 15000 });
  expect(await panel.locator('.lyric-line').count()).toBeGreaterThan(3);
  await player(page).getByRole('button', { name: '暂停', exact: true }).click();
  const line = panel.locator('.lyric-line').nth(2);
  await line.click();
  await expect(line).toHaveAttribute('aria-current', 'true');
});

test('@live 鼠说 has the source plain text in the real player', async ({ page }) => {
  test.setTimeout(40000);
  await page.goto('/#/album/1701');
  await page.getByRole('button', { name: '播放 鼠说', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).time, { timeout: 20000 }).toBeGreaterThan(0);
  const panel = await showLyrics(page);
  await expect(panel.getByText('纯文本', { exact: true })).toBeVisible({ timeout: 15000 });
  expect(await panel.locator('.lyric-plain p').count()).toBeGreaterThan(1);
});
