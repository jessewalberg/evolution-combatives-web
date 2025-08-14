import type { Config } from 'tailwindcss'
import { colors } from './src/theme/colors'
import { spacing } from './src/theme/spacing'
import { typography } from './src/theme/typography'

/**
 * Evolution Combatives Tailwind CSS 4 Configuration
 * Integrates our custom design system with Tailwind's utility classes
 * 
 * @description Professional tactical training platform styling
 * @author Evolution Combatives
 */
const config: Config = {
    darkMode: 'class',
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './src/components/**/*.{js,ts,jsx,tsx}',
        './src/app/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors,
            spacing,
            ...typography,
            borderRadius: {
                none: '0',
                sm: '0.125rem',
                DEFAULT: '0.25rem',
                md: '0.375rem',
                lg: '0.5rem',
                xl: '0.75rem',
                '2xl': '1rem',
                '3xl': '1.5rem',
                full: '9999px',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
}

export default config 