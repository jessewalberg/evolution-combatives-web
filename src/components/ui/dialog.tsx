/**
 * Evolution Combatives Dialog Component System
 * Professional modal dialog components for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Dialog/Modal component system matching React Native app styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';
import { componentClasses } from '../../theme';

const overlayVariants = cva(componentClasses.dialog.overlay);

const contentVariants = cva(
    componentClasses.dialog.content,
    {
        variants: {
            size: {
                // Small - 400px max width
                sm: 'max-w-sm',

                // Default - 500px max width
                default: 'max-w-lg',

                // Large - 600px max width
                lg: 'max-w-xl',

                // Extra large - 800px max width
                xl: 'max-w-3xl',

                // Full - 95% viewport width
                full: 'max-w-[95vw]',
            }
        },
        defaultVariants: {
            size: 'default'
        }
    }
)

/**
 * Dialog root component (re-export from Radix)
 */
const Dialog = DialogPrimitive.Root

/**
 * Dialog trigger component (re-export from Radix)
 */
const DialogTrigger = DialogPrimitive.Trigger

/**
 * Dialog portal component (re-export from Radix)
 */
const DialogPortal = DialogPrimitive.Portal

/**
 * Dialog close component (re-export from Radix)
 */
const DialogClose = DialogPrimitive.Close

/**
 * Dialog overlay component
 */
const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(overlayVariants(), className)}
        {...props}
    />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * Dialog content component props interface
 */
export interface DialogContentProps
    extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof contentVariants> {
    /**
     * Dialog content
     */
    children?: React.ReactNode

    /**
     * Custom className
     */
    className?: string

    /**
     * Whether to show the close button (default: true)
     */
    showCloseButton?: boolean

    /**
     * Custom close button icon
     */
    closeIcon?: React.ReactNode

    /**
     * Whether the dialog is scrollable (default: false)
     */
    scrollable?: boolean
}

/**
 * Professional Dialog Content Component
 * 
 * @example
 * ```tsx
 * <Dialog>
 *   <DialogTrigger asChild>
 *     <Button>Open Dialog</Button>
 *   </DialogTrigger>
 *   <DialogContent size="lg">
 *     <DialogHeader>
 *       <DialogTitle>Delete Video</DialogTitle>
 *       <DialogDescription>
 *         This action cannot be undone.
 *       </DialogDescription>
 *     </DialogHeader>
 *     <DialogFooter>
 *       <Button variant="outline">Cancel</Button>
 *       <Button variant="destructive">Delete</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 * ```
 */
const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    DialogContentProps
>(({
    className,
    size,
    showCloseButton = true,
    closeIcon,
    scrollable = false,
    children,
    ...props
}, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                contentVariants({ size }),
                scrollable && 'max-h-[85vh] overflow-y-auto',
                className
            )}
            {...props}
        >
            <div className={cn(
                'p-6',
                scrollable && 'overflow-y-auto'
            )}>
                {children}
            </div>
            {showCloseButton && (
                <DialogPrimitive.Close className={cn(
                    'absolute right-4 top-4',
                    'rounded-sm opacity-70',
                    'ring-offset-neutral-800 transition-opacity',
                    'hover:opacity-100',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    'disabled:pointer-events-none',
                    'data-[state=open]:bg-neutral-700 data-[state=open]:text-neutral-300'
                )}>
                    {closeIcon || <XMarkIcon className="h-4 w-4" />}
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
            )}
        </DialogPrimitive.Content>
    </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * Dialog Header component for titles and descriptions
 */
export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const DialogHeader = React.forwardRef<HTMLDivElement, DialogHeaderProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'flex flex-col space-y-1.5 text-center sm:text-left',
                    'mb-4',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
DialogHeader.displayName = 'DialogHeader'

/**
 * Dialog Footer component for actions
 */
export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
                    'mt-6 gap-2 sm:gap-0',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
DialogFooter.displayName = 'DialogFooter'

/**
 * Dialog Title component
 */
