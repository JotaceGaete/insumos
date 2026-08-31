/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        insumos: {
          forest: '#1F3D2B',
          'forest-dark': '#132819',
          sage: '#4C7A5E',
          mint: '#E4EFE3',
          cream: '#FBF7EE',
          sand: '#EDE4D3',
          ink: '#16231A',
          line: '#E4E0D3',
        },
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
};


