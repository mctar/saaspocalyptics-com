/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The FT salmon paper and its warm ink — the whole identity hangs on these.
        paper: '#FFF1E5',
        paper2: '#F7E7D8', // zebra / deeper salmon for alternating rows
        card: '#FCEDE0',
        ink: '#2B2A28',
        'ink-soft': '#6B645E',
        'ink-faint': '#A39A91',
        rule: 'rgba(43, 42, 40, 0.16)',
        // Editorial market palette: claret down, teal up — never neon.
        claret: '#990F3D',
        teal: '#0D7680',
        blue: '#0F5499',
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['"Libre Franklin"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
