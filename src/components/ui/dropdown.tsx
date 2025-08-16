/**
 * Evolution Combatives Dropdown Component System
 * Professional dropdown menu components for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Dropdown menu system using Headless UI with professional styling
 * @author Evolution Combatives
 */

import * as React from 'react'
import Image from 'next/image'
import { Menu, Transition } from '@headlessui/react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Dropdown Menu variants using class-variance-authority
 * Matches Evolution Combatives tactical design system
 */
const dropdownMenuVariants = cva(
    [
        // Base styles for menu container
        'absolute z-[9999] min-w-48 max-w-64',
        'rounded-md border shadow-lg',
        'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
        'text-gray-900 dark:text-white text-sm',
        'py-1 focus:outline-none',
        'origin-top-right',
    ],
    {
        variants: {
            size: {
                sm: 'min-w-32 max-w-48',
                default: 'min-w-48 max-w-64',
                lg: 'min-w-64 max-w-80',
                xl: 'min-w-80 max-w-96',
            }
        },
        defaultVariants: {
            size: 'default'
        }
    }
)

/**
 * Dropdown Menu Item variants
 */
const dropdownMenuItemVariants = cva(
    [
        // Base styles for menu items
        'group flex w-full items-center gap-3 px-4 py-2.5',
        'text-sm font-medium cursor-pointer select-none',
        'transition-colors duration-150',
        'focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700',
        'disabled:opacity-50 disabled:cursor-not-allowed',
    ],
    {
        variants: {
            variant: {
                default: [
                    'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700',
                    'hover:text-gray-900 dark:hover:text-white',
                ],
                destructive: [
                    'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
                    'hover:text-red-700 dark:hover:text-red-300',
                ],
                success: [
                    'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20',
                    'hover:text-green-700 dark:hover:text-green-300',
                ],
                warning: [
                    'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
                    'hover:text-yellow-700 dark:hover:text-yellow-300',
                ],
                primary: [
                    'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                    'hover:text-blue-700 dark:hover:text-blue-300',
                ],
            },
            size: {
                sm: 'px-3 py-1.5 text-xs gap-2',
                default: 'px-4 py-2.5 text-sm gap-3',
                lg: 'px-5 py-3 text-base gap-3',
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
)

/**
 * Dropdown Menu Separator styles
 */
const dropdownMenuSeparatorStyles = 'my-1 h-px bg-gray-200 dark:bg-gray-700'

/**
 * Dropdown Menu Label styles
 */
const dropdownMenuLabelStyles = [
    'px-4 py-2 text-xs font-semibold',
    'text-gray-600 dark:text-gray-400 uppercase tracking-wide',
    'select-none'
].join(' ')

/**
 * Dropdown Menu component props
 */
export interface DropdownMenuProps
    extends VariantProps<typeof dropdownMenuVariants> {
    children: React.ReactNode
    className?: string
}

/**
 * Main Dropdown Menu component
 */
const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>(
    ({ children }, ref) => {
        return (
            <Menu as="div" className="relative inline-block text-left" ref={ref}>
                {children}
            </Menu>
        )
    }
)

DropdownMenu.displayName = 'DropdownMenu'

/**
 * Dropdown Menu Trigger component props
 */
export interface DropdownMenuTriggerProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode
    asChild?: boolean
}

/**
 * Dropdown Menu Trigger component
 */
const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
    ({ children, asChild = false, className, ...props }, ref) => {
        if (asChild) {
            return (
                <Menu.Button as={React.Fragment}>
                    {children}
                </Menu.Button>
            )
        }

        return (
            <Menu.Button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center gap-2',
                    'rounded-md px-3 py-2 text-sm font-medium',
                    'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    'transition-colors duration-150',
                    className
                )}
                {...props}
            >
                {children}
            </Menu.Button>
        )
    }
)

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

/**
 * Dropdown Menu Content component props
 */
export interface DropdownMenuContentProps
    extends VariantProps<typeof dropdownMenuVariants> {
    children: React.ReactNode
    className?: string
    align?: 'left' | 'right'
}

/**
 * Dropdown Menu Content component
 */
const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
    ({ children, size, className, align = 'right' }, ref) => {
        return (
            <Transition
                as={React.Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items
                    className={cn(
                        dropdownMenuVariants({ size }),
                        align === 'left' ? 'left-0' : 'right-0',
                        'mt-1', // Add small margin from trigger
                        className
                    )}
                    ref={ref}
                >
                    {children}
                </Menu.Items>
            </Transition>
        )
    }
)

DropdownMenuContent.displayName = 'DropdownMenuContent'

/**
 * Dropdown Menu Item component props
 */
export interface DropdownMenuItemProps
    extends VariantProps<typeof dropdownMenuItemVariants> {
    children: React.ReactNode
    className?: string
    disabled?: boolean
    icon?: React.ReactNode
    description?: string
    shortcut?: string
    onClick?: () => void
}

/**
 * Dropdown Menu Item component
 */
const DropdownMenuItem = React.forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
    ({
        children,
        variant,
        size,
        className,
        disabled = false,
        icon,
        description,
        shortcut,
        onClick,
        ...props
    }, ref) => {
        return (
            <Menu.Item disabled={disabled}>
                {({ active, disabled: isDisabled }: { active: boolean; disabled: boolean }) => (
                    <button
                        ref={ref}
                        className={cn(
                            dropdownMenuItemVariants({ variant, size }),
                            active && !isDisabled && 'bg-gray-100 dark:bg-gray-700',
                            isDisabled && 'opacity-50 cursor-not-allowed',
                            className
                        )}
                        onClick={onClick}
                        disabled={isDisabled}
                        {...props}
                    >
                        {icon && (
                            <span className="flex-shrink-0 w-4 h-4">
                                {icon}
                            </span>
                        )}
                        <div className="flex-1 text-left">
                            <div className="flex items-center justify-between">
                                <span>{children}</span>
                                {shortcut && (
                                    <kbd className="ml-2 px-1.5 py-0.5 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
                                        {shortcut}
                                    </kbd>
                                )}
                            </div>
                            {description && (
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 font-normal">
                                    {description}
                                </p>
                            )}
                        </div>
                    </button>
                )}
            </Menu.Item>
        )
    }
)

DropdownMenuItem.displayName = 'DropdownMenuItem'

/**
 * Dropdown Menu Separator component
 */
export interface DropdownMenuSeparatorProps {
    className?: string
}

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(
    ({ className }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(dropdownMenuSeparatorStyles, className)}
                role="separator"
            />
        )
    }
)

DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

/**
 * Dropdown Menu Label component props
 */
export interface DropdownMenuLabelProps {
    children: React.ReactNode
    className?: string
}

/**
 * Dropdown Menu Label component
 */
const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
    ({ children, className }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(dropdownMenuLabelStyles, className)}
            >
                {children}
            </div>
        )
    }
)

DropdownMenuLabel.displayName = 'DropdownMenuLabel'

/**
 * Specialized User Actions Dropdown
 */
export interface UserActionsDropdownProps {
    user: {
        name: string
        email: string
        role: string
        avatar?: string
    }
    onViewProfile?: () => void
    onEditProfile?: () => void
    onChangePassword?: () => void
    onLogout?: () => void
    className?: string
}

const UserActionsDropdown = React.forwardRef<HTMLDivElement, UserActionsDropdownProps>(
    ({ user, onViewProfile, onEditProfile, onChangePassword, onLogout, className }) => {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger className={className}>
                    <div className="flex items-center gap-2">
                        {user.avatar ? (
                            <div className="relative w-8 h-8 rounded-full overflow-hidden">
                                <Image
                                    src={user.avatar}
                                    alt={user.name}
                                    fill
                                    className="object-cover"
                                    sizes="32px"
                                />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                    {user.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                        </div>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuItem
                        onClick={onViewProfile}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        }
                    >
                        View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={onEditProfile}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        }
                    >
                        Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={onChangePassword}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                            </svg>
                        }
                    >
                        Change Password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        onClick={onLogout}
                        icon={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        }
                    >
                        Sign Out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
)

UserActionsDropdown.displayName = 'UserActionsDropdown'

/**
 * Specialized Content Actions Dropdown
 */
export interface ContentActionsDropdownProps {
    onEdit?: () => void
    onDuplicate?: () => void
    onArchive?: () => void
    onDelete?: () => void
    onViewAnalytics?: () => void
    className?: string
    disabled?: boolean
}

const ContentActionsDropdown = React.forwardRef<HTMLDivElement, ContentActionsDropdownProps>(
    ({ onEdit, onDuplicate, onArchive, onDelete, onViewAnalytics, className, disabled }) => {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={className}
                    disabled={disabled}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    {onEdit && (
                        <DropdownMenuItem
                            onClick={onEdit}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            }
                            shortcut="⌘E"
                        >
                            Edit
                        </DropdownMenuItem>
                    )}
                    {onDuplicate && (
                        <DropdownMenuItem
                            onClick={onDuplicate}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            }
                            shortcut="⌘D"
                        >
                            Duplicate
                        </DropdownMenuItem>
                    )}
                    {onViewAnalytics && (
                        <DropdownMenuItem
                            onClick={onViewAnalytics}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            }
                        >
                            View Analytics
                        </DropdownMenuItem>
                    )}
                    {(onArchive || onDelete) && <DropdownMenuSeparator />}
                    {onArchive && (
                        <DropdownMenuItem
                            variant="warning"
                            onClick={onArchive}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 4-4m0 4l-4 4-4-4" />
                                </svg>
                            }
                        >
                            Archive
                        </DropdownMenuItem>
                    )}
                    {onDelete && (
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={onDelete}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            }
                            shortcut="⌫"
                        >
                            Delete
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
)

