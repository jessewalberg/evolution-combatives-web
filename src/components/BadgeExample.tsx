/**
 * Evolution Combatives Badge Example
 * Comprehensive demonstration of all badge variants and specialized badges
 * Designed for law enforcement, military, and martial arts administration
 * 
 * @description Example component showcasing badge system capabilities
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import {
    Badge,
    SubscriptionBadge,
    AdminRoleBadge,
    VideoStatusBadge,
    UserStatusBadge,
    HeroIcons
} from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

/**
 * Badge Example Component
 */
const BadgeExample: React.FC = () => {
    const [interactiveCount, setInteractiveCount] = React.useState(0)

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-neutral-0">Badge Components</h1>
                <p className="text-neutral-400">
                    Professional badges for status indicators, subscription tiers, admin roles, and more.
                </p>
            </div>

            {/* Basic Badge Variants */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Badge Variants</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Solid Badges */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Solid Badges</h3>
                        <div className="flex flex-wrap gap-3">
                            <Badge variant="default">Default</Badge>
                            <Badge variant="primary">Primary</Badge>
                            <Badge variant="secondary">Secondary</Badge>
                            <Badge variant="success">Success</Badge>
                            <Badge variant="warning">Warning</Badge>
                            <Badge variant="error">Error</Badge>
                            <Badge variant="info">Info</Badge>
                            <Badge variant="gold">Gold Premium</Badge>
                        </div>
                    </div>

                    {/* Outline Badges */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Outline Badges</h3>
                        <div className="flex flex-wrap gap-3">
                            <Badge variant="default" appearance="outline">Default</Badge>
                            <Badge variant="primary" appearance="outline">Primary</Badge>
                            <Badge variant="secondary" appearance="outline">Secondary</Badge>
                            <Badge variant="success" appearance="outline">Success</Badge>
                            <Badge variant="warning" appearance="outline">Warning</Badge>
                            <Badge variant="error" appearance="outline">Error</Badge>
                            <Badge variant="info" appearance="outline">Info</Badge>
                        </div>
                    </div>

                    {/* Soft Badges */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Soft Badges</h3>
                        <div className="flex flex-wrap gap-3">
                            <Badge variant="default" appearance="soft">Default</Badge>
                            <Badge variant="primary" appearance="soft">Primary</Badge>
                            <Badge variant="secondary" appearance="soft">Secondary</Badge>
                            <Badge variant="success" appearance="soft">Success</Badge>
                            <Badge variant="warning" appearance="soft">Warning</Badge>
                            <Badge variant="error" appearance="soft">Error</Badge>
                            <Badge variant="info" appearance="soft">Info</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Badge Sizes */}
            <Card>
                <CardHeader>
                    <CardTitle>Badge Sizes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Badge variant="primary" size="xs">Extra Small</Badge>
                        <Badge variant="primary" size="sm">Small</Badge>
                        <Badge variant="primary" size="md">Medium</Badge>
                        <Badge variant="primary" size="lg">Large</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Badges with Icons */}
            <Card>
                <CardHeader>
                    <CardTitle>Badges with Icons</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <Badge
                            variant="success"
                            icon={<HeroIcons.CheckCircle className="h-3 w-3" />}
                        >
                            Verified
                        </Badge>
                        <Badge
                            variant="warning"
                            icon={<HeroIcons.ExclamationTriangle className="h-3 w-3" />}
                        >
                            Warning
                        </Badge>
                        <Badge
                            variant="error"
                            icon={<HeroIcons.XCircle className="h-3 w-3" />}
                        >
                            Failed
                        </Badge>
                        <Badge
                            variant="info"
                            icon={<HeroIcons.Clock className="h-3 w-3" />}
                        >
                            Pending
                        </Badge>
                        <Badge
                            variant="gold"
                            icon={<HeroIcons.Trophy className="h-3 w-3" />}
                        >
                            Premium
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Interactive Badges */}
            <Card>
                <CardHeader>
                    <CardTitle>Interactive Badges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <Badge
                            variant="primary"
                            interactive
                            onBadgeClick={() => setInteractiveCount(prev => prev + 1)}
                        >
                            Click me ({interactiveCount})
                        </Badge>
                        <Badge
                            variant="success"
                            appearance="outline"
                            interactive
                            icon={<HeroIcons.Star className="h-3 w-3" />}
                            onBadgeClick={() => alert('Starred!')}
                        >
                            Star
                        </Badge>
                        <Badge
                            variant="info"
                            appearance="soft"
                            interactive
                            onBadgeClick={() => alert('Info clicked!')}
                        >
                            Interactive Info
                        </Badge>
                    </div>
                    <p className="text-sm text-neutral-400">
                        Click the badges above to see interactive behavior
                    </p>
                </CardContent>
            </Card>

            {/* Subscription Tier Badges */}
            <Card>
                <CardHeader>
                    <CardTitle>Subscription Tier Badges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Solid Subscription Badges</h3>
                        <div className="flex flex-wrap gap-3">
                            <SubscriptionBadge tier="none" />
                            <SubscriptionBadge tier="beginner" />
                            <SubscriptionBadge tier="intermediate" />
                            <SubscriptionBadge tier="advanced" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Outline Subscription Badges</h3>
                        <div className="flex flex-wrap gap-3">
                            <SubscriptionBadge tier="none" appearance="outline" />
                            <SubscriptionBadge tier="beginner" appearance="outline" />
                            <SubscriptionBadge tier="intermediate" appearance="outline" />
                            <SubscriptionBadge tier="advanced" appearance="outline" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Soft Subscription Badges</h3>
                        <div className="flex flex-wrap gap-3">
                            <SubscriptionBadge tier="none" appearance="soft" />
                            <SubscriptionBadge tier="beginner" appearance="soft" />
                            <SubscriptionBadge tier="intermediate" appearance="soft" />
                            <SubscriptionBadge tier="advanced" appearance="soft" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Admin Role Badges */}
            <Card>
                <CardHeader>
                    <CardTitle>Admin Role Badges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Admin Roles</h3>
                        <div className="flex flex-wrap gap-3">
                            <AdminRoleBadge role="super_admin" />
                            <AdminRoleBadge role="content_admin" />
                            <AdminRoleBadge role="support_admin" />
                            <AdminRoleBadge role="user" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Outline Admin Roles</h3>
                        <div className="flex flex-wrap gap-3">
                            <AdminRoleBadge role="super_admin" appearance="outline" />
                            <AdminRoleBadge role="content_admin" appearance="outline" />
                            <AdminRoleBadge role="support_admin" appearance="outline" />
                            <AdminRoleBadge role="user" appearance="outline" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Video Status Badges */}
            <Card>
                <CardHeader>
                    <CardTitle>Video Status Badges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <VideoStatusBadge status="ready" />
                        <VideoStatusBadge status="processing" />
                        <VideoStatusBadge status="error" />
                        <VideoStatusBadge status="draft" />
                        <VideoStatusBadge status="uploaded" />
                        <VideoStatusBadge status="archived" />
                    </div>
                </CardContent>
            </Card>

            {/* User Status Badges */}
            <Card>
                <CardHeader>
                    <CardTitle>User Status Badges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <UserStatusBadge status="active" />
                        <UserStatusBadge status="inactive" />
                        <UserStatusBadge status="suspended" />
                        <UserStatusBadge status="pending" />
                    </div>
                </CardContent>
            </Card>

            {/* Usage Examples */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage Examples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* User Profile Example */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">User Profile</h3>
                        <div className="p-4 bg-neutral-800 rounded-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center">
                                    <span className="text-neutral-0 font-medium">JS</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-neutral-0 font-medium">John Smith</h4>
                                        <AdminRoleBadge role="super_admin" size="xs" />
                                        <UserStatusBadge status="active" size="xs" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-neutral-400 text-sm">john.smith@police.gov</span>
                                        <SubscriptionBadge tier="advanced" size="xs" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Video List Example */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium text-neutral-0">Video Management</h3>
                        <div className="space-y-2">
                            <div className="p-3 bg-neutral-800 rounded-lg flex items-center justify-between">
                                <div>
                                    <h4 className="text-neutral-0 font-medium">Tactical Handgun Fundamentals</h4>
                                    <p className="text-neutral-400 text-sm">Duration: 30:45 • Views: 2,500</p>
                                </div>
                                <div className="flex gap-2">
                                    <VideoStatusBadge status="ready" size="xs" />
                                    <Badge variant="info" size="xs">Firearms</Badge>
                                </div>
                            </div>

                            <div className="p-3 bg-neutral-800 rounded-lg flex items-center justify-between">
                                <div>
                                    <h4 className="text-neutral-0 font-medium">Close Quarters Combat</h4>
                                    <p className="text-neutral-400 text-sm">Duration: 45:20 • Views: 1,800</p>
                                </div>
                                <div className="flex gap-2">
                                    <VideoStatusBadge status="processing" size="xs" />
                                    <Badge variant="warning" size="xs">Hand-to-Hand</Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Reset Demo */}
            <Card>
                <CardHeader>
                    <CardTitle>Demo Controls</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        onClick={() => setInteractiveCount(0)}
                    >
                        Reset Interactive Counter
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

export default BadgeExample 