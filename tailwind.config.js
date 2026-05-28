/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pl-navy': '#0f172a',
        'pl-navy-light': '#1e293b',
        'pl-navy-800': '#213145',
        'pl-indigo': '#4f46e5',
        'pl-indigo-600': '#6366f1',
        'pl-amber': '#f59e0b',
        'pl-green': '#10b981',
        'pl-blue': '#3b82f6',
        'pl-red': '#ef4444',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
