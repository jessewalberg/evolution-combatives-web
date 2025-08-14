/**
 * Evolution Combatives Admin Dashboard Layout
 * Professional layout for tactical training admin interface
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Complete admin layout with sidebar, header, and responsive behavior
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import {
    UserActionsDropdown,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
} from '../ui/dropdown'
import {
    Bars3Icon,
    XMarkIcon,
    HomeIcon,
    PlayIcon,
    UsersIcon,
    ChartBarIcon,
    ChatBubbleLeftRightIcon,
    Cog6ToothIcon,
    MagnifyingGlassIcon,
    BellIcon,
    ChevronRightIcon,
    PlusIcon,
    DocumentTextIcon,
    VideoCameraIcon,
    UserGroupIcon,
    ShieldCheckIcon,
    ServerIcon,
    WifiIcon,
} from '@heroicons/react/24/outline'

/**
 * Admin user roles for navigation visibility
 */
type AdminRole = 'super_admin' | 'content_admin' | 'support_admin'

/**
 * Navigation item interface
 */
interface NavItem {
    name: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
    roles: AdminRole[]
    children?: NavItem[]
}

/**
 * Navigation configuration
 */
const navigation: NavItem[] = [
    {
        name: 'Dashboard',
        href: '/admin',
        icon: HomeIcon,
        roles: ['super_admin', 'content_admin', 'support_admin'],
    },
    {
        name: 'Content',
        href: '/admin/content',
        icon: PlayIcon,
        roles: ['super_admin', 'content_admin'],
        children: [
            {
                name: 'Videos',
                href: '/dashboard/content/videos',
                icon: VideoCameraIcon,
                roles: ['super_admin', 'content_admin'],
            },
            {
                name: 'Categories',
                href: '/admin/content/categories',
                icon: DocumentTextIcon,
                roles: ['super_admin', 'content_admin'],
            },
        ],
    },
    {
        name: 'Users',
        href: '/admin/users',
        icon: UsersIcon,
        roles: ['super_admin', 'support_admin'],
    },
    {
        name: 'Analytics',
        href: '/admin/analytics',
        icon: ChartBarIcon,
        roles: ['super_admin', 'content_admin'],
    },
    {
        name: 'Q&A',
        href: '/admin/qa',
        icon: ChatBubbleLeftRightIcon,
        badge: 5, // Example notification count
        roles: ['super_admin', 'support_admin'],
    },
    {
        name: 'Settings',
        href: '/admin/settings',
        icon: Cog6ToothIcon,
        roles: ['super_admin'],
    },
]

/**
 * Breadcrumb item interface
 */
interface BreadcrumbItem {
    name: string
    href?: string
}

/**
 * System status interface
 */
interface SystemStatus {
    database: 'online' | 'offline' | 'warning'
    api: 'online' | 'offline' | 'warning'
    cdn: 'online' | 'offline' | 'warning'
}

/**
 * Admin layout props
 */
interface AdminLayoutProps {
    children: React.ReactNode
    userRole: AdminRole
    user: {
        name: string
        email: string
        role: string
        avatar?: string
    }
    breadcrumbs?: BreadcrumbItem[]
    systemStatus?: SystemStatus
    notificationCount?: number
    onSearch?: (query: string) => void
    onUserAction?: (action: string) => void
}

/**
 * Sidebar variants
 */
const sidebarVariants = cva(
    [
        'fixed inset-y-0 left-0 z-50',
        'flex flex-col bg-neutral-900 border-r border-neutral-700',
        'transition-all duration-300 ease-in-out',
    ],
    {
        variants: {
            state: {
                expanded: 'w-64',
                collapsed: 'w-16',
                hidden: '-translate-x-full w-64',
            },
        },
        defaultVariants: {
            state: 'expanded',
        },
    }
)

/**
 * Main content variants
 */
const contentVariants = cva('flex-1 flex flex-col min-h-screen bg-neutral-950', {
    variants: {
        sidebarState: {
            expanded: 'lg:pl-64',
            collapsed: 'lg:pl-16',
            hidden: 'lg:pl-0',
        },
    },
    defaultVariants: {
        sidebarState: 'expanded',
    },
})

/**
 * Navigation item component
 */
interface NavItemComponentProps {
    item: NavItem
    isActive: boolean
    isCollapsed: boolean
    userRole: AdminRole
}

