/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: '#0a0a0a',
                surface: '#111111',
                border: '#1a1a1a',
                muted: '#333333',
                text: '#e8e8e8',
                subtle: '#666666',
                accent: '#00ff88',
            },
            fontFamily: {
                mono: ['"Space Mono"', 'monospace'],
                sans: ['"Syne"', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '4px',
                md: '4px',
                lg: '4px',
                xl: '4px',
                '2xl': '4px',
                '3xl': '4px',
            }
        },
    },
    plugins: [],
}
