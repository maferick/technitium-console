/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0e0f13',
        surface: '#16181d',
        surface2: '#1c1f26',
        surface3: '#242a33',
        edge: 'rgba(255,255,255,0.05)',
        line: '#262a33',
        line2: '#333a47',
        txt: '#eef1f4',
        dim: '#a3acba',
        mut: '#6b7585',
        accent: '#a3e635',
        accent2: '#84cc16',
        mag: '#e879f9',
        ok: '#4ade80',
        bad: '#fb7185',
        warn: '#fbbf24',
        violet: '#c084fc',
        cyan: '#22d3ee',
        blue: '#60a5fa',
        teal: '#2dd4bf',
        olive: '#bef264',
      },
      fontFamily: {
        sans: ['Geist', '"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.05) inset, 0 1px 2px rgba(0,0,0,0.5), 0 14px 40px -22px rgba(0,0,0,0.85)',
        glow: '0 6px 20px -6px rgba(163,230,53,0.55)',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: { fadeUp: 'fadeUp .4s cubic-bezier(.2,.7,.2,1) both' },
    },
  },
  plugins: [],
}
