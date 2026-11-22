import { expect, type Page } from '@playwright/test';

const rate = 8000;
const length = rate * 20 * 2;
const wave = Buffer.alloc(44 + length);
wave.write('RIFF', 0);
wave.writeUInt32LE(wave.length - 8, 4);
wave.write('WAVEfmt ', 8);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(rate, 24);
wave.writeUInt32LE(rate * 2, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write('data', 36);
wave.writeUInt32LE(length, 40);

export async function fixtureAudio(page: Page, shouldFail: (hostname: string) => boolean = () => false) {
  const hosts: string[] = [];
  await page.route((url) => /\.(mp3|flac)$/i.test(url.pathname), async (route) => {
    const host = new URL(route.request().url()).hostname;
    hosts.push(host);
    if (shouldFail(host)) {
      await route.abort('failed');
      return;
    }
    const range = route.request().headers()['range']?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), wave.length - 1) : wave.length - 1;
    const headers = { 'accept-ranges': 'bytes', 'content-type': 'audio/wav' };
    if (start > end) {
      await route.fulfill({ status: 416, headers: { ...headers, 'content-range': `bytes */${wave.length}` } });
      return;
    }
    await route.fulfill({
      status: range ? 206 : 200,
      headers: range ? { ...headers, 'content-range': `bytes ${start}-${end}/${wave.length}` } : headers,
      body: wave.subarray(start, end + 1),
    });
  });
  return hosts;
}

export function audioState(page: Page) {
  return page.locator('audio').evaluate((audio: HTMLAudioElement) => ({
    time: audio.currentTime, duration: audio.duration || 0, paused: audio.paused,
    muted: audio.muted, volume: audio.volume, src: audio.currentSrc,
  }));
}

export const dock = (page: Page) => page.getByRole('region', { name: '底部播放器' });
export const player = (page: Page) => page.locator('.immersive-dialog');
export const queue = (page: Page) => page.getByRole('dialog', { name: '播放队列' });

export async function startFeatured(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '播放专辑' }).click();
  await expect.poll(async () => (await audioState(page)).time).toBeGreaterThan(0);
}

export async function openPlayer(page: Page) {
  await dock(page).getByRole('button', { name: /^展开播放器/ }).click();
  await expect(player(page)).toBeVisible();
}
