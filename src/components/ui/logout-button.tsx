/**
 * Evolution Combatives Logout Button Component
 * Simple logout button component for admin dashboard
 * 
 * @description Reusable logout button with loading state and confirmation
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from './button'
import { toast } from 'sonner'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

interface LogoutButtonProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
    size?: 'sm' | 'default' | 'lg' | 'icon'
    showIcon?: boolean
    showConfirmation?: boolean
    className?: string
    children?: React.ReactNode
}

export function LogoutButton({
    variant = 'ghost',
    size = 'default',
    showIcon = true,
    showConfirmation = false,
    className,
    children
}: LogoutButtonProps) {
    const { logout, isLogoutLoading } = useAuth()

    const handleLogout = async () => {
        if (showConfirmation) {
            const confirmed = window.confirm(
                'Are you sure you want to log out? You will need to sign in again to access the dashboard.'
            )
            if (!confirmed) return
        }

        try {
            // Clear any local storage items before logout
            localStorage.removeItem('admin_remember_me')

            // Use the logout function from useAuth hook
            await logout()

            toast.success('Logged out successfully', {
                description: 'You have been securely logged out.'
            })
        } catch (error) {
            console.error('Logout error:', error)
            toast.error('Logout failed', {
                description: 'An unexpected error occurred during logout.'
            })
        }
    }

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleLogout}
            disabled={isLogoutLoading}
            loading={isLogoutLoading}
            className={className}
            leftIcon={showIcon && !isLogoutLoading ? <ArrowRightOnRectangleIcon className="h-4 w-4" /> : undefined}
        >
            {children || (isLogoutLoading ? 'Signing out...' : 'Sign Out')}
        </Button>
    )
}

/**
 * Simple logout link component (looks like a link but functions as a button)
 */
interface LogoutLinkProps {
    className?: string
    children?: React.ReactNode
}

export function LogoutLink({ className, children }: LogoutLinkProps) {
    return (
        <LogoutButton
            variant="ghost"
            size="sm"
            showIcon={false}
            className={`text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline p-0 h-auto ${className}`}
        >
            {children || 'Sign out'}
        </LogoutButton>
    )
}
