/**
 * Evolution Combatives Theme Provider
 * Handles light/dark mode switching with system preference detection
 * 
 * @description Professional theme system for tactical training admin interface
 * @author Evolution Combatives
 */

'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
    theme: Theme
    resolvedTheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
    children: React.ReactNode
    defaultTheme?: Theme
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(defaultTheme)
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')
    const [mounted, setMounted] = useState(false)

    // Get theme from localStorage or use default
    useEffect(() => {
        const savedTheme = localStorage.getItem('evolution-combatives-theme') as Theme
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
            setTheme(savedTheme)
        }
        setMounted(true)
    }, [])

    // Resolve theme based on system preference
    useEffect(() => {
        const updateResolvedTheme = () => {
            let resolved: 'light' | 'dark'

            if (theme === 'system') {
                resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
            } else {
                resolved = theme
            }

            setResolvedTheme(resolved)

            // Update document class
            const root = document.documentElement
            root.classList.remove('light', 'dark')
            root.classList.add(resolved)

            // Also update data attribute for better CSS targeting
            root.setAttribute('data-theme', resolved)

            // Update CSS variables for smooth transitions
            if (resolved === 'dark') {
                root.style.setProperty('--background', '15 23 42') // neutral-900
                root.style.setProperty('--foreground', '248 250 252') // neutral-50
                root.style.setProperty('--card', '30 41 59') // neutral-800
                root.style.setProperty('--card-foreground', '248 250 252') // neutral-50
                root.style.setProperty('--popover', '30 41 59') // neutral-800
                root.style.setProperty('--popover-foreground', '248 250 252') // neutral-50
                root.style.setProperty('--primary', '37 130 246') // primary-500
                root.style.setProperty('--primary-foreground', '255 255 255')
                root.style.setProperty('--secondary', '51 65 85') // neutral-700
                root.style.setProperty('--secondary-foreground', '248 250 252') // neutral-50
                root.style.setProperty('--muted', '51 65 85') // neutral-700
                root.style.setProperty('--muted-foreground', '148 163 184') // neutral-400
                root.style.setProperty('--accent', '51 65 85') // neutral-700
                root.style.setProperty('--accent-foreground', '248 250 252') // neutral-50
                root.style.setProperty('--destructive', '239 68 68') // error-500
                root.style.setProperty('--destructive-foreground', '248 250 252') // neutral-50
                root.style.setProperty('--border', '71 85 105') // neutral-600
                root.style.setProperty('--input', '71 85 105') // neutral-600
                root.style.setProperty('--ring', '37 130 246') // primary-500
            } else {
                root.style.setProperty('--background', '255 255 255') // white
                root.style.setProperty('--foreground', '15 23 42') // neutral-900
                root.style.setProperty('--card', '255 255 255') // white
                root.style.setProperty('--card-foreground', '15 23 42') // neutral-900
                root.style.setProperty('--popover', '255 255 255') // white
                root.style.setProperty('--popover-foreground', '15 23 42') // neutral-900
                root.style.setProperty('--primary', '37 130 246') // primary-500
                root.style.setProperty('--primary-foreground', '255 255 255')
                root.style.setProperty('--secondary', '241 245 249') // neutral-100
                root.style.setProperty('--secondary-foreground', '15 23 42') // neutral-900
                root.style.setProperty('--muted', '241 245 249') // neutral-100
                root.style.setProperty('--muted-foreground', '100 116 139') // neutral-500
                root.style.setProperty('--accent', '241 245 249') // neutral-100
                root.style.setProperty('--accent-foreground', '15 23 42') // neutral-900
                root.style.setProperty('--destructive', '239 68 68') // error-500
                root.style.setProperty('--destructive-foreground', '248 250 252') // neutral-50
                root.style.setProperty('--border', '226 232 240') // neutral-200
                root.style.setProperty('--input', '226 232 240') // neutral-200
                root.style.setProperty('--ring', '37 130 246') // primary-500
            }
        }

        if (mounted) {
            updateResolvedTheme()
        }

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
            if (theme === 'system') {
                updateResolvedTheme()
            }
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [theme, mounted])

    const handleSetTheme = (newTheme: Theme) => {
        setTheme(newTheme)
        localStorage.setItem('evolution-combatives-theme', newTheme)
    }

    const toggleTheme = () => {
        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
        handleSetTheme(newTheme)
    }

    const value = {
        theme,
        resolvedTheme,
        setTheme: handleSetTheme,
        toggleTheme,
    }

    // Prevent hydration mismatch by showing dark theme as default
    if (!mounted) {
        return (
            <div className="dark" data-theme="dark" style={{
                backgroundColor: 'rgb(15, 23, 42)',
                color: 'rgb(248, 250, 252)'
            }}>
                {children}
            </div>
        )
    }

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

// Safe theme toggle component that handles context gracefully
export function ThemeToggle() {
    const [mounted, setMounted] = useState(false)
    const context = useContext(ThemeContext)

    // Only access theme context after component is mounted
    useEffect(() => {
        setMounted(true)
    }, [])

    // Don't render anything until mounted to prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="h-10 w-10 rounded-md border border-border bg-background animate-pulse" />
        )
    }

    // If context is not available, render fallback
    if (!context) {
        console.warn('ThemeToggle: Theme context not available, rendering fallback')
        return (
            <div className="h-10 w-10 rounded-md border border-border bg-background flex items-center justify-center">
                <svg
                    className="h-5 w-5 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                </svg>
            </div>
        )
    }

    const { resolvedTheme, toggleTheme } = context

    return (
        <button
            onClick={toggleTheme}
            className={`
                relative inline-flex h-10 w-10 items-center justify-center rounded-md
                border border-border bg-background text-foreground 
                hover:bg-accent hover:text-accent-foreground
                focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                transition-colors duration-200
            `}
            aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {resolvedTheme === 'dark' ? (
                // Sun icon for light mode
                <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                </svg>
            ) : (
                // Moon icon for dark mode
                <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                </svg>
            )}
        </button>
    )
}
