export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 700: '#0d2a52', 800: '#0a2040', 900: '#081B35', 950: '#061329' },
        accent: { DEFAULT: '#00B7FF', soft: '#38c8ff' },
      },
      fontFamily: { sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'] },
    },
  },
};
