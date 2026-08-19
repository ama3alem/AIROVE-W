/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fc',
          400: '#36aaf8',
          500: '#0c90e9',
          600: '#0072c7',
          700: '#015aa2',
          800: '#064c85',
          900: '#0b406e',
          950: '#072849',
        },
        aviation: {
          50: '#f4f7fb',
          100: '#e8eef6',
          200: '#ccdfeb',
          300: '#a0c5db',
          400: '#6da6c5',
          500: '#4a8aaf',
          600: '#386f93',
          700: '#2f5a78',
          800: '#2b4d64',
          900: '#284154',
          950: '#1a2a38',
        },
        ops: {
          green: '#10b981',
          yellow: '#f59e0b',
          red: '#ef4444',
          blue: '#3b82f6',
          gray: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
