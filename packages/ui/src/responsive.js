/**
 * responsive.js
 * DEV TICKET #9 — Responsive System
 *
 * Breakpoints: sm 480 | md 768 | lg 1024 | xl 1440
 * useBreakpoint() hook
 */

import { useState, useEffect } from 'react';
import { breakpoints } from './tokens';

/**
 * useBreakpoint — returns the current active breakpoint key.
 * Returns: 'sm' | 'md' | 'lg' | 'xl'
 */
export function useBreakpoint() {
  const [bp, setBp] = useState(() => getBreakpoint(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  ));

  useEffect(() => {
    function handleResize() {
      setBp(getBreakpoint(window.innerWidth));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return bp;
}

function getBreakpoint(width) {
  if (width < breakpoints.sm) return 'xs';
  if (width < breakpoints.md) return 'sm';
  if (width < breakpoints.lg) return 'md';
  if (width < breakpoints.xl) return 'lg';
  return 'xl';
}

/**
 * isMobile — true when breakpoint is xs or sm
 */
export function useIsMobile() {
  const bp = useBreakpoint();
  return bp === 'xs' || bp === 'sm';
}
