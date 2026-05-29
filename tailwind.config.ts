import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          0: '#0A0A0B',
          1: '#111113',
          2: '#16161A',
          3: '#1D1D22',
        },
        border: {
          soft: 'rgba(255,255,255,0.06)',
          mid: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.18)',
        },
        text: {
          100: 'rgba(255,255,255,0.96)',
          80: 'rgba(255,255,255,0.78)',
          60: 'rgba(255,255,255,0.56)',
          40: 'rgba(255,255,255,0.36)',
          30: 'rgba(255,255,255,0.24)',
          20: 'rgba(255,255,255,0.16)',
        },
        accent: {
          DEFAULT: '#B8FF5C',
          dim: '#7FBF3F',
        },
        score: {
          green: '#4ADE80',
          yellow: '#FACC15',
          orange: '#FB923C',
          red: '#F87171',
          blue: '#60A5FA',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Times New Roman', 'serif'],
        body: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      letterSpacing: {
        'mono-wide': '0.14em',
      },
    },
  },
  plugins: [],
};

export default config;
