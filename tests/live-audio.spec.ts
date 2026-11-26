import { expect, test } from '@playwright/test';
import { audioState, dock } from './helpers';

for (const example of [
  { album: '1701', song: '不多', extension: '.mp3' },
  { album: '1701', song: '大象', extension: '.mp3' },
  { album: '108个关键词', song: '青春', extension: '.flac' },
]) {
  test(`@live ${example.album} / ${example.song} plays from the public audio source`, async ({ page }) => {
    test.setTimeout(75000);
    const responses: number[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith(example.extension)) responses.push(response.status());
    });
    await page.goto(`/#/album/${encodeURIComponent(example.album)}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: `播放 ${example.song}`, exact: true }).click();
    await expect.poll(async () => (await audioState(page)).time, { timeout: 61000 }).toBeGreaterThan(1);
    const audio = await audioState(page);
    expect(audio.src).toMatch(/^https:\/\//);
    expect(audio.duration).toBeGreaterThan(60);
    expect(responses.some((status) => status === 200 || status === 206)).toBe(true);
    await dock(page).getByRole('button', { name: '暂停', exact: true }).click();
    await expect.poll(async () => (await audioState(page)).paused).toBe(true);
  });
}

test('@live all original album covers load in the library', async ({ page }) => {
  test.setTimeout(65000);
  await page.goto('/#/library', { waitUntil: 'domcontentloaded' });
  const artwork = page.locator('.album-card .artwork');
  await expect(artwork).toHaveCount(23);
  await artwork.locator('img').evaluateAll((images: HTMLImageElement[]) => {
    for (const image of images) image.loading = 'eager';
  });
  await expect.poll(() => artwork.locator('img').evaluateAll((images: HTMLImageElement[]) =>
    images.filter((image) => image.complete && image.naturalWidth > 0).length), { timeout: 56000 }).toBe(23);
});
