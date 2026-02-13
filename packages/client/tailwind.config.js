/**
 * Tailwind CSS v4 Configuration
 *
 * In Tailwind v4, theme configuration has moved to the @theme directive
 * in src/index.css. This file is retained only for tooling compatibility
 * (IDE plugins, Prettier plugin, etc.) but does NOT drive the build.
 *
 * The actual theme (colors, fonts, animations, keyframes) is defined in:
 *   src/index.css → @theme { ... }
 *
 * The build is driven by @tailwindcss/postcss in postcss.config.js.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
};