const NavItemComponent: React.FC<NavItemComponentProps> = ({
    item,
    isActive,
    isCollapsed,
    userRole
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false)
    const hasChildren = item.children && item.children.length > 0
    const pathname = usePathname()

    // Check if user has access to this item
    if (!item.roles.includes(userRole)) {
        return null
    }

    // Check if any child is active
    const isChildActive = hasChildren && item.children?.some(child =>
        pathname.startsWith(child.href)
    )

    return (
        <div>
            <Link
                href={item.href}
                className={cn(
                    'group flex items-center gap-3 px-3 py-2 mx-2 text-sm font-medium rounded-lg transition-all duration-200',
                    'hover:bg-neutral-800 hover:text-neutral-0',
                    isActive || isChildActive
                        ? 'bg-primary-600 text-white shadow-lg'
                        : 'text-neutral-300',
                    isCollapsed && 'justify-center px-2'
                )}
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
            >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                    <>
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                            <Badge variant="error" size="sm">
                                {item.badge}
                            </Badge>
                        )}
                        {hasChildren && (
                            <ChevronRightIcon
                                className={cn(
                                    'h-4 w-4 transition-transform duration-200',
                                    isExpanded && 'rotate-90'
                                )}
                            />
                        )}
                    </>
                )}
            </Link>

            {/* Children */}
            {hasChildren && !isCollapsed && isExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                    {item.children?.map((child) => (
                        <NavItemComponent
                            key={child.href}
                            item={child}
                            isActive={pathname === child.href}
                            isCollapsed={false}
                            userRole={userRole}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/**
 * Sidebar component
 */
interface SidebarProps {
    isCollapsed: boolean
    isHidden: boolean
    userRole: AdminRole
    onToggle: () => void
    onClose: () => void
}

const Sidebar: React.FC<SidebarProps> = ({
    isCollapsed,
    isHidden,
    userRole,
    onToggle,
    onClose
}) => {
    const pathname = usePathname()

    return (
        <>
            {/* Overlay for mobile */}
            {!isHidden && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    sidebarVariants({
                        state: isHidden ? 'hidden' : isCollapsed ? 'collapsed' : 'expanded'
                    })
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-700">
                    {!isCollapsed && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                <ShieldCheckIcon className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-bold text-lg text-neutral-0">
                                Evolution
                            </span>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggle}
                        className="hidden lg:flex"
                    >
                        {isCollapsed ? <Bars3Icon className="h-5 w-5" /> : <XMarkIcon className="h-5 w-5" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="lg:hidden"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                    {navigation.map((item) => (
                        <NavItemComponent
                            key={item.href}
                            item={item}
                            isActive={pathname === item.href}
                            isCollapsed={isCollapsed}
                            userRole={userRole}
                        />
                    ))}
                </nav>

                {/* Quick Actions */}
                {!isCollapsed && (
                    <div className="p-4 border-t border-neutral-700">
                        <Button className="w-full" size="sm">
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Quick Add
                        </Button>
                    </div>
                )}
            </div>
        </>
    )
}

/**
 * Breadcrumb component
 */
interface BreadcrumbProps {
    items: BreadcrumbItem[]
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
    return (
        <nav className="flex items-center space-x-2 text-sm">
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    {index > 0 && (
                        <ChevronRightIcon className="h-4 w-4 text-neutral-400" />
                    )}
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="text-neutral-400 hover:text-neutral-0 transition-colors"
                        >
                            {item.name}
                        </Link>
                    ) : (
                        <span className="text-neutral-0 font-medium">{item.name}</span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    )
}

/**
 * Header component
 */
interface HeaderProps {
    user: AdminLayoutProps['user']
    breadcrumbs?: BreadcrumbItem[]
    notificationCount?: number
    onSearch?: (query: string) => void
    onUserAction?: (action: string) => void
    onMenuToggle: () => void
}

const Header: React.FC<HeaderProps> = ({
    user,
    breadcrumbs = [],
    notificationCount = 0,
    onSearch,
    onUserAction,
    onMenuToggle
}) => {
    const [searchQuery, setSearchQuery] = React.useState('')

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        onSearch?.(searchQuery)
    }

    return (
        <header className="bg-neutral-900 border-b border-neutral-700 px-4 py-3">
            <div className="flex items-center justify-between">
                {/* Left side */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onMenuToggle}
                        className="lg:hidden"
                    >
                        <Bars3Icon className="h-5 w-5" />
                    </Button>

                    {breadcrumbs.length > 0 && (
                        <Breadcrumb items={breadcrumbs} />
                    )}
                </div>

                {/* Center - Search */}
                <div className="hidden md:block flex-1 max-w-md mx-8">
                    <form onSubmit={handleSearch} className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                            type="text"
                            placeholder="Search content, users, analytics..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </form>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3">
                    {/* Quick Actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <PlusIcon className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="right">
                            <DropdownMenuItem>
                                <VideoCameraIcon className="h-4 w-4" />
                                Add Video
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <UserGroupIcon className="h-4 w-4" />
                                Add User
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <DocumentTextIcon className="h-4 w-4" />
                                Create Category
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Notifications */}
                    <Button variant="ghost" size="icon" className="relative">
                        <BellIcon className="h-5 w-5" />
                        {notificationCount > 0 && (
                            <Badge
                                variant="error"
                                size="sm"
                                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                            >
                                {notificationCount > 9 ? '9+' : notificationCount}
                            </Badge>
                        )}
                    </Button>

                    {/* User Menu */}
                    <UserActionsDropdown
                        user={user}
                        onViewProfile={() => onUserAction?.('profile')}
                        onEditProfile={() => onUserAction?.('edit')}
                        onChangePassword={() => onUserAction?.('password')}
                        onLogout={() => onUserAction?.('logout')}
                    />
                </div>
            </div>
        </header>
    )
}

/**
 * Footer component
 */
interface FooterProps {
    systemStatus?: SystemStatus
}

const Footer: React.FC<FooterProps> = ({ systemStatus }) => {
    const getStatusColor = (status: 'online' | 'offline' | 'warning') => {
        switch (status) {
            case 'online':
                return 'text-success-400'
            case 'offline':
                return 'text-error-400'
            case 'warning':
                return 'text-warning-400'
            default:
                return 'text-neutral-400'
        }
    }

    const getStatusIcon = (status: 'online' | 'offline' | 'warning') => {
        if (status === 'online') return '●'
        if (status === 'offline') return '●'
        return '●'
    }

    return (
        <footer className="bg-neutral-900 border-t border-neutral-700 px-6 py-3">
            <div className="flex items-center justify-between text-sm">
                <div className="text-neutral-400">
                    © 2024 Evolution Combatives. Professional tactical training platform.
                </div>

                {systemStatus && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <ServerIcon className="h-4 w-4 text-neutral-400" />
                            <span className={getStatusColor(systemStatus.database)}>
                                {getStatusIcon(systemStatus.database)} Database
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <WifiIcon className="h-4 w-4 text-neutral-400" />
                            <span className={getStatusColor(systemStatus.api)}>
                                {getStatusIcon(systemStatus.api)} API
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className={getStatusColor(systemStatus.cdn)}>
                                {getStatusIcon(systemStatus.cdn)} CDN
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </footer>
    )
}

/**
 * Main Admin Layout component
 */
const AdminLayout: React.FC<AdminLayoutProps> = ({
    children,
    userRole,
    user,
    breadcrumbs = [],
    systemStatus = { database: 'online', api: 'online', cdn: 'online' },
    notificationCount = 0,
    onSearch,
    onUserAction,
}) => {
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
    const [sidebarHidden, setSidebarHidden] = React.useState(true)

    const handleSidebarToggle = () => {
        setSidebarCollapsed(!sidebarCollapsed)
    }

    const handleMobileMenuToggle = () => {
        setSidebarHidden(!sidebarHidden)
    }

    const handleSidebarClose = () => {
        setSidebarHidden(true)
    }

    return (
        <div className="min-h-screen bg-neutral-950">
            {/* Sidebar */}
            <Sidebar
                isCollapsed={sidebarCollapsed}
                isHidden={sidebarHidden}
                userRole={userRole}
                onToggle={handleSidebarToggle}
                onClose={handleSidebarClose}
            />

            {/* Main Content */}
            <div
                className={cn(
                    contentVariants({
                        sidebarState: sidebarCollapsed ? 'collapsed' : 'expanded'
                    })
                )}
            >
                {/* Header */}
                <Header
                    user={user}
                    breadcrumbs={breadcrumbs}
                    notificationCount={notificationCount}
                    onSearch={onSearch}
                    onUserAction={onUserAction}
                    onMenuToggle={handleMobileMenuToggle}
                />

                {/* Main Content Area */}
                <main className="flex-1 p-6">
                    {children}
                </main>

                {/* Footer */}
                <Footer systemStatus={systemStatus} />
            </div>
        </div>
    )
}

export default AdminLayout
export type { AdminLayoutProps, AdminRole, BreadcrumbItem, SystemStatus }