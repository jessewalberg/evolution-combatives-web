/**
 * Evolution Combatives Card Examples
 * Demonstration of the professional card component system
 */

import React from 'react'
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    StatsCard,
    ActionCard
} from './ui/card'
import { Button } from './ui/button'

export default function CardExample() {
    const [selectedCard, setSelectedCard] = React.useState<string | null>(null)

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-8 bg-neutral-900 text-neutral-0 min-h-screen">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-neutral-0">
                    Evolution Combatives Card System
                </h1>
                <p className="text-neutral-300">
                    Professional card components for tactical training administration
                </p>
            </div>

            {/* Basic Card Variants */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-neutral-0">Card Variants</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card variant="default">
                        <CardHeader>
                            <CardTitle>Default Card</CardTitle>
                            <CardDescription>Standard card with subtle shadow</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-neutral-300">
                                Perfect for general content and information display.
                            </p>
                        </CardContent>
                    </Card>

                    <Card variant="elevated">
                        <CardHeader>
                            <CardTitle>Elevated Card</CardTitle>
                            <CardDescription>More prominent with larger shadow</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-neutral-300">
                                Great for important content that needs emphasis.
                            </p>
                        </CardContent>
                    </Card>

                    <Card variant="interactive" onCardClick={() => setSelectedCard('interactive')}>
                        <CardHeader>
                            <CardTitle>Interactive Card</CardTitle>
                            <CardDescription>Click me!</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-neutral-300">
                                {selectedCard === 'interactive' ? 'Card clicked!' : 'Clickable with hover effects.'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Padding Variants */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-neutral-0">Padding Options</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card padding="sm">
                        <CardTitle level="h4">Small Padding</CardTitle>
                        <CardContent>
                            <p className="text-neutral-300 text-sm">
                                16px padding for compact layouts.
                            </p>
                        </CardContent>
                    </Card>

                    <Card padding="default">
                        <CardTitle level="h4">Default Padding</CardTitle>
                        <CardContent>
                            <p className="text-neutral-300 text-sm">
                                24px padding for standard content.
                            </p>
                        </CardContent>
                    </Card>

                    <Card padding="lg">
                        <CardTitle level="h4">Large Padding</CardTitle>
                        <CardContent>
                            <p className="text-neutral-300 text-sm">
                                32px padding for spacious layouts.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Complete Card Structure */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-neutral-0">Complete Card Structure</h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card variant="elevated">
                        <CardHeader>
                            <CardTitle>Video Analytics Dashboard</CardTitle>
                            <CardDescription>Performance metrics for the last 30 days</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-neutral-700/50 rounded">
                                    <span className="text-sm font-medium">Total Views</span>
                                    <span className="text-lg font-bold text-primary-400">12,543</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-neutral-700/50 rounded">
                                    <span className="text-sm font-medium">Completion Rate</span>
                                    <span className="text-lg font-bold text-success-400">87.3%</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-neutral-700/50 rounded">
                                    <span className="text-sm font-medium">Average Duration</span>
                                    <span className="text-lg font-bold text-warning-400">4:32</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" size="sm">
                                View Details
                            </Button>
                            <Button variant="primary" size="sm">
                                Export Report
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card variant="glass">
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>Quick actions for user administration</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-2 hover:bg-neutral-700/30 rounded transition-colors">
                                    <span className="text-sm">Active Users</span>
                                    <span className="text-sm font-semibold text-success-400">1,247</span>
                                </div>
                                <div className="flex items-center justify-between p-2 hover:bg-neutral-700/30 rounded transition-colors">
                                    <span className="text-sm">Pending Approvals</span>
                                    <span className="text-sm font-semibold text-warning-400">23</span>
                                </div>
                                <div className="flex items-center justify-between p-2 hover:bg-neutral-700/30 rounded transition-colors">
                                    <span className="text-sm">Suspended</span>
                                    <span className="text-sm font-semibold text-error-400">5</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button variant="ghost" size="sm" className="w-full">
                                Manage Users →
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </section>

            {/* Stats Cards */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-neutral-0">Statistics Cards</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard
                        title="Total Revenue"
                        value="$24,680"
                        description="This month"
                        trend={{ value: 12.5, isPositive: true }}
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                        }
                    />

                    <StatsCard
                        title="Active Students"
                        value="1,247"
                        description="Currently enrolled"
                        trend={{ value: 8.2, isPositive: true }}
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                            </svg>
                        }
                    />

                    <StatsCard
                        title="Video Completion"
                        value="87.3%"
                        description="Average rate"
                        trend={{ value: 3.1, isPositive: false }}
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        }
                    />

                    <StatsCard
                        title="Support Tickets"
                        value="23"
                        description="Open this week"
                        icon={
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        }
                    />
                </div>
            </section>

            {/* Action Cards */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-neutral-0">Action Cards</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ActionCard
                        title="Upload New Video"
                        description="Add training content to the platform"
                        icon={
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        }
                        action={{
                            label: "Start Upload",
                            onClick: () => alert("Upload video clicked!")
                        }}
                    />

                    <ActionCard
                        title="Manage Users"
                        description="Review user accounts and permissions"
                        icon={
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                            </svg>
                        }
                        action={{
                            label: "Open Panel",
                            onClick: () => alert("User management clicked!")
                        }}
                    />

                    <ActionCard
                        title="Analytics Report"
                        description="Generate comprehensive performance reports"
                        icon={
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        }
                        action={{
                            label: "Generate",
                            onClick: () => alert("Analytics report clicked!")
                        }}
                    />
                </div>
            </section>

            {/* Custom Layouts */}
            <section className="space-y-6">
                <h2 className="text-2xl font-semibold text-neutral-0">Custom Layouts</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card padding="none" className="overflow-hidden">
                        <div className="h-32 bg-gradient-to-r from-primary-600 to-primary-800 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-white">47</div>
                                <div className="text-primary-100 text-sm">Active Sessions</div>
                            </div>
                        </div>
                        <div className="p-6">
                            <CardTitle level="h4">Live Training</CardTitle>
                            <CardDescription>Students currently in live sessions</CardDescription>
                        </div>
                    </Card>

                    <Card variant="bordered" className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                            <CardDescription>Latest actions in the system</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[
                                    { action: "New user registered", user: "john.doe@tactical.com", time: "2 min ago" },
                                    { action: "Video uploaded", user: "instructor.smith", time: "15 min ago" },
                                    { action: "Payment processed", user: "admin", time: "1 hour ago" },
                                    { action: "Course completed", user: "officer.johnson", time: "3 hours ago" }
                                ].map((activity, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-700/30 rounded">
                                        <div>
                                            <div className="text-sm font-medium text-neutral-0">{activity.action}</div>
                                            <div className="text-xs text-neutral-400">{activity.user}</div>
                                        </div>
                                        <div className="text-xs text-neutral-500">{activity.time}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    )
} 