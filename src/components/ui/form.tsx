/**
 * Evolution Combatives Form Component System
 * Professional form components for tactical training admin interface
 * Integrates with react-hook-form and Zod for validation
 * 
 * @description Form component system matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { Slot } from '@radix-ui/react-slot'
import {
    Controller,
    ControllerProps,
    FieldPath,
    FieldValues,
    FormProvider,
    useFormContext,
} from 'react-hook-form'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Form container variants using class-variance-authority
 * Matches Evolution Combatives tactical design system
 */
const formVariants = cva('space-y-6', {
    variants: {
        layout: {
            vertical: 'space-y-6',
            horizontal: 'space-y-4',
            inline: 'flex flex-wrap gap-4',
        },
        size: {
            sm: 'space-y-4',
            default: 'space-y-6',
            lg: 'space-y-8',
        }
    },
    defaultVariants: {
        layout: 'vertical',
        size: 'default',
    },
})

/**
 * Form item variants for different layouts
 */
const formItemVariants = cva('space-y-2', {
    variants: {
        layout: {
            vertical: 'flex flex-col space-y-2',
            horizontal: 'grid grid-cols-1 md:grid-cols-4 items-start gap-4 space-y-0',
            inline: 'flex flex-row items-center space-x-4 space-y-0',
        },
    },
    defaultVariants: {
        layout: 'vertical',
    },
})

/**
 * Form label variants for different layouts
 */
const formLabelVariants = cva([
    'text-sm font-medium leading-none',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    'transition-colors duration-200'
], {
    variants: {
        layout: {
            vertical: 'text-left',
            horizontal: 'text-left md:text-right pt-2',
            inline: 'text-left whitespace-nowrap',
        },
        state: {
            default: 'text-neutral-0',
            error: 'text-error-400',
            disabled: 'text-neutral-500',
        },
        required: {
            true: "after:content-['*'] after:ml-1 after:text-error-400",
            false: '',
        }
    },
    defaultVariants: {
        layout: 'vertical',
        state: 'default',
        required: false,
    },
})

/**
 * Form control wrapper variants
 */
const formControlVariants = cva('relative', {
    variants: {
        layout: {
            vertical: 'w-full',
            horizontal: 'md:col-span-3',
            inline: 'flex-1 min-w-0',
        },
    },
    defaultVariants: {
        layout: 'vertical',
    },
})

/**
 * Main Form provider component
 * This component wraps react-hook-form's FormProvider
 */
export interface FormProps
    extends React.FormHTMLAttributes<HTMLFormElement>,
    VariantProps<typeof formVariants> {
    children: React.ReactNode
    loading?: boolean
}

const Form = React.forwardRef<HTMLFormElement, FormProps>(
    ({ className, layout, size, loading, children, ...props }, ref) => {
        return (
            <FormProvider {...(props as Parameters<typeof FormProvider>[0])}>
                <form
                    ref={ref}
                    className={cn(
                        formVariants({ layout, size }),
                        loading && 'pointer-events-none opacity-75',
                        className
                    )}
                    {...props}
                >
                    {children}
                </form>
            </FormProvider>
        )
    }
)

Form.displayName = 'Form'

/**
 * Form field context and types
 */
type FormFieldContextValue<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
    name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
    {} as FormFieldContextValue
)

/**
 * Form item context and types
 */
type FormItemContextValue = {
    id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
    {} as FormItemContextValue
)

/**
 * Custom hook to access form field state
 */
const useFormField = () => {
    const fieldContext = React.useContext(FormFieldContext)
    const itemContext = React.useContext(FormItemContext)
    const { getFieldState, formState } = useFormContext()

    if (!fieldContext) {
        throw new Error('useFormField should be used within <FormField>')
    }

    const fieldState = getFieldState(fieldContext.name, formState)

    const { id } = itemContext

    return {
        id,
        name: fieldContext.name,
        formItemId: `${id}-form-item`,
        formDescriptionId: `${id}-form-item-description`,
        formMessageId: `${id}-form-item-message`,
        ...fieldState,
    }
}

/**
 * Form Item component
 */
export interface FormItemProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof formItemVariants> {
    children: React.ReactNode
}

const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
    ({ className, layout, children, ...props }, ref) => {
        const id = React.useId()

        return (
            <FormItemContext.Provider value={{ id }}>
                <div
                    ref={ref}
                    className={cn(formItemVariants({ layout }), className)}
                    {...props}
                >
                    {children}
                </div>
            </FormItemContext.Provider>
        )
    }
)

FormItem.displayName = 'FormItem'

/**
 * Form Label component
 */
export interface FormLabelProps
    extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
    VariantProps<typeof formLabelVariants> {
    children: React.ReactNode
    required?: boolean
    optional?: boolean
}

const FormLabel = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    FormLabelProps
>(({ className, layout, state, required, optional, children, ...props }, ref) => {
    const { error, formItemId } = useFormField()

    const labelState = error ? 'error' : state || 'default'

    return (
        <LabelPrimitive.Root
            ref={ref}
            className={cn(
                formLabelVariants({
                    layout,
                    state: labelState,
                    required: required || false
                }),
                className
            )}
            htmlFor={formItemId}
            {...props}
        >
            {children}
            {optional && (
                <span className="ml-1 text-neutral-400 font-normal">(Optional)</span>
            )}
        </LabelPrimitive.Root>
    )
})

FormLabel.displayName = 'FormLabel'

/**
 * Form Control component
 */
export interface FormControlProps
    extends React.ComponentPropsWithoutRef<typeof Slot>,
    VariantProps<typeof formControlVariants> {
}

const FormControl = React.forwardRef<
    React.ElementRef<typeof Slot>,
    FormControlProps
>(({ className, layout, ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

    return (
        <div className={cn(formControlVariants({ layout }))}>
            <Slot
                ref={ref}
                id={formItemId}
                className={cn(className)}
                aria-describedby={
                    !error
                        ? `${formDescriptionId}`
                        : `${formDescriptionId} ${formMessageId}`
                }
                aria-invalid={!!error}
                {...props}
            />
        </div>
    )
})

FormControl.displayName = 'FormControl'

/**
 * Form Description component
 */
export interface FormDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode
}

const FormDescription = React.forwardRef<HTMLParagraphElement, FormDescriptionProps>(
    ({ className, children, ...props }, ref) => {
        const { formDescriptionId } = useFormField()

        return (
            <p
                ref={ref}
                id={formDescriptionId}
                className={cn(
                    'text-sm text-neutral-400 leading-relaxed',
                    className
                )}
                {...props}
            >
                {children}
            </p>
        )
    }
)

FormDescription.displayName = 'FormDescription'

/**
 * Form Message component for error display
 */
export interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children?: React.ReactNode
}

const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
    ({ className, children, ...props }, ref) => {
        const { error, formMessageId } = useFormField()
        const body = error ? String(error?.message) : children

        if (!body) {
            return null
        }

        return (
            <p
                ref={ref}
                id={formMessageId}
                className={cn(
                    'text-sm font-medium text-error-400 flex items-center gap-1.5',
                    className
                )}
                {...props}
            >
                <svg
                    className="h-4 w-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                {body}
            </p>
        )
    }
)

FormMessage.displayName = 'FormMessage'

/**
 * Form Field component - connects to react-hook-form Controller
 */
const FormField = <
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
    ...props
}: ControllerProps<TFieldValues, TName>) => {
    return (
        <FormFieldContext.Provider value={{ name: props.name }}>
            <Controller {...props} />
        </FormFieldContext.Provider>
    )
}

/**
 * Form Section component for grouping related fields
 */
export interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string
    description?: string
    children: React.ReactNode
}

const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
    ({ className, title, description, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn('space-y-4', className)}
                {...props}
            >
                {(title || description) && (
                    <div className="space-y-1">
                        {title && (
                            <h3 className="text-lg font-semibold text-neutral-0">
                                {title}
                            </h3>
                        )}
                        {description && (
                            <p className="text-sm text-neutral-400">
                                {description}
                            </p>
                        )}
                    </div>
                )}
                <div className="space-y-4">
                    {children}
                </div>
            </div>
        )
    }
)

FormSection.displayName = 'FormSection'

/**
 * Form Actions component for submit/cancel buttons
 */
export interface FormActionsProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    layout?: 'start' | 'end' | 'between' | 'center'
    sticky?: boolean
}

const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(
    ({ className, children, layout = 'end', sticky = false, ...props }, ref) => {
        const layoutClasses = {
            start: 'justify-start',
            end: 'justify-end',
            between: 'justify-between',
            center: 'justify-center',
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'flex items-center gap-4 pt-6 border-t border-neutral-700',
                    layoutClasses[layout],
                    sticky && 'sticky bottom-0 bg-neutral-900 pb-6 -mx-6 px-6',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)

FormActions.displayName = 'FormActions'

/**
 * Form Grid component for complex layouts
 */
export interface FormGridProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    columns?: 1 | 2 | 3 | 4
    gap?: 'sm' | 'default' | 'lg'
}

const FormGrid = React.forwardRef<HTMLDivElement, FormGridProps>(
    ({ className, children, columns = 2, gap = 'default', ...props }, ref) => {
        const gridClasses = {
            1: 'grid-cols-1',
            2: 'grid-cols-1 md:grid-cols-2',
            3: 'grid-cols-1 md:grid-cols-3',
            4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
        }

        const gapClasses = {
            sm: 'gap-4',
            default: 'gap-6',
            lg: 'gap-8',
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'grid',
                    gridClasses[columns],
                    gapClasses[gap],
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)

FormGrid.displayName = 'FormGrid'

// Export all components and utilities
export {
    useFormField,
    Form,
    FormItem,
    FormLabel,
    FormControl,
    FormDescription,
    FormMessage,
    FormField,
    FormSection,
    FormActions,
    FormGrid,
} 