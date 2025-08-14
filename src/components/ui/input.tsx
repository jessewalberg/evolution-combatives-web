/**
 * Evolution Combatives Input Component System
 * Professional input components for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Input component system matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
// import { componentClasses } from '../../theme'; // Commented out - defining inline

const inputVariants = cva(
    // Base input styles with better contrast
    [
        'flex w-full rounded-md border px-3 py-2 text-sm',
        'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
        'border-gray-300 dark:border-gray-600',
        'placeholder:text-gray-500 dark:placeholder:text-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50'
    ],
    {
        variants: {
            variant: {
                default: '',
                error: 'border-red-500 focus:ring-red-500',
                success: 'border-green-500 focus:ring-green-500',
                disabled: 'border-gray-300 bg-gray-100 text-gray-500 placeholder:text-gray-400 cursor-not-allowed',
            },

            size: {
                // Small - 32px height
                sm: 'h-8 px-2 py-1 text-sm',

                // Default - 40px height (matches mobile app)
                default: 'h-10 px-3 py-2 text-base',

                // Large - 48px height
                lg: 'h-12 px-4 py-3 text-lg',
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
)

/**
 * Input component props interface
 */
export interface InputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
    /**
     * Error message to display below input
     */
    error?: string

    /**
     * Helper text to display below input
     */
    helperText?: string

    /**
     * Label for the input
     */
    label?: string

    /**
     * Whether the field is required
     */
    required?: boolean

    /**
     * Icon to show at the start of input
     */
    leftIcon?: React.ReactNode

    /**
     * Icon to show at the end of input
     */
    rightIcon?: React.ReactNode

    /**
     * Input container class name
     */
    containerClassName?: string

    /**
     * Label class name
     */
    labelClassName?: string
}

/**
 * Professional Input Component
 * 
 * @example
 * ```tsx
 * // Basic input
 * <Input placeholder="Enter your email" />
 * 
 * // Input with label and validation
 * <Input 
 *   label="Email Address"
 *   type="email"
 *   required
 *   error="Please enter a valid email"
 * />
 * 
 * // Input with icons
 * <Input 
 *   leftIcon={<SearchIcon className="h-4 w-4" />}
 *   placeholder="Search videos..."
 * />
 * ```
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({
        className,
        variant,
        size,
        type = 'text',
        error,
        helperText,
        label,
        required,
        leftIcon,
        rightIcon,
        containerClassName,
        labelClassName,
        disabled,
        ...props
    }, ref) => {
        // Determine variant based on error state
        const finalVariant = error ? 'error' : disabled ? 'disabled' : variant

        return (
            <div className={cn('w-full', containerClassName)}>
                {/* Label */}
                {label && (
                    <label
                        className={cn(
                            'block text-sm font-medium text-gray-900 dark:text-white mb-2',
                            required && "after:content-['*'] after:ml-0.5 after:text-red-500",
                            disabled && 'text-gray-500',
                            labelClassName
                        )}
                        htmlFor={props.id}
                    >
                        {label}
                    </label>
                )}

                {/* Input Container */}
                <div className="relative">
                    {/* Left Icon */}
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                            {leftIcon}
                        </div>
                    )}

                    {/* Input */}
                    <input
                        type={type}
                        className={cn(
                            inputVariants({ variant: finalVariant, size }),
                            leftIcon && 'pl-10',
                            rightIcon && 'pr-10',
                            className
                        )}
                        ref={ref}
                        disabled={disabled}
                        {...props}
                    />

                    {/* Right Icon */}
                    {rightIcon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                            {rightIcon}
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zM9.25 15a.75.75 0 011.5 0v.008a.75.75 0 01-1.5 0V15z" clipRule="evenodd" />
                        </svg>
                        {error}
                    </p>
                )}

                {/* Helper Text */}
                {helperText && !error && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {helperText}
                    </p>
                )}
            </div>
        )
    }
)

Input.displayName = 'Input'

/**
 * Input Group component for complex input layouts
 */
export interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn('relative flex items-center', className)}
                {...props}
            >
                {children}
            </div>
        )
    }
)

InputGroup.displayName = 'InputGroup'

/**
 * Input Icon component for prefix/suffix icons
 */
export interface InputIconProps extends React.HTMLAttributes<HTMLDivElement> {
    position?: 'left' | 'right'
    children: React.ReactNode
}

const InputIcon = React.forwardRef<HTMLDivElement, InputIconProps>(
    ({ className, position = 'left', children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'absolute top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none',
                    position === 'left' ? 'left-3' : 'right-3',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)

InputIcon.displayName = 'InputIcon'

/**
 * Input Error component for standalone error messages
 */
export interface InputErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode
}

const InputError = React.forwardRef<HTMLParagraphElement, InputErrorProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <p
                ref={ref}
                className={cn(
                    'mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1',
                    className
                )}
                {...props}
            >
                <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zM9.25 15a.75.75 0 011.5 0v.008a.75.75 0 01-1.5 0V15z" clipRule="evenodd" />
                </svg>
                {children}
            </p>
        )
    }
)

InputError.displayName = 'InputError'

/**
 * Specialized input components for common use cases
 */

/**
 * Search Input with built-in search icon
 */
export interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'type'> {
    onClear?: () => void
    showClearButton?: boolean
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    ({ onClear, showClearButton, rightIcon, ...props }, ref) => {
        const [hasValue, setHasValue] = React.useState(false)

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setHasValue(e.target.value.length > 0)
            props.onChange?.(e)
        }

        const handleClear = () => {
            setHasValue(false)
            onClear?.()
        }

        return (
            <Input
                ref={ref}
                type="search"
                leftIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                }
                rightIcon={
                    showClearButton && hasValue ? (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    ) : rightIcon
                }
                onChange={handleChange}
                {...props}
            />
        )
    }
)

SearchInput.displayName = 'SearchInput'

/**
 * Password Input with toggle visibility
 */
export interface PasswordInputProps extends Omit<InputProps, 'type' | 'rightIcon'> {
    showToggle?: boolean
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ showToggle = true, ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false)

        const togglePassword = () => {
            setShowPassword(!showPassword)
        }

        return (
            <Input
                ref={ref}
                type={showPassword ? 'text' : 'password'}
                rightIcon={
                    showToggle ? (
                        <button
                            type="button"
                            onClick={togglePassword}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            {showPassword ? (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L12 12m-2.122-2.122L7.758 7.758M12 12l2.122 2.122m-2.122-2.122L14.242 14.242M12 12l2.122 2.122" />
                                </svg>
                            ) : (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            )}
                        </button>
                    ) : undefined
                }
                {...props}
            />
        )
    }
)

PasswordInput.displayName = 'PasswordInput'

export {
    Input,
    InputGroup,
    InputIcon,
    InputError,
    SearchInput,
    PasswordInput,
    inputVariants
} 