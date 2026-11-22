import { expect, test } from '@playwright/test';
import { audioState, dock, fixtureAudio, openPlayer, player, queue, startFeatured } from './helpers';

test('real media element advances, pauses and resumes across pages', async ({ page }) => {
  await fixtureAudio(page);
  await startFeatured(page);
  const initial = await audioState(page);
  expect(initial.duration).toBeGreaterThan(0);
  await page.getByRole('link', { name: '查看曲目' }).click();
  await expect(dock(page)).toContainText('不多');
  await dock(page).getByRole('button', { name: '暂停', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).paused).toBe(true);
  await expect(dock(page).getByRole('button', { name: '播放', exact: true })).toBeVisible();
  const paused = (await audioState(page)).time;
  await page.getByRole('link', { name: '音乐库', exact: true }).click();
  expect(Math.abs((await audioState(page)).time - paused)).toBeLessThan(0.2);
  await dock(page).getByRole('button', { name: '播放', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(paused + 0.3);
});

test('album selection, queue switching and next/previous play the right tracks', async ({ page }) => {
  await fixtureAudio(page);
  await page.goto('/#/album/1701');
  await page.getByRole('button', { name: '播放 大象', exact: true }).click();
  await expect(dock(page)).toContainText('大象');
  await dock(page).getByRole('button', { name: '上一首' }).click();
  await expect(dock(page)).toContainText('不多');
  await dock(page).getByRole('button', { name: '下一首' }).click();
  await expect(dock(page)).toContainText('大象');
  await dock(page).getByRole('button', { name: '打开播放队列' }).click();
  await expect(queue(page).locator('.track-row')).toHaveCount(8);
  await queue(page).getByRole('button', { name: '播放 热河', exact: true }).click();
  await expect(queue(page)).toHaveCount(0);
  await expect(player(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '1701' })).toBeVisible();
  await expect(dock(page)).toContainText('热河');
  await page.getByRole('button', { name: '从头播放' }).click();
  await expect(dock(page)).toContainText('不多');
});

test('fullscreen status, range seek with keyboard and pointer, and return to the same page', async ({ page }) => {
  await fixtureAudio(page);
  await startFeatured(page);
  await page.getByRole('link', { name: '查看曲目' }).click();
  await openPlayer(page);
  const overlay = player(page);
  await expect(overlay.getByText('正在播放')).toBeVisible();
  await overlay.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(overlay.getByText('已暂停')).toBeVisible();
  const seek = overlay.getByRole('slider', { name: '播放进度' });
  await seek.press('Home');
  await seek.press('ArrowRight');
  await expect.poll(async () => (await audioState(page)).time).toBeCloseTo(1, 1);
  const frame = (await seek.boundingBox())!;
  await seek.click({ position: { x: Math.round(frame.width * .6), y: Math.round(frame.height * .5) } });
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(9);
  await overlay.getByRole('link', { name: '1701' }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '1701' })).toBeVisible();
});

test('volume, mute, and remembered settings are reflected on the audio element', async ({ page }) => {
  await fixtureAudio(page);
  await startFeatured(page);
  await openPlayer(page);
  const overlay = player(page);
  const volume = overlay.getByRole('slider', { name: '音量' });
  await volume.press('Home');
  await volume.press('ArrowRight');
  await expect.poll(async () => (await audioState(page)).volume).toBeCloseTo(0.01, 2);
  await overlay.getByRole('button', { name: '静音', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).muted).toBe(true);
  await overlay.getByRole('button', { name: '取消静音' }).click();
  await expect.poll(async () => (await audioState(page)).muted).toBe(false);
  await page.reload();
  await expect.poll(async () => (await audioState(page)).volume).toBeCloseTo(0.01, 2);
});

