/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
        },
        border: {
          color: 'var(--border-color)',
          subtle: 'var(--border-subtle)',
        },
        theme: {
          hover: 'var(--hover-bg)',
          active: 'var(--active-bg)',
          overlay: 'var(--overlay-bg)',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        rejected: {
          DEFAULT: '#ef4444',
          overlay: 'rgba(239, 68, 68, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'theme': 'var(--card-shadow)',
      },
    },
  },
  plugins: [],
};
