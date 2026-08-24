import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAF8F3',
        ink: '#172033',
        muted: '#667085',
        line: '#E4E0D8',
        brand: '#2563EB',
        navy: '#0B1F36',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 32, 51, 0.04), 0 8px 24px rgba(23, 32, 51, 0.04)',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [forms],
};