export interface DialogTitleProps
    extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {
    children: React.ReactNode
    className?: string
}

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    DialogTitleProps
>(({ className, children, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn(
            'text-lg font-semibold leading-none tracking-tight',
            'text-neutral-0',
            className
        )}
        {...props}
    >
        {children}
    </DialogPrimitive.Title>
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

/**
 * Dialog Description component
 */
export interface DialogDescriptionProps
    extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> {
    children: React.ReactNode
    className?: string
}

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    DialogDescriptionProps
>(({ className, children, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn(
            'text-sm text-neutral-400',
            'leading-relaxed',
            className
        )}
        {...props}
    >
        {children}
    </DialogPrimitive.Description>
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

/**
 * Confirmation Dialog Component
 * Pre-built dialog for confirmation actions
 */
export interface ConfirmationDialogProps {
    /**
     * Whether the dialog is open
     */
    open: boolean

    /**
     * Callback when dialog open state changes
     */
    onOpenChange: (open: boolean) => void

    /**
     * Dialog title
     */
    title: string

    /**
     * Dialog description/message
     */
    description: string

    /**
     * Confirm button text (default: "Confirm")
     */
    confirmText?: string

    /**
     * Cancel button text (default: "Cancel")
     */
    cancelText?: string

    /**
     * Confirm button variant (default: "destructive")
     */
    confirmVariant?: 'primary' | 'secondary' | 'destructive' | 'success' | 'warning'

    /**
     * Whether the confirm action is loading
     */
    loading?: boolean

    /**
     * Callback when confirmed
     */
    onConfirm: () => void

    /**
     * Callback when cancelled
     */
    onCancel?: () => void

    /**
     * Dialog size
     */
    size?: VariantProps<typeof contentVariants>['size']
}

/**
 * Pre-built Confirmation Dialog
 * 
 * @example
 * ```tsx
 * <ConfirmationDialog
 *   open={showDeleteDialog}
 *   onOpenChange={setShowDeleteDialog}
 *   title="Delete Video"
 *   description="Are you sure you want to delete this video? This action cannot be undone."
 *   confirmText="Delete"
 *   confirmVariant="destructive"
 *   loading={isDeleting}
 *   onConfirm={handleDelete}
 *   onCancel={() => setShowDeleteDialog(false)}
 * />
 * ```
 */
const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    open,
    onOpenChange,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'destructive',
    loading = false,
    onConfirm,
    onCancel,
    size = 'sm'
}) => {
    const handleConfirm = () => {
        onConfirm()
    }

    const handleCancel = () => {
        onCancel?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size={size}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className={cn(
                                'inline-flex items-center justify-center gap-2',
                                'rounded-md text-sm font-semibold',
                                'transition-all duration-200',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                                'disabled:pointer-events-none disabled:opacity-50',
                                'h-10 px-4',
                                'bg-transparent text-neutral-0 border border-neutral-600',
                                'hover:bg-neutral-700 hover:border-neutral-600'
                            )}
                            disabled={loading}
                        >
                            {cancelText}
                        </button>
                    </DialogClose>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={loading}
                        className={cn(
                            'inline-flex items-center justify-center gap-2',
                            'rounded-md text-sm font-semibold',
                            'transition-all duration-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                            'disabled:pointer-events-none disabled:opacity-50',
                            'h-10 px-4',
                            {
                                'bg-primary-600 text-white border border-primary-600 hover:bg-primary-700': confirmVariant === 'primary',
                                'bg-neutral-700 text-neutral-0 border border-neutral-700 hover:bg-neutral-600': confirmVariant === 'secondary',
                                'bg-error-600 text-white border border-error-600 hover:bg-error-700': confirmVariant === 'destructive',
                                'bg-success-600 text-white border border-success-600 hover:bg-success-700': confirmVariant === 'success',
                                'bg-warning-600 text-white border border-warning-600 hover:bg-warning-700': confirmVariant === 'warning',
                            }
                        )}
                    >
                        {loading && (
                            <svg
                                className="animate-spin h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                        )}
                        {confirmText}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/**
 * Form Dialog Component
 * Pre-built dialog for forms
 */
export interface FormDialogProps {
    /**
     * Whether the dialog is open
     */
    open: boolean

    /**
     * Callback when dialog open state changes
     */
    onOpenChange: (open: boolean) => void

    /**
     * Dialog title
     */
    title: string

    /**
     * Dialog description (optional)
     */
    description?: string

    /**
     * Form content
     */
    children: React.ReactNode

    /**
     * Submit button text (default: "Save")
     */
    submitText?: string

    /**
     * Cancel button text (default: "Cancel")
     */
    cancelText?: string

    /**
     * Whether the form is submitting
     */
    loading?: boolean

    /**
     * Whether the submit button is disabled
     */
    submitDisabled?: boolean

    /**
     * Callback when form is submitted
     */
    onSubmit: (event: React.FormEvent) => void

    /**
     * Callback when cancelled
     */
    onCancel?: () => void

    /**
     * Dialog size
     */
    size?: VariantProps<typeof contentVariants>['size']

    /**
     * Whether the dialog content is scrollable
     */
    scrollable?: boolean
}

/**
 * Pre-built Form Dialog
 * 
 * @example
 * ```tsx
 * <FormDialog
 *   open={showCreateDialog}
 *   onOpenChange={setShowCreateDialog}
 *   title="Create Category"
 *   description="Add a new category to organize your content."
 *   size="lg"
 *   loading={isCreating}
 *   onSubmit={handleSubmit}
 *   onCancel={() => setShowCreateDialog(false)}
 * >
 *   <div className="space-y-4">
 *     <Input label="Name" required />
 *     <Input label="Description" />
 *   </div>
 * </FormDialog>
 * ```
 */
const FormDialog: React.FC<FormDialogProps> = ({
    open,
    onOpenChange,
    title,
    description,
    children,
    submitText = 'Save',
    cancelText = 'Cancel',
    loading = false,
    submitDisabled = false,
    onSubmit,
    onCancel,
    size = 'default',
    scrollable = false
}) => {
    const handleCancel = () => {
        onCancel?.()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size={size} scrollable={scrollable}>
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        {description && (
                            <DialogDescription>{description}</DialogDescription>
                        )}
                    </DialogHeader>
                    <div className="my-4">
                        {children}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className={cn(
                                    'inline-flex items-center justify-center gap-2',
                                    'rounded-md text-sm font-semibold',
                                    'transition-all duration-200',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                                    'disabled:pointer-events-none disabled:opacity-50',
                                    'h-10 px-4',
                                    'bg-transparent text-neutral-0 border border-neutral-600',
                                    'hover:bg-neutral-700 hover:border-neutral-600'
                                )}
                                disabled={loading}
                            >
                                {cancelText}
                            </button>
                        </DialogClose>
                        <button
                            type="submit"
                            disabled={loading || submitDisabled}
                            className={cn(
                                'inline-flex items-center justify-center gap-2',
                                'rounded-md text-sm font-semibold',
                                'transition-all duration-200',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                                'disabled:pointer-events-none disabled:opacity-50',
                                'h-10 px-4',
                                'bg-primary-600 text-white border border-primary-600',
                                'hover:bg-primary-700 hover:border-primary-700'
                            )}
                        >
                            {loading && (
                                <svg
                                    className="animate-spin h-4 w-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                            )}
                            {submitText}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

// Export all components
export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    ConfirmationDialog,
    FormDialog,
} 