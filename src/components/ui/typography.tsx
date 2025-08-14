/**
 * Evolution Combatives Typography Component System
 * Professional typography components for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Typography components matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Color variants for text components
 */
type TextColor =
    | 'primary'     // neutral-0 (white)
    | 'secondary'   // neutral-300 (light gray)
    | 'tertiary'    // neutral-400 (medium gray)
    | 'muted'       // neutral-500 (muted gray)
    | 'disabled'    // neutral-600 (disabled gray)
    | 'brand'       // primary-600 (brand blue)
    | 'success'     // success-500 (green)
    | 'warning'     // warning-500 (orange)
    | 'error'       // error-500 (red)
    | 'info'        // info-500 (blue)
    | 'white'       // Pure white
    | 'inherit'     // Inherit from parent

/**
 * Font weight variants
 */
type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold'

/**
 * Get color class from color variant
 */
const getColorClass = (color: TextColor): string => {
    const colorMap = {
        primary: 'text-neutral-0',
        secondary: 'text-neutral-300',
        tertiary: 'text-neutral-400',
        muted: 'text-neutral-500',
        disabled: 'text-neutral-600',
        brand: 'text-primary-600',
        success: 'text-success-500',
        warning: 'text-warning-500',
        error: 'text-error-500',
        info: 'text-info-500',
        white: 'text-white',
        inherit: 'text-inherit',
    }
    return colorMap[color]
}

/**
 * Get font weight class from weight variant
 */
const getFontWeightClass = (weight: FontWeight): string => {
    const weightMap = {
        normal: 'font-normal',
        medium: 'font-medium',
        semibold: 'font-semibold',
        bold: 'font-bold',
    }
    return weightMap[weight]
}

// ============================================================================
// HEADING COMPONENTS
// ============================================================================

/**
 * Heading component variants
 */
const headingVariants = cva(
    'font-sans tracking-tight',
    {
        variants: {
            level: {
                h1: 'text-4xl font-bold leading-tight',      // 36px, bold, tight
                h2: 'text-3xl font-semibold leading-tight',  // 30px, semibold, tight
                h3: 'text-2xl font-semibold leading-snug',   // 24px, semibold, snug
                h4: 'text-xl font-medium leading-snug',      // 20px, medium, snug
            }
        }
    }
)

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode
    color?: TextColor
    weight?: FontWeight
    className?: string
}

/**
 * H1 Component - Main page headings
 */
const H1 = React.forwardRef<HTMLHeadingElement, HeadingProps>(
    ({ children, color = 'primary', weight, className, ...props }, ref) => {
        return (
            <h1
                ref={ref}
                className={cn(
                    headingVariants({ level: 'h1' }),
                    getColorClass(color),
                    weight && getFontWeightClass(weight),
                    className
                )}
                {...props}
            >
                {children}
            </h1>
        )
    }
)
H1.displayName = 'H1'

/**
 * H2 Component - Section headings
 */
const H2 = React.forwardRef<HTMLHeadingElement, HeadingProps>(
    ({ children, color = 'primary', weight, className, ...props }, ref) => {
        return (
            <h2
                ref={ref}
                className={cn(
                    headingVariants({ level: 'h2' }),
                    getColorClass(color),
                    weight && getFontWeightClass(weight),
                    className
                )}
                {...props}
            >
                {children}
            </h2>
        )
    }
)
H2.displayName = 'H2'

/**
 * H3 Component - Subsection headings
 */
const H3 = React.forwardRef<HTMLHeadingElement, HeadingProps>(
    ({ children, color = 'primary', weight, className, ...props }, ref) => {
        return (
            <h3
                ref={ref}
                className={cn(
                    headingVariants({ level: 'h3' }),
                    getColorClass(color),
                    weight && getFontWeightClass(weight),
                    className
                )}
                {...props}
            >
                {children}
            </h3>
        )
    }
)
H3.displayName = 'H3'

/**
 * H4 Component - Minor headings
 */
