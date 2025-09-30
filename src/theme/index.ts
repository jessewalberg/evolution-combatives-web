/**
 * Evolution Combatives Design System
 * The central hub for the admin dashboard's design tokens and utilities.
 *
 * @author Evolution Combatives
 */

import { colors, type Colors } from './colors';
import { spacing, type Spacing } from './spacing';
import { typography, type Typography } from './typography';

// The complete design system tokens
export const theme = {
    colors,
    spacing,
    typography,
};

// Tailwind utility classes for consistent styling
export const tw = {
    heading: {
        h1: 'text-4xl font-bold text-foreground',
        h2: 'text-3xl font-semibold text-foreground',
        h3: 'text-2xl font-medium text-foreground',
        h4: 'text-xl font-medium text-foreground',
        h5: 'text-lg font-medium text-foreground',
        h6: 'text-base font-medium text-foreground',
    },
    body: {
        large: 'text-lg text-foreground',
        normal: 'text-base text-foreground',
        base: 'text-base text-foreground',
        small: 'text-sm text-muted-foreground',
        xs: 'text-xs text-muted-foreground',
    },
    text: {
        primary: 'text-foreground',
        secondary: 'text-muted-foreground',
        accent: 'text-primary',
    },
    shadow: {
        elevation1: 'shadow-sm',
        elevation2: 'shadow-md',
        elevation3: 'shadow-lg',
        elevation4: 'shadow-xl',
        elevation5: 'shadow-2xl',
        elevation6: 'shadow-inner',
    },
};

// Component class mappings for consistent layout
export const componentClasses = {
    layout: {
        page: 'min-h-screen bg-background',
        container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
        section: 'py-8',
    },
    card: {
        base: 'bg-card rounded-lg shadow-sm border border-border',
        default: 'bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6',
        elevated: 'bg-card text-card-foreground rounded-lg shadow-lg border border-border p-6',
        interactive: 'bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6 hover:shadow-md transition-shadow cursor-pointer',
        header: 'px-6 py-4 border-b border-border',
        content: 'px-6 py-4',
    },
    button: {
        primary: 'bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500',
        success: 'bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
        warning: 'bg-yellow-500 text-white font-semibold rounded-md shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400',
        error: 'bg-red-600 text-white font-semibold rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500',
    },
    input: {
        default: 'block w-full px-4 py-2 text-base text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500',
        success: 'block w-full px-4 py-2 text-base text-green-900 bg-green-50 border border-green-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500',
        error: 'block w-full px-4 py-2 text-base text-red-900 bg-red-50 border border-red-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500',
    },
    icon: {
        default: 'w-6 h-6 text-gray-500',
        primary: 'w-6 h-6 text-blue-600',
        secondary: 'w-6 h-6 text-gray-400',
    },
    badge: {
        base: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-normal transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none',
        default: 'bg-muted text-muted-foreground border border-border hover:bg-accent',
        primary: 'bg-primary text-primary-foreground border border-primary hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/90',
        success: 'bg-green-600 dark:bg-green-700 text-white border border-green-600 dark:border-green-700 hover:bg-green-700 dark:hover:bg-green-800',
        warning: 'bg-yellow-600 dark:bg-yellow-700 text-white border border-yellow-600 dark:border-yellow-700 hover:bg-yellow-700 dark:hover:bg-yellow-800',
        error: 'bg-destructive text-destructive-foreground border border-destructive hover:bg-destructive/90',
        info: 'bg-blue-600 dark:bg-blue-700 text-white border border-blue-600 dark:border-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800',
        gold: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900 dark:text-amber-100 border border-amber-400 hover:from-amber-500 hover:to-yellow-600',
    },
    dialog: {
        overlay: 'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        content: 'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] grid w-full gap-4 border border-neutral-700 bg-neutral-800 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg text-neutral-0',
    },
};

// Exporting types for use in components
export type { Colors, Spacing, Typography };

export default theme; 