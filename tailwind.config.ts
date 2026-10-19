import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nền chính: Trắng xanh nhạt dịu mắt
        background: '#F4F7FE',
        // Thẻ nội dung: Trắng tinh
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8FAFC',
          subtle: '#EEF2FF',
        },
        // Màu nhấn chủ đạo: Tím Lavender / Violet
        primary: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          DEFAULT: '#8B5CF6', // Violet 500
          accent: '#A855F7',  // Purple 500
          600: '#7C3AED',
          700: '#6D28D9',
        },
        // Màu ngữ nghĩa (Semantic Colors)
        semantic: {
          safe: {
            light: '#D1FAE5',
            DEFAULT: '#10B981', // Xanh thu nhập / An toàn
            dark: '#047857',
          },
          warning: {
            light: '#FFEDD5',
            DEFAULT: '#F97316', // Cam chi tiêu / Cảnh báo
            dark: '#C2410C',
          },
          danger: {
            light: '#FEE2E2',
            DEFAULT: '#EF4444', // Đỏ vượt hạn mức
            dark: '#B91C1C',
          },
        },
        // Hệ màu chữ độ tương phản cao chuẩn Apple
        ink: {
          primary: '#1E293B',   // Slate 800 - Dịu mắt hơn đen tuyền
          secondary: '#64748B', // Slate 500
          muted: '#94A3B8',     // Slate 400
        },
      },
      borderRadius: {
        '2xl': '1.25rem', // 20px - Chuẩn Soft Card trung bình
        '3xl': '1.5rem',  // 24px - Chuẩn Soft Card lớn
      },
      boxShadow: {
        // Đổ bóng mịn lan tỏa đặc trưng của Soft UI
        'soft': '0 8px 30px rgb(0, 0, 0, 0.04)',
        'soft-md': '0 12px 36px rgb(0, 0, 0, 0.06)',
        'soft-primary': '0 8px 24px -4px rgba(139, 92, 246, 0.35)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.03)',
      },
      transitionTimingFunction: {
        'apple-spring': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;