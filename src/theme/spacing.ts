/**
 * Evolution Combatives Spacing System
 * Implements an 8px grid system with a 4px base unit, identical to the mobile app.
 *
 * @author Evolution Combatives
 */

// Using a 4px base unit, where 1 unit = 0.25rem
export const spacing = {
    '0': '0',
    px: '1px',
    '1': '0.25rem', // 4px
    '2': '0.5rem', // 8px
    '3': '0.75rem', // 12px
    '4': '1rem', // 16px
    '5': '1.25rem', // 20px
    '6': '1.5rem', // 24px
    '8': '2rem', // 32px
    '10': '2.5rem', // 40px
    '12': '3rem', // 48px
    '16': '4rem', // 64px
    '20': '5rem', // 80px
    '24': '6rem', // 96px
    '32': '8rem', // 128px
    '40': '10rem', // 160px
    '48': '12rem', // 192px
    '56': '14rem', // 224px
    '64': '16rem', // 256px
};

export type Spacing = typeof spacing;

/**
 * Border radius values matching Tailwind's scale
 */
export const borderRadius = {
    none: '0',
    sm: '0.125rem',   // 2px
    DEFAULT: '0.25rem', // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
} as const

/**
 * Semantic spacing for tactical admin interfaces
 * These create custom Tailwind utilities
 */
export const semantic = {
    // Component spacing
    'component-tight': spacing['2'],      // 8px
    'component-normal': spacing['4'],     // 16px
    'component-loose': spacing['6'],      // 24px
    'component-extra-loose': spacing['8'], // 32px

    // Layout spacing  
    'layout-small': spacing['8'],         // 32px
    'layout-medium': spacing['12'],       // 48px
    'layout-large': spacing['16'],        // 64px
    'layout-xlarge': spacing['24'],       // 96px

    // Container spacing
    'container-tight': spacing['4'],      // 16px
    'container-normal': spacing['6'],     // 24px
    'container-loose': spacing['8'],      // 32px
    'container-extra-loose': spacing['12'], // 48px

    // Interactive spacing
    'button-sm-x': spacing['3'],          // 12px
    'button-sm-y': spacing['2'],          // 8px
    'button-md-x': spacing['4'],          // 16px
    'button-md-y': spacing['3'],          // 12px
    'button-lg-x': spacing['6'],          // 24px
    'button-lg-y': spacing['4'],          // 16px

    'input-x': spacing['3'],              // 12px
    'input-y': spacing['3'],              // 12px

    'card-sm': spacing['4'],              // 16px
    'card-md': spacing['6'],              // 24px
    'card-lg': spacing['8'],              // 32px

    // Admin-specific spacing
    'sidebar-padding': spacing['6'],      // 24px
    'sidebar-item-gap': spacing['2'],     // 8px
    'header-padding': spacing['4'],       // 16px
    'header-height': spacing['16'],       // 64px
    'table-cell': spacing['3'],           // 12px
} as const

/**
 * Screen edge spacing for responsive design
 */
export const screenEdge = {
    mobile: spacing['4'],      // 16px
    tablet: spacing['6'],      // 24px  
    desktop: spacing['8'],     // 32px
    'large-desktop': spacing['12'], // 48px
} as const

/**
 * Complete spacing system for Tailwind CSS 4
 */
export const spacingSystem = {
    spacing,
    borderRadius,
    semantic,
    screenEdge,
} as const

export default spacingSystem 