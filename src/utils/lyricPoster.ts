import { mediaSources } from './media';

export interface LyricPosterOptions {
  lines: string[];
  trackName: string;
  albumName: string;
  coverUrl?: string;
}

function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  const candidates = mediaSources(url);
  return new Promise((resolve) => {
    let index = 0;
    const tryNext = () => {
      if (index >= candidates.length) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => {
        index++;
        tryNext();
      };
      img.src = candidates[index];
    };
    tryNext();
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const char of paragraph) {
      const next = current + char;
      if (ctx.measureText(next).width > maxWidth && current) {
        result.push(current);
        current = char;
      } else {
        current = next;
      }
    }
    if (current) result.push(current);
  }
  return result;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Generates a 1080×1440 indie-record style lyric poster PNG and triggers download.
 * Uses a separate offscreen Image with crossOrigin="anonymous" and gracefully falls
 * back to a minimal vinyl emblem if cover CORS fails — never touches main DOM media.
 */
export async function exportLyricPoster(options: LyricPosterOptions): Promise<void> {
  const W = 1080;
  const H = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  // 1. Warm charcoal room background + subtle radial vinyl glow
  ctx.fillStyle = '#11100E';
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.28, 40, W * 0.5, H * 0.32, 680);
  glow.addColorStop(0, 'rgba(217, 155, 82, 0.14)');
  glow.addColorStop(0.55, 'rgba(26, 24, 21, 0.08)');
  glow.addColorStop(1, 'rgba(17, 16, 14, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle inner hairline frame
  ctx.strokeStyle = 'rgba(235, 224, 206, 0.12)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 44, 44, W - 88, H - 88, 12);
  ctx.stroke();

  // 2. Top-left small eyebrow
  ctx.fillStyle = '#A69D8E';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.fillText('保持理智 · KEEP RATIONAL', 100, 124);

  // 3. Album cover with peeking vinyl disc
  const coverSize = 360;
  const coverX = 100;
  const coverY = 186;
  const discCx = coverX + coverSize + 58;
  const discCy = coverY + coverSize / 2;
  const discR = coverSize * 0.46;

  // Peeking vinyl disc behind sleeve
  ctx.save();
  ctx.beginPath();
  ctx.arc(discCx, discCy, discR, 0, Math.PI * 2);
  ctx.fillStyle = '#0D0C0B';
  ctx.fill();
  ctx.strokeStyle = 'rgba(235, 224, 206, 0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let r = discR * 0.48; r < discR - 10; r += 12) {
    ctx.beginPath();
    ctx.arc(discCx, discCy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 245, 230, 0.045)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(discCx, discCy, discR * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = '#D99B52';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(discCx, discCy, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#11100E';
  ctx.fill();
  ctx.restore();

  // Cover artwork (safe offscreen CORS load with fallback)
  let coverImg: HTMLImageElement | null = null;
  if (options.coverUrl) {
    try {
      coverImg = await loadCorsImage(options.coverUrl);
    } catch {
      coverImg = null;
    }
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 18;
  drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 8);
  ctx.fillStyle = '#1A1815';
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 8);
  ctx.clip();
  if (coverImg) {
    ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize);
  } else {
    ctx.fillStyle = '#1E1B18';
    ctx.fillRect(coverX, coverY, coverSize, coverSize);
    ctx.beginPath();
    ctx.arc(coverX + coverSize / 2, coverY + coverSize / 2, 110, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(217, 155, 82, 0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(235, 224, 206, 0.16)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, coverX, coverY, coverSize, coverSize, 8);
  ctx.stroke();

  // 4. Amber quote bar + selected lyrics
  const lyricStartY = 668;
  ctx.fillStyle = '#D99B52';
  ctx.fillRect(100, lyricStartY - 46, 56, 3);

  ctx.fillStyle = '#F2ECE1';
  ctx.font = '600 46px "Noto Serif SC", "Songti SC", Georgia, serif';
  const maxTextWidth = W - 200;
  let y = lyricStartY + 18;
  const lineHeight = 76;

  for (const rawLine of options.lines.slice(0, 3)) {
    const wrapped = wrapLines(ctx, rawLine.trim(), maxTextWidth);
    for (const seg of wrapped) {
      if (y > H - 250) break;
      ctx.fillText(seg, 100, y);
      y += lineHeight;
    }
    y += 18;
  }

  // 5. Footer metadata
  ctx.strokeStyle = 'rgba(235, 224, 206, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, H - 196);
  ctx.lineTo(W - 100, H - 196);
  ctx.stroke();

  ctx.fillStyle = '#F2ECE1';
  ctx.font = '600 32px "Noto Serif SC", "Songti SC", serif';
  ctx.fillText(`《${options.trackName}》`, 100, H - 132);

  ctx.fillStyle = '#A69D8E';
  ctx.font = '400 24px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.fillText(`李志 · ${options.albumName}`, 100, H - 90);

  // Download PNG
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('无法生成歌词卡片');
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = options.trackName.replace(/[\\/:*?"<>|]/g, '_');
  link.href = objectUrl;
  link.download = `李志-${safeName}-歌词卡片.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
