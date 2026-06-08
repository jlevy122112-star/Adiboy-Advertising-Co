import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bafd',
          400: '#8193fb',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          DEFAULT: '#0a0a0f',
          1: '#111118',
          2: '#18181f',
          3: '#1f1f28',
          4: '#26263a',
        },
        gold: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cal Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'desk-gradient': 'radial-gradient(ellipse at 50% 0%, #1e1b4b 0%, #0a0a0f 70%)',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
        'glow-brand': 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        'glass': '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow': '0 0 40px rgba(99,102,241,0.4)',
        'glow-sm': '0 0 20px rgba(99,102,241,0.25)',
        'desk': '0 40px 80px rgba(0,0,0,0.8)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.3s ease-out',
        'door-open': 'door-open 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99,102,241,0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(99,102,241,0.8)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'door-open': {
          from: { transform: 'perspective(800px) rotateY(0deg)' },
          to: { transform: 'perspective(800px) rotateY(-85deg)' },
        },
      },
      perspective: {
        '500': '500px',
        '800': '800px',
        '1200': '1200px',
      },
    },
  },
  plugins: [],
} satisfies Config
