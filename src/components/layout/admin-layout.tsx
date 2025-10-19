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
import ROUTES from '../../lib/routes'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { ThemeToggle } from '../../providers/ThemeProvider'
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
    MagnifyingGlassIcon,
    BellIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    VideoCameraIcon,
    UserGroupIcon,
    ShieldCheckIcon,
    ServerIcon,
    WifiIcon,
} from '@heroicons/react/24/outline'
import { PlusIcon } from 'lucide-react'

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
    disabled?: boolean
    comingSoon?: boolean
}

/**
 * Navigation configuration
 */
const navigation: NavItem[] = [
    {
        name: 'Dashboard',
        href: ROUTES.DASHBOARD.HOME,
        icon: HomeIcon,
        roles: ['super_admin', 'content_admin', 'support_admin'],
    },
    {
        name: 'Content',
        href: ROUTES.DASHBOARD.CONTENT.VIDEOS,
        icon: PlayIcon,
        roles: ['super_admin', 'content_admin'],
        children: [
            {
                name: 'Videos',
                href: ROUTES.DASHBOARD.CONTENT.VIDEOS,
                icon: VideoCameraIcon,
                roles: ['super_admin', 'content_admin'],
            },
            {
                name: 'Categories',
                href: ROUTES.DASHBOARD.CONTENT.CATEGORIES,
                icon: DocumentTextIcon,
                roles: ['super_admin', 'content_admin'],
            },
            {
                name: 'Disciplines',
                href: ROUTES.DASHBOARD.CONTENT.DISCIPLINES,
                icon: DocumentTextIcon,
                roles: ['super_admin', 'content_admin'],
            },
        ],
    },
    {
        name: 'Users',
        href: ROUTES.USERS.LIST,
        icon: UsersIcon,
        roles: ['super_admin', 'support_admin'],
    },
    {
        name: 'Analytics',
        href: ROUTES.ANALYTICS.HOME,
        icon: ChartBarIcon,
        roles: ['super_admin', 'content_admin'],
        disabled: true,
        comingSoon: true,
    },
    {
        name: 'Q&A',
        href: ROUTES.QA.LIST,
        icon: ChatBubbleLeftRightIcon,
        badge: 5, // Example notification count
        roles: ['super_admin', 'support_admin'],
        disabled: true,
        comingSoon: true,
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
        'flex flex-col bg-slate-900 dark:bg-slate-950 border-r border-slate-700 dark:border-slate-800',
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
const contentVariants = cva('flex-1 flex flex-col min-h-screen bg-background transition-all duration-300', {
    variants: {
        sidebarState: {
            expanded: 'pl-0 lg:pl-64',
            collapsed: 'pl-0 lg:pl-16',
            hidden: 'pl-0',
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
    onLinkClick?: () => void
}

const NavItemComponent: React.FC<NavItemComponentProps> = ({
    item,
    isActive,
    isCollapsed,
    userRole,
    onLinkClick
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
            {hasChildren ? (
                // Parent item with children - just toggle expansion, no navigation
                <button
                    className={cn(
                        'group flex items-center gap-3 px-3 py-2 mx-2 text-sm font-medium rounded-lg transition-all duration-200 w-full',
                        'hover:bg-accent hover:text-accent-foreground',
                        isChildActive
                            ? 'bg-primary text-primary-foreground shadow-lg !text-white'
                            : 'text-card-foreground hover:text-foreground !text-slate-200 dark:!text-slate-300 hover:!text-white dark:hover:!text-white',
                        isCollapsed && 'justify-center px-2'
                    )}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <item.icon className={cn(
                        "h-5 w-5 flex-shrink-0 transition-colors",
                        isChildActive
                            ? "text-primary-foreground !text-white"
                            : "text-card-foreground group-hover:text-foreground !text-slate-200 dark:!text-slate-300 group-hover:!text-white dark:group-hover:!text-white"
                    )} />
                    {!isCollapsed && (
                        <>
                            <span className="flex-1 text-left">{item.name}</span>
                            {item.badge && (
                                <Badge variant="error" size="sm">
                                    {item.badge}
                                </Badge>
                            )}
                            <ChevronRightIcon
                                className={cn(
                                    'h-4 w-4 transition-transform duration-200',
                                    isExpanded && 'rotate-90'
                                )}
                            />
                        </>
                    )}
                </button>
            ) : item.disabled ? (
                // Disabled navigation item - show as coming soon
                <div
                    className={cn(
                        'flex items-center gap-3 px-3 py-2 mx-2 text-sm font-medium rounded-lg transition-all duration-200',
                        'opacity-60 cursor-not-allowed',
                        'text-card-foreground !text-slate-400 dark:!text-slate-500',
                        isCollapsed && 'justify-center px-2'
                    )}
                    title={item.comingSoon ? `${item.name} - Coming Soon` : `${item.name} - Disabled`}
                >
                    <item.icon className="h-5 w-5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                    {!isCollapsed && (
                        <>
                            <span className="flex-1">{item.name}</span>
                            {item.comingSoon && (
                                <Badge variant="warning" size="sm" className="text-xs">
                                    Soon
                                </Badge>
                            )}
                            {item.badge && !item.comingSoon && (
                                <Badge variant="error" size="sm">
                                    {item.badge}
                                </Badge>
                            )}
                        </>
                    )}
                </div>
            ) : (
                // Regular navigation item - navigate to href
                <Link
                    href={item.href}
                    className={cn(
                        'group flex items-center gap-3 px-3 py-2 mx-2 text-sm font-medium rounded-lg transition-all duration-200',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive
                            ? 'bg-primary text-primary-foreground shadow-lg !text-white'
                            : 'text-card-foreground hover:text-foreground !text-slate-200 dark:!text-slate-300 hover:!text-white dark:hover:!text-white',
                        isCollapsed && 'justify-center px-2'
                    )}
                    onClick={onLinkClick}
                >
                    <item.icon className={cn(
                        "h-5 w-5 flex-shrink-0 transition-colors",
                        isActive
                            ? "text-primary-foreground !text-white"
                            : "text-card-foreground group-hover:text-foreground !text-slate-200 dark:!text-slate-300 group-hover:!text-white dark:group-hover:!text-white"
                    )} />
                    {!isCollapsed && (
                        <>
                            <span className="flex-1">{item.name}</span>
                            {item.badge && (
                                <Badge variant="error" size="sm">
                                    {item.badge}
                                </Badge>
                            )}
                        </>
                    )}
                </Link>
            )}

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
                            onLinkClick={onLinkClick}
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
                <div className="flex items-center justify-between p-4 border-b border-slate-700 dark:border-slate-800">
                    {!isCollapsed && (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <ShieldCheckIcon className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <span className="font-bold text-lg !text-white">
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
                        {isCollapsed ? <Bars3Icon className="h-5 w-5 !text-white" /> : <XMarkIcon className="h-5 w-5 !text-white" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="lg:hidden"
                    >
                        <XMarkIcon className="h-5 w-5 !text-white" />
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
                            onLinkClick={onClose}
                        />
                    ))}
                </nav>

                {/* Quick Actions */}
                {!isCollapsed && (
                    <div className="p-4 border-t border-slate-700 dark:border-slate-800">
                        <Button className="w-full" size="sm" variant="outline">
                            <PlusIcon className="h-4 w-4 mr-2 text-current" />
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
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    {item.href ? (
                        <Link
                            href={item.href}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {item.name}
                        </Link>
                    ) : (
                        <span className="text-foreground font-medium">{item.name}</span>
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
        <header className="bg-card border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
                {/* Left side */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuToggle}
                        className="lg:hidden relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200"
                        aria-label="Toggle menu"
                    >
                        <Bars3Icon className="h-5 w-5" />
                    </button>

                    {breadcrumbs.length > 0 && (
                        <Breadcrumb items={breadcrumbs} />
                    )}
                </div>

                {/* Center - Search */}
                <div className="hidden md:block flex-1 max-w-md mx-8">
                    <form onSubmit={handleSearch} className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                    {/* Theme Toggle */}
                    <ThemeToggle />

                    {/* Quick Actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200"
                                aria-label="Quick actions"
                            >
                                <PlusIcon className="h-5 w-5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="right">
                            <DropdownMenuItem
                                onClick={() => window.location.href = ROUTES.DASHBOARD.CONTENT.VIDEO_UPLOAD}
                                className="cursor-pointer"
                            >
                                <VideoCameraIcon className="h-4 w-4 text-current mr-3" />
                                Add Video
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    // User creation functionality coming soon
                                    alert('User creation feature coming soon!')
                                }}
                                className="cursor-pointer"
                            >
                                <UserGroupIcon className="h-4 w-4 text-current opacity-60 mr-3" />
                                <span className="opacity-60">Add User (Soon)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => window.location.href = ROUTES.DASHBOARD.CONTENT.CATEGORIES}
                                className="cursor-pointer"
                            >
                                <DocumentTextIcon className="h-4 w-4 text-current mr-3" />
                                Create Category
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Notifications */}
                    <button
                        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200"
                        aria-label="Notifications"
                    >
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
                    </button>

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
        <footer className="bg-card border-t border-border px-6 py-3">
            <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                    © 2024 Evolution Combatives. Professional tactical training platform.
                </div>

                {systemStatus && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <ServerIcon className="h-4 w-4 text-muted-foreground" />
                            <span className={getStatusColor(systemStatus.database)}>
                                {getStatusIcon(systemStatus.database)} Database
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <WifiIcon className="h-4 w-4 text-muted-foreground" />
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
        <div className="min-h-screen bg-background">
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