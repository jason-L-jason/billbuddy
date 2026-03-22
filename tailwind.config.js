/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          light: '#EFF6FF',
          fade: 'rgba(37,99,235,0.08)',
        },
        page: '#F5F6FA',
        success: { DEFAULT: '#059669', light: '#ECFDF5' },
        warning: { DEFAULT: '#D97706', light: '#FFFBEB' },
        danger: { DEFAULT: '#DC2626', light: '#FEF2F2' },
        info: { DEFAULT: '#2563EB', light: '#EFF6FF' },
        cat: {
          food: '#EF6C57',
          transport: '#38BDF8',
          daily: '#FBBF24',
          housing: '#8B5CF6',
          fashion: '#EC4899',
          digital: '#3B82F6',
          enter: '#10B981',
          health: '#06B6D4',
          edu: '#7C3AED',
          tel: '#6366F1',
          fin: '#F59E0B',
          transfer: '#F43F5E',
          none: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', '"Cascadia Code"', '"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'r-sm': '6px',
        'r-md': '10px',
        'r-lg': '16px',
        'r-xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.06)',
        'modal': '0 4px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
