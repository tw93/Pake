/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './ui/**/*.{js,ts,jsx,tsx}',
  ],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    styled: true,
    themes: [
      {
        lofi: {
          ...require('daisyui/src/colors/themes')['[data-theme=lofi]'],
          primary: '#010101',
          'primary-content': '#ffffff',
          '--rounded-btn': '6px',
        },
      },
    ],
    base: true,
    utils: true,
    log: false,
  },
};
