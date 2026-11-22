const paths = {
  play: <path d="M8 5.5 19 12 8 18.5Z" fill="currentColor" stroke="none" />,
  pause: <path d="M8.5 6v12m7-12v12" strokeWidth="2.8" />,
  previous: <><path d="M17.5 6 8 12l9.5 6Z" fill="currentColor" stroke="none" /><path d="M6 6v12" /></>,
  next: <><path d="m6.5 6 9.5 6-9.5 6Z" fill="currentColor" stroke="none" /><path d="M18 6v12" /></>,
  search: <><circle cx="10.7" cy="10.7" r="5.7" /><path d="m15 15 4 4" /></>,
  heart: <path d="M20.1 5.8a4.6 4.6 0 0 0-6.5 0L12 7.4l-1.6-1.6a4.6 4.6 0 1 0-6.5 6.5l8.1 8.1 8.1-8.1a4.6 4.6 0 0 0 0-6.5Z" />,
  back: <path d="m10 6-6 6 6 6m-6-6h16" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  diagonal: <path d="M6 18 18 6M8 6h10v10" />,
  expand: <path d="M14 5h5v5M19 5l-6 6M10 19H5v-5m0 5 6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  lyrics: <path d="M5 4.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l-4 2v-2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Zm2 5h10m-10 4h6" />,
  queue: <path d="M4 6h16M4 12h16M4 18h9m4-2 3 2-3 2Z" />,
  volume: <path d="M4 10v4h4l5 4V6l-5 4Zm12-.5a3.5 3.5 0 0 1 0 5m2.5-7.5a7 7 0 0 1 0 10" />,
  mute: <path d="M4 10v4h4l5 4V6l-5 4Zm12.5-.5 5 5m0-5-5 5" />,
  shuffle: <path d="M4 7h2c3.5 0 4.5 2.5 6 5s2.5 5 6 5h2m-3-3 3 3-3 3M4 17h2c2.4 0 3.5-1.2 4.3-2.5m3.4-5C14.6 8.2 15.6 7 18 7h2m-3-3 3 3-3 3" />,
  repeat: <path d="m16 3 4 4-4 4M4 11V9a2 2 0 0 1 2-2h14M8 21l-4-4 4-4m12 0v2a2 2 0 0 1-2 2H4" />,
  repeatOne: <><path d="m16 3 4 4-4 4M4 11V9a2 2 0 0 1 2-2h14M8 21l-4-4 4-4m12 0v2a2 2 0 0 1-2 2H4" /><path d="m11 11 1.5-1v4" /></>,
  disc: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="1.8" /><path d="M6.5 12a5.5 5.5 0 0 1 5.5-5.5m5.5 5.5a5.5 5.5 0 0 1-5.5 5.5" /></>,
  bars: <path d="M6 12v5m4-10v10m4-13v13m4-8v8" />,
};

export function Icon({ name, className = '' }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