const H4 = React.forwardRef<HTMLHeadingElement, HeadingProps>(
    ({ children, color = 'primary', weight, className, ...props }, ref) => {
        return (
            <h4
                ref={ref}
                className={cn(
                    headingVariants({ level: 'h4' }),
                    getColorClass(color),
                    weight && getFontWeightClass(weight),
                    className
                )}
                {...props}
            >
                {children}
            </h4>
        )
    }
)
H4.displayName = 'H4'

// ============================================================================
// TEXT COMPONENTS
// ============================================================================

/**
 * Text component variants
 */
const textVariants = cva(
    'font-sans',
    {
        variants: {
            variant: {
                large: 'text-lg leading-relaxed',        // 18px, relaxed
                base: 'text-base leading-normal',        // 16px, normal
                small: 'text-sm leading-normal',         // 14px, normal
                xs: 'text-xs leading-normal',            // 12px, normal
            }
        },
        defaultVariants: {
            variant: 'base'
        }
    }
)

interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode
    variant?: 'large' | 'base' | 'small' | 'xs'
    color?: TextColor
    weight?: FontWeight
    className?: string
    as?: 'p' | 'span' | 'div'
}

/**
 * Text Component - Main text content
 */
const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
    ({ children, variant = 'base', color = 'primary', weight, className, as: Component = 'p', ...props }, ref) => {
        return (
            <Component
                ref={ref}
                className={cn(
                    textVariants({ variant }),
                    getColorClass(color),
                    weight && getFontWeightClass(weight),
                    className
                )}
                {...props}
            >
                {children}
            </Component>
        )
    }
)
Text.displayName = 'Text'

/**
 * Label Component - Form field labels
 */
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
    children: React.ReactNode
    color?: TextColor
    weight?: FontWeight
    required?: boolean
    className?: string
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
    ({ children, color = 'primary', weight = 'medium', required, className, ...props }, ref) => {
        return (
            <label
                ref={ref}
                className={cn(
                    'text-sm leading-normal',
                    getColorClass(color),
                    getFontWeightClass(weight),
                    required && "after:content-['*'] after:ml-0.5 after:text-error-500",
                    className
                )}
                {...props}
            >
                {children}
            </label>
        )
    }
)
Label.displayName = 'Label'

/**
 * Caption Component - Metadata and secondary information
 */
interface CaptionProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode
    color?: TextColor
    weight?: FontWeight
    className?: string
    uppercase?: boolean
}

const Caption = React.forwardRef<HTMLSpanElement, CaptionProps>(
    ({ children, color = 'tertiary', weight = 'normal', uppercase, className, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    'text-xs leading-normal tracking-wide',
                    getColorClass(color),
                    getFontWeightClass(weight),
                    uppercase && 'uppercase',
                    className
                )}
                {...props}
            >
                {children}
            </span>
        )
    }
)
Caption.displayName = 'Caption'

/**
 * Code Component - Technical content and code snippets
 */
interface CodeProps extends React.HTMLAttributes<HTMLElement> {
    children: React.ReactNode
    color?: TextColor
    className?: string
    inline?: boolean
}

const Code = React.forwardRef<HTMLElement, CodeProps>(
    ({ children, color = 'primary', className, inline = true, ...props }, ref) => {
        if (inline) {
            return (
                <code
                    ref={ref as React.Ref<HTMLElement>}
                    className={cn(
                        'font-mono text-sm leading-normal px-1.5 py-0.5 bg-neutral-800 rounded border border-neutral-700',
                        getColorClass(color),
                        className
                    )}
                    {...props}
                >
                    {children}
                </code>
            )
        }

        return (
            <pre
                ref={ref as React.Ref<HTMLPreElement>}
                className={cn(
                    'font-mono text-sm leading-normal p-4 bg-neutral-800 rounded-lg border border-neutral-700 overflow-x-auto',
                    getColorClass(color),
                    className
                )}
                {...props}
            >
                {children}
            </pre>
        )
    }
)
Code.displayName = 'Code'

