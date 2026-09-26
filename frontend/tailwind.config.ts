import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'sans-serif'],
      },
      colors: {
        ink: {
          base: '#F8FAFC',
          surface: '#FFFFFF',
          raised: '#F1F5F9',
        },
        accent: {
          primary: '#16A34A',
          secondary: '#D97706',
        },
        status: {
          success: '#16A34A',
          warning: '#D97706',
          critical: '#DC2626',
        },
        content: {
          primary: '#0F172A',
          secondary: '#64748B',
        }
      }
    },
  },
  plugins: [],
}
export default config
