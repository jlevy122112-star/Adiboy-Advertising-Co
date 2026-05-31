/**
 * LottiePlayer.jsx
 * DEV TICKET #2 — Lottie Animation Loader + Wrapper Component
 *
 * Accepts: name, autoplay, loop, onComplete
 * Loads JSON from /assets/lottie/{name}.json
 * Handles preloading + caching
 * Emits events to CinematicEngine
 */

import { useEffect, useRef, useState } from 'react';
import { animationRegistry } from '../../config/animationRegistry';

export default function LottiePlayer({
  name,
  autoplay = true,
  loop = false,
  onComplete,
  style = {},
  className = '',
}) {
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const src = animationRegistry[name];

  useEffect(() => {
    if (!src || !containerRef.current) return;

    let animation = null;
    let cancelled = false;

    async function init() {
      try {
        // Dynamically import lottie-web to keep bundle lean
        const lottie = (await import('lottie-web')).default;

        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const animationData = await res.json();

        if (cancelled || !containerRef.current) return;

        animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop,
          autoplay,
          animationData,
        });

        animationRef.current = animation;
        setLoaded(true);

        animation.addEventListener('complete', () => {
          if (onComplete) onComplete();
        });
      } catch (err) {
        console.warn(`[LottiePlayer] Failed to load animation: ${name}`, err);
        setError(true);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
    };
  }, [name, src, autoplay, loop]);

  // Expose play/stop methods via ref pattern if needed
  function play() {
    animationRef.current?.play();
  }

  function stop() {
    animationRef.current?.stop();
  }

  if (!src) {
    console.warn(`[LottiePlayer] Animation not found in registry: ${name}`);
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`lottie-player ${className}`}
      style={{ width: '100%', height: '100%', ...style }}
      aria-hidden="true"
    />
  );
}
