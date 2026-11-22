const prefixes = [
  'https://testingcf.jsdelivr.net/gh/nj-lizhi/song@main/',
  'https://cdn.jsdelivr.net/gh/nj-lizhi/song@main/',
  'https://raw.githubusercontent.com/nj-lizhi/song/main/',
];

export function mediaSources(url: string) {
  const prefix = prefixes.find((candidate) => url.startsWith(candidate));
  if (!prefix) return [url];
  const path = url.slice(prefix.length);
  return [url, ...prefixes.filter((candidate) => candidate !== prefix).map((candidate) => candidate + path)];
}

export function formatTime(seconds: number) {
  const time = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`;
}
