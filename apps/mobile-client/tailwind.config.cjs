/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core dark palette
        void: {
          950: '#020408',
          900: '#050810',
          800: '#0a0f1e',
          700: '#0f1628',
          600: '#151e35',
        },
        // Desk surface tones
        desk: {
          900: '#0d1117',
          800: '#161b27',
          700: '#1c2333',
          600: '#21293d',
          500: '#2d3748',
        },
        // Brand accent — classified gold
        classified: {
          DEFAULT: '#c9a84c',
          light: '#e8c96b',
          dark: '#9d7c2e',
          glow: 'rgba(201,168,76,0.15)',
        },
        // Reactor blue
        reactor: {
          DEFAULT: '#1e90ff',
          light: '#5eb3ff',
          dark: '#0066cc',
          glow: 'rgba(30,144,255,0.15)',
        },
        // Status colors
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        // Platform colors
        platform: {
          instagram: '#e1306c',
          facebook: '#1877f2',
          tiktok: '#010101',
          linkedin: '#0a66c2',
          x: '#000000',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        heading: ['"Barlow Condensed"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        classified: ['"Courier Prime"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'classified': '0 0 20px rgba(201,168,76,0.2), 0 0 60px rgba(201,168,76,0.05)',
        'classified-lg': '0 0 40px rgba(201,168,76,0.3), 0 0 80px rgba(201,168,76,0.1)',
        'reactor': '0 0 20px rgba(30,144,255,0.25), 0 0 60px rgba(30,144,255,0.08)',
        'reactor-lg': '0 0 40px rgba(30,144,255,0.35), 0 0 100px rgba(30,144,255,0.12)',
        'desk': '0 4px 24px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04)',
        'panel': 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.4)',
      },
      backgroundImage: {
        'desk-surface': 'radial-gradient(ellipse at 50% 0%, #151e35 0%, #050810 70%)',
        'panel-gradient': 'linear-gradient(135deg, #0d1117 0%, #0a0f1e 100%)',
        'classified-gradient': 'linear-gradient(135deg, #c9a84c 0%, #9d7c2e 100%)',
        'reactor-gradient': 'linear-gradient(135deg, #1e90ff 0%, #0066cc 100%)',
        'scanline': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
      },
      animation: {
        'pulse-classified': 'pulseClassified 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-reactor': 'pulseReactor 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'flicker': 'flicker 0.15s infinite',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        pulseClassified: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(201,168,76,0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(201,168,76,0.4)' },
        },
        pulseReactor: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(30,144,255,0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(30,144,255,0.5)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        slideUp: {
          from: { transform: 'translateY(16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        slideRight: {
          from: { transform: 'translateX(-16px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { transform: 'scale(0.94)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