ContentActionsDropdown.displayName = 'ContentActionsDropdown'

/**
 * Specialized Settings Dropdown
 */
export interface SettingsDropdownProps {
    onGeneralSettings?: () => void
    onUserManagement?: () => void
    onContentSettings?: () => void
    onBillingSettings?: () => void
    onSystemSettings?: () => void
    onAuditLog?: () => void
    className?: string
}

const SettingsDropdown = React.forwardRef<HTMLDivElement, SettingsDropdownProps>(
    ({
        onGeneralSettings,
        onUserManagement,
        onContentSettings,
        onBillingSettings,
        onSystemSettings,
        onAuditLog,
        className
    }) => {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger className={className}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                </DropdownMenuTrigger>
                <DropdownMenuContent size="lg">
                    <DropdownMenuLabel>System Settings</DropdownMenuLabel>
                    {onGeneralSettings && (
                        <DropdownMenuItem
                            onClick={onGeneralSettings}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                                </svg>
                            }
                            description="General application settings"
                        >
                            General
                        </DropdownMenuItem>
                    )}
                    {onUserManagement && (
                        <DropdownMenuItem
                            onClick={onUserManagement}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            }
                            description="Manage users and permissions"
                        >
                            User Management
                        </DropdownMenuItem>
                    )}
                    {onContentSettings && (
                        <DropdownMenuItem
                            onClick={onContentSettings}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
                                </svg>
                            }
                            description="Content and video settings"
                        >
                            Content Settings
                        </DropdownMenuItem>
                    )}
                    {onBillingSettings && (
                        <DropdownMenuItem
                            onClick={onBillingSettings}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                            }
                            description="Billing and subscription settings"
                        >
                            Billing Settings
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {onSystemSettings && (
                        <DropdownMenuItem
                            onClick={onSystemSettings}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                </svg>
                            }
                            description="Advanced system configuration"
                        >
                            System Settings
                        </DropdownMenuItem>
                    )}
                    {onAuditLog && (
                        <DropdownMenuItem
                            onClick={onAuditLog}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            }
                            description="View system audit logs"
                        >
                            Audit Log
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
)

SettingsDropdown.displayName = 'SettingsDropdown'

/**
 * Specialized Video Actions Dropdown
 */
export interface VideoActionsDropdownProps {
    onPreview?: () => void
    onEdit?: () => void
    onAnalytics?: () => void
    onDownload?: () => void
    onDelete?: () => void
    className?: string
    disabled?: boolean
}

const VideoActionsDropdown = React.forwardRef<HTMLDivElement, VideoActionsDropdownProps>(
    ({ onPreview, onEdit, onAnalytics, onDownload, onDelete, className, disabled }) => {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={cn(
                        'p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                        className
                    )}
                    disabled={disabled}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="right">
                    {onPreview && (
                        <DropdownMenuItem
                            onClick={onPreview}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        >
                            Preview Video
                        </DropdownMenuItem>
                    )}
                    {onEdit && (
                        <DropdownMenuItem
                            onClick={onEdit}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            }
                        >
                            Edit Metadata
                        </DropdownMenuItem>
                    )}
                    {onAnalytics && (
                        <DropdownMenuItem
                            onClick={onAnalytics}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            }
                        >
                            View Analytics
                        </DropdownMenuItem>
                    )}
                    {onDownload && (
                        <DropdownMenuItem
                            onClick={onDownload}
                            icon={
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            }
                        >
                            Download Original
                        </DropdownMenuItem>
                    )}
                    {onDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={onDelete}
                                icon={
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                }
                            >
                                Delete Video
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
)

VideoActionsDropdown.displayName = 'VideoActionsDropdown'

// Export all components
export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    UserActionsDropdown,
    ContentActionsDropdown,
    SettingsDropdown,
    VideoActionsDropdown,
} 