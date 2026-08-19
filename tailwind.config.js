/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        'navy-dark': '#29165E',
        'navy-medium': '#3D464D',
        'charcoal': '#212A2F',
        // Accent
        'purple-soft': '#DCBBF5',
        'purple-light': '#E7E3FF',
        'purple-mid': '#5E4C92',
        'purple-sky': '#F0F3FF',
        'dark-navy': 'rgb(19, 0, 65)',
        // Interactive
        'slate-primary': '#667280',
        'slate-secondary': '#6B7280',
        // Neutral
        'off-white': '#F5F6F7',
        'gray-medium': '#D9D9D9',
        'gray-text': '#666666',
        'dark-gray': '#75797C',
        // Border
        'border-light': '#D9D9D9',
        'border-input': 'rgb(231, 236, 244)',
        // Status
        'error': '#D32F2F',
        'success': '#2E7D32',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['monaco', '"Courier New"', 'monospace'],
      },
      fontSize: {
        'xs':  ['12px', { lineHeight: '18px' }],
        'sm':  ['14px', { lineHeight: '22.82px' }],
        'base':['16px', { lineHeight: '28.8px' }],
        'h4b': ['21.5px', { lineHeight: '23.65px', fontWeight: '900' }],
        'h4m': ['25px', { lineHeight: '27.5px', fontWeight: '500' }],
        'h1':  ['42px', { lineHeight: '42px', fontWeight: '900' }],
        'hero':['72px', { lineHeight: '74.88px', fontWeight: '900' }],
      },
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '18': '72px',
        '22': '88px',
        '45': '180px',
      },
      borderRadius: {
        'none': '0px',
        'badge': '2.5px',
        'input': '3px',
        'card': '5px',
        'pill': '999px',
      },
      boxShadow: {
        'card-sm': 'rgba(0, 0, 0, 0.1) 0px 10px 30px -10px',
        'card-md': 'rgba(0, 0, 0, 0.1) 0px 10px 30px 0px',
        'btn-inner': 'rgba(255, 255, 255, 0.9) 0px 1px 0px 0px inset',
        'focus-navy': '0 0 0 3px rgba(41, 22, 94, 0.1)',
      },
      zIndex: {
        '102': '102',
        '103': '103',
        '1001': '1001',
        '1002': '1002',
      },
      maxWidth: {
        'container': '1240px',
      },
    },
  },
  plugins: [],
}