// ============================================================================
// SPECIALIZED TEXT COMPONENTS
// ============================================================================

/**
 * Link Component - Interactive links with hover states
 */
interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    children: React.ReactNode
    color?: TextColor
    weight?: FontWeight
    underline?: boolean
    className?: string
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
    ({ children, color = 'brand', weight = 'medium', underline = true, className, ...props }, ref) => {
        return (
            <a
                ref={ref}
                className={cn(
                    'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-sm',
                    getColorClass(color),
                    getFontWeightClass(weight),
                    underline && 'underline underline-offset-2',
                    'hover:text-primary-400 hover:decoration-primary-400',
                    className
                )}
                {...props}
            >
                {children}
            </a>
        )
    }
)
Link.displayName = 'Link'

/**
 * Muted Component - De-emphasized text
 */
interface MutedProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode
    className?: string
}

const Muted = React.forwardRef<HTMLSpanElement, MutedProps>(
    ({ children, className, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn('text-sm text-neutral-500', className)}
                {...props}
            >
                {children}
            </span>
        )
    }
)
Muted.displayName = 'Muted'

/**
 * ErrorText Component - Error messages and validation feedback
 */
interface ErrorTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode
    className?: string
    showIcon?: boolean
}

const ErrorText = React.forwardRef<HTMLSpanElement, ErrorTextProps>(
    ({ children, className, showIcon = true, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    'text-sm text-error-500 flex items-center gap-1',
                    className
                )}
                {...props}
            >
                {showIcon && (
                    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zM9.25 15a.75.75 0 011.5 0v.008a.75.75 0 01-1.5 0V15z" clipRule="evenodd" />
                    </svg>
                )}
                {children}
            </span>
        )
    }
)
ErrorText.displayName = 'ErrorText'

/**
 * SuccessText Component - Success messages and confirmations
 */
interface SuccessTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode
    className?: string
    showIcon?: boolean
}

const SuccessText = React.forwardRef<HTMLSpanElement, SuccessTextProps>(
    ({ children, className, showIcon = true, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    'text-sm text-success-500 flex items-center gap-1',
                    className
                )}
                {...props}
            >
                {showIcon && (
                    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L7.53 10.7a.75.75 0 00-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                )}
                {children}
            </span>
        )
    }
)
SuccessText.displayName = 'SuccessText'

/**
 * Lead Component - Prominent introductory text
 */
interface LeadProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode
    color?: TextColor
    className?: string
}

const Lead = React.forwardRef<HTMLParagraphElement, LeadProps>(
    ({ children, color = 'secondary', className, ...props }, ref) => {
        return (
            <p
                ref={ref}
                className={cn(
                    'text-xl leading-relaxed font-normal',
                    getColorClass(color),
                    className
                )}
                {...props}
            >
                {children}
            </p>
        )
    }
)
Lead.displayName = 'Lead'

/**
 * Overline Component - Uppercase labels and categories
 */
interface OverlineProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode
    color?: TextColor
    className?: string
}

const Overline = React.forwardRef<HTMLSpanElement, OverlineProps>(
    ({ children, color = 'tertiary', className, ...props }, ref) => {
        return (
            <span
                ref={ref}
                className={cn(
                    'text-xs font-semibold leading-normal tracking-widest uppercase',
                    getColorClass(color),
                    className
                )}
                {...props}
            >
                {children}
            </span>
        )
    }
)
Overline.displayName = 'Overline'

export {
    // Heading components
    H1,
    H2,
    H3,
    H4,

    // Text components
    Text,
    Label,
    Caption,
    Code,

    // Specialized components
    Link,
    Muted,
    ErrorText,
    SuccessText,
    Lead,
    Overline,

    // Types
    type TextColor,
    type FontWeight,
    type TextProps,
    type HeadingProps,
    type LabelProps,
    type LinkProps,
} 