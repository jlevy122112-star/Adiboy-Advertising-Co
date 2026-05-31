/**
 * tokens.js
 * DEV TICKET #9 — Global Design Tokens
 *
 * Colors, spacing, typography, shadows, radii — exactly as defined in the document.
 */

export const colors = {
  // Core palette from document
  black:          '#000000',
  charcoal:       '#0A0A0A',
  steel:          '#2E2E2E',
  white:          '#FFFFFF',

  // Cinematic accents from document
  reactorBlue:    '#00AEEF',
  redactedRed:    '#D40000',
  spotlightWhite: '#FFFFFF',

  // Surface colors
  panelBg:        '#0D0D12',
  borderLight:    'rgba(255,255,255,0.08)',
  borderDark:     'rgba(255,255,255,0.16)',

  // Brand
  gold:           '#C9A84C',
  gold2:          '#E8C96A',

  // Status
  green:          '#2DCE89',
  amber:          '#FF9F1C',
  red:            '#EF4444',
  blue:           '#5E72E4',
  purple:         '#A78BFA',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const typography = {
  families: {
    display: "'Bebas Neue', sans-serif",
    mono:    "'Share Tech Mono', monospace",
    body:    "'DM Sans', sans-serif",
  },
  weights: {
    light:   300,
    regular: 400,
    medium:  500,
    bold:    700,
  },
  heading: {
    h1: '2.5rem',    // 40px
    h2: '2rem',      // 32px
    h3: '1.5rem',    // 24px
    h4: '1.25rem',   // 20px
  },
  body: {
    lg:  '1rem',     // 16px
    md:  '0.875rem', // 14px
    sm:  '0.75rem',  // 12px
  },
  caption: {
    md:  '0.6875rem', // 11px
    sm:  '0.625rem',  // 10px
  },
};

export const shadows = {
  soft:       '0 2px 8px rgba(0,0,0,0.4)',
  industrial: '0 4px 16px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04)',
  glow:       '0 0 20px rgba(0,174,239,0.3)',
  goldGlow:   '0 0 20px rgba(201,168,76,0.25)',
  redGlow:    '0 0 20px rgba(212,0,0,0.4)',
};

export const radii = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
};

export const breakpoints = {
  sm:  480,
  md:  768,
  lg:  1024,
  xl:  1440,
};

export const durations = {
  fast:   '120ms',
  normal: '200ms',
  slow:   '300ms',
};

export const easings = {
  out:    'cubic-bezier(0.4, 0, 0.2, 1)',
  inOut:  'cubic-bezier(0.4, 0, 0.6, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};