test('queue and playback position persist without autoplay on reload', async ({ page }) => {
  await fixtureAudio(page);
  await startFeatured(page);
  await openPlayer(page);
  await player(page).getByRole('button', { name: '暂停', exact: true }).click();
  const seek = player(page).getByRole('slider', { name: '播放进度' });
  await seek.press('Home');
  for (let i = 0; i < 8; i++) await seek.press('ArrowRight');
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(7);
  await page.reload();
  expect((await audioState(page)).paused).toBe(true);
  await expect(dock(page)).toContainText('不多');
  await dock(page).getByRole('button', { name: '播放', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(7);
});

test('shuffle preserves the current song and restores original queue order', async ({ page }) => {
  await fixtureAudio(page);
  await page.goto('/#/album/1701');
  await page.getByRole('button', { name: '播放 热河', exact: true }).click();
  await openPlayer(page);
  const overlay = player(page);
  const shuffle = overlay.getByRole('button', { name: '随机播放' });
  await shuffle.click();
  await expect(shuffle).toHaveAttribute('aria-pressed', 'true');
  await overlay.getByRole('button', { name: '播放队列', exact: true }).click();
  await expect(queue(page).locator('.track-label strong').first()).toHaveText('热河');
  await expect(queue(page).locator('.track-row')).toHaveCount(8);
  await queue(page).getByRole('button', { name: '关闭播放队列' }).click();
  await shuffle.click();
  await expect(shuffle).toHaveAttribute('aria-pressed', 'false');
  await overlay.getByRole('button', { name: '播放队列', exact: true }).click();
  await expect(queue(page).locator('.track-label strong').first()).toHaveText('不多');
  await expect(queue(page).locator('[aria-current="true"]')).toContainText('热河');
});

test('queue repeat wraps, single-track repeat restarts and normal mode advances', async ({ page }) => {
  await fixtureAudio(page);
  await page.goto('/#/album/1701');
  await page.getByRole('button', { name: '播放 鼠说', exact: true }).click();
  await openPlayer(page);
  const overlay = player(page);
  await expect(overlay.getByRole('button', { name: '下一首' })).toBeDisabled();
  await overlay.getByRole('button', { name: '循环播放：关闭' }).click();
  await overlay.getByRole('button', { name: '下一首' }).click();
  await expect(overlay.getByRole('heading', { name: '不多' })).toBeVisible();
  await overlay.getByRole('button', { name: '循环播放：队列循环' }).click();
  await expect(overlay.getByRole('button', { name: '循环播放：单曲循环' })).toBeVisible();
  await expect.poll(async () => (await audioState(page)).duration).toBe(20);
  await expect(page.locator('audio')).toHaveJSProperty('loop', true);
  await page.locator('audio').evaluate(async (audio: HTMLAudioElement) => {
    await audio.play();
    audio.currentTime = audio.duration - 0.35;
  });
  await expect.poll(async () => {
    const audio = await audioState(page);
    return !audio.paused && audio.time > 0.05 && audio.time < 6;
  }, { timeout: 8000 }).toBe(true);
  await expect(overlay.getByRole('heading', { name: '不多' })).toBeVisible();
  await overlay.getByRole('button', { name: '循环播放：单曲循环' }).click();
  await overlay.getByRole('slider', { name: '播放进度' }).press('End');
  await expect(overlay.getByRole('heading', { name: '大象' })).toBeVisible();
});

test('repeat-off stops on the final track and allows replay', async ({ page }) => {
  await fixtureAudio(page);
  await page.goto('/#/album/1701');
  await page.getByRole('button', { name: '播放 鼠说', exact: true }).click();
  await openPlayer(page);
  const overlay = player(page);
  await expect.poll(async () => (await audioState(page)).duration).toBe(20);
  await overlay.getByRole('slider', { name: '播放进度' }).press('End');
  await expect(overlay.getByText('已暂停')).toBeVisible();
  await expect(overlay.getByRole('heading', { name: '鼠说' })).toBeVisible();
  await overlay.getByRole('button', { name: '播放', exact: true }).click();
  await expect.poll(async () => (await audioState(page)).time).toBeLessThan(4);
});

test('audio advances after first and second host fail', async ({ page }) => {
  const attempts = await fixtureAudio(page, (host) => host !== 'raw.githubusercontent.com');
  await startFeatured(page);
  expect(attempts).toEqual(expect.arrayContaining(['testingcf.jsdelivr.net', 'cdn.jsdelivr.net', 'raw.githubusercontent.com']));
  expect((await audioState(page)).src).toContain('raw.githubusercontent.com');
});

test('all media hosts fail cleanly and manual retry recovers without losing track', async ({ page }) => {
  let unavailable = true;
  const attempts = await fixtureAudio(page, () => unavailable);
  await page.goto('/');
  await page.getByRole('button', { name: '播放专辑' }).click();
  await expect(dock(page).getByRole('button', { name: '重试播放' })).toBeVisible();
  expect(new Set(attempts).size).toBe(3);
  await openPlayer(page);
  await expect(player(page).getByRole('alert')).toContainText('音源暂时不可用');
  unavailable = false;
  await player(page).getByRole('button', { name: '重试播放' }).click();
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(0);
  await expect(player(page).getByRole('heading', { name: '不多' })).toBeVisible();
  await expect(player(page).getByRole('alert')).toHaveCount(0);
});

test('changing tracks rapidly plays the most recent choice', async ({ page }) => {
  await fixtureAudio(page);
  await page.goto('/#/album/1701');
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[aria-label="播放 不多"]')?.click();
    document.querySelector<HTMLButtonElement>('[aria-label="播放 大象"]')?.click();
    document.querySelector<HTMLButtonElement>('[aria-label="播放 热河"]')?.click();
  });
  await expect(dock(page)).toContainText('热河');
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(0);
  expect(decodeURIComponent((await audioState(page)).src)).toContain('/热河.mp3');
});

test('supported Media Session shares the current artist, track and play state', async ({ page }) => {
  await fixtureAudio(page);
  await startFeatured(page);
  const readMedia = () => page.evaluate(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return null;
    const { metadata, playbackState } = navigator.mediaSession;
    return { name: metadata?.title, artist: metadata?.artist, album: metadata?.album, playbackState };
  });
  if (!(await readMedia())) return;
  await expect.poll(readMedia).toEqual({ name: '不多', artist: '李志', album: '1701', playbackState: 'playing' });
  await dock(page).getByRole('button', { name: '下一首' }).click();
  await expect.poll(readMedia).toEqual({ name: '大象', artist: '李志', album: '1701', playbackState: 'playing' });
  await dock(page).getByRole('button', { name: '暂停', exact: true }).click();
  await expect.poll(readMedia).toEqual({ name: '大象', artist: '李志', album: '1701', playbackState: 'paused' });
});
