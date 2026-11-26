import { useEffect, useRef, useState } from 'react';
import type { Album } from '../types';
import { Artwork } from './Artwork';

interface VinylTurntableProps {
  album: Album;
  isPlaying: boolean;
  isLoading: boolean;
  hasError: boolean;
  progress: number; // 0..1
  coverRef?: React.RefObject<HTMLDivElement | null>;
}

const TARGET_DEG_PER_SEC = 200; // 33⅓ RPM = 200 deg/sec
const TAU_SPIN_UP = 0.22; // ~600ms to ~93% speed
const TAU_COAST_DOWN = 0.30; // ~800ms inertial coast-down

export function VinylTurntable({
  album,
  isPlaying,
  isLoading,
  hasError,
  progress,
  coverRef,
}: VinylTurntableProps) {
  const [viewMode, setViewMode] = useState<'vinyl' | 'sleeve'>('vinyl');
  const discRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const activeRef = useRef(false);

  const spinning = isPlaying && !isLoading && !hasError;
  activeRef.current = spinning;

  useEffect(() => {
    if (viewMode !== 'vinyl') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const target = activeRef.current ? TARGET_DEG_PER_SEC : 0;
      const tau = activeRef.current ? TAU_SPIN_UP : TAU_COAST_DOWN;
      const alpha = 1 - Math.exp(-dt / tau);
      velocityRef.current += (target - velocityRef.current) * alpha;

      if (!activeRef.current && velocityRef.current < 0.08) {
        velocityRef.current = 0;
        return;
      }

      angleRef.current = (angleRef.current + velocityRef.current * dt) % 360;
      if (discRef.current) {
        discRef.current.style.transform = `rotate(${angleRef.current.toFixed(2)}deg)`;
      }
      frame = requestAnimationFrame(step);
    };

    if (spinning || velocityRef.current > 0.08) {
      frame = requestAnimationFrame(step);
    }

    return () => cancelAnimationFrame(frame);
  }, [spinning, viewMode]);

  // Tonearm angle: 0deg parked, 20.5deg outer groove -> 32.5deg inner groove
  const clampedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const armAngle = spinning ? 20.5 + clampedProgress * 12 : 0;

  return (
    <div className={`turntable-stage ${viewMode === 'sleeve' ? 'is-sleeve' : 'is-vinyl'}`} ref={coverRef}>
      {viewMode === 'vinyl' ? (
        <div className="turntable-plinth" key={album.name}>
          <div className="turntable-platter">
            <div className="vinyl-disc-wrap">
              <div
                className="vinyl-disc"
                ref={discRef}
                style={{ transform: `rotate(${angleRef.current.toFixed(2)}deg)` }}
              >
                <div className="vinyl-grooves" aria-hidden="true" />
                <div className="vinyl-label">
                  <Artwork album={album} priority />
                  <span className="vinyl-label-ring" aria-hidden="true" />
                </div>
                <span className="vinyl-spindle" aria-hidden="true" />
              </div>
              <div className="vinyl-sheen" aria-hidden="true" />
            </div>
          </div>

          <div
            className={`tonearm-assembly ${spinning ? 'is-engaged' : ''}`}
            style={{ '--arm-angle': `${armAngle.toFixed(2)}deg` } as React.CSSProperties}
            aria-hidden="true"
          >
            <svg className="tonearm-svg" viewBox="0 0 120 280" fill="none">
              {/* Pivot gimbal base */}
              <circle cx="82" cy="38" r="24" fill="#1E1B18" stroke="rgba(235,224,206,0.22)" strokeWidth="1.5" />
              <circle cx="82" cy="38" r="13" fill="#2A2622" stroke="rgba(217,155,82,0.45)" strokeWidth="1.2" />
              <circle cx="82" cy="38" r="4.5" fill="#D99B52" />
              {/* Counterweight */}
              <rect x="75" y="10" width="14" height="16" rx="3" fill="#35302A" stroke="rgba(235,224,206,0.2)" strokeWidth="1" />
              {/* S-curved tonearm tube */}
              <path
                d="M 82 52 L 82 152 C 82 182 72 204 54 226 L 44 238"
                stroke="url(#armMetal)"
                strokeWidth="4.2"
                strokeLinecap="round"
              />
              {/* Headshell + cartridge */}
              <g transform="translate(41, 236) rotate(36)">
                <rect x="-6" y="-4" width="12" height="24" rx="2.5" fill="#24211D" stroke="rgba(235,224,206,0.35)" strokeWidth="1.2" />
                <rect x="-3" y="16" width="6" height="6" rx="1" fill="#D99B52" />
              </g>
              <defs>
                <linearGradient id="armMetal" x1="82" y1="52" x2="44" y2="238" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#CFC6B8" />
                  <stop offset="50%" stopColor="#8F877B" />
                  <stop offset="100%" stopColor="#D6CEBF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      ) : (
        <div className="sleeve-view" key={`sleeve-${album.name}`}>
          <div className="sleeve-cover">
            <Artwork album={album} priority />
          </div>
        </div>
      )}

      <div className="turntable-mode-bar">
        <button
          type="button"
          className={`turntable-mode-btn ${viewMode === 'vinyl' ? 'is-active' : ''}`}
          aria-pressed={viewMode === 'vinyl'}
          onClick={() => setViewMode('vinyl')}
        >
          黑胶唱片
        </button>
        <button
          type="button"
          className={`turntable-mode-btn ${viewMode === 'sleeve' ? 'is-active' : ''}`}
          aria-pressed={viewMode === 'sleeve'}
          onClick={() => setViewMode('sleeve')}
        >
          原版封面
        </button>
      </div>
    </div>
  );
}
