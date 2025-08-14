/**
 * Evolution Combatives Color System
 * A professional and tactical color palette for the web admin interface.
 * This system is designed for a dark theme by default, matching the mobile app's aesthetic.
 *
 * @author Evolution Combatives
 */

// Type definition for a full color scale
export type ColorScale = {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
};

// Primary Brand Colors - Evolution Combatives Blue
export const primary: ColorScale = {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb', // Core primary blue
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
};

// Neutral Colors - Tactical Grays for Dark Theme
export const neutral: ColorScale & { 0: string; 1000: string } = {
    0: '#ffffff',
    50: '#f8fafc',
    100: '#f1f5f9', // Lightest gray for contrast on dark backgrounds
    200: '#e2e8f0',
    300: '#cbd5e1', // Disabled text
    400: '#94a3b8', // Tertiary text, icons
    500: '#64748b', // Secondary text, icons
    600: '#475569', // Primary borders
    700: '#334155', // Card backgrounds, elevated surfaces
    800: '#1e293b', // Secondary background
    900: '#0f172a', // Primary background
    950: '#020617', // Darkest background
    1000: '#000000',
};

// Semantic Colors for UI Feedback
export const success: ColorScale = {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
};

export const warning: ColorScale = {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#facc15',
    500: '#eab308',
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
    950: '#451a03',
};

export const error: ColorScale = {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
};

// The complete color system for Tailwind CSS
export const colors = {
    transparent: 'transparent',
    current: 'currentColor',
    primary,
    neutral,
    success,
    warning,
    error,
    // Direct alias for simpler use in Tailwind
    blue: primary,
    gray: neutral,
    green: success,
    yellow: warning,
    red: error,
};

export type Colors = typeof colors; 