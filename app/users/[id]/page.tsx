/**
 * Evolution Combatives - Individual User Profile Management
 * Comprehensive user profile dashboard for tactical training platform
 * 
 * @description Detailed user management with subscription, activity, and admin controls
 * @author Evolution Combatives
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../src/hooks/useAuth'
import { Card } from '../../../src/components/ui/card'
import { Button } from '../../../src/components/ui/button'
import { Input } from '../../../src/components/ui/input'
import { Badge } from '../../../src/components/ui/badge'
import { Avatar } from '../../../src/components/ui/avatar'
import { Spinner } from '../../../src/components/ui/loading'
import { createClientComponentClient } from '../../../src/lib/supabase-browser'
import { queryKeys } from '../../../src/lib/query-client'
import type {
    Profile,
    Subscription,
    UserProgress,
    Question,
    VideoWithRelations,
    SubscriptionTier,
    SubscriptionStatus
} from 'shared/types/database'

// Icons
import {
    ArrowLeftIcon,
    PencilIcon,
    EnvelopeIcon,
    CreditCardIcon,
    PlayIcon,
    ChatBubbleLeftIcon,
    ClockIcon,
    EyeIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    CalendarIcon,
    DocumentTextIcon,
    BanknotesIcon,

    ArrowRightOnRectangleIcon,
    LockClosedIcon,
    PlusIcon,
    ArrowUpIcon
} from '@heroicons/react/24/outline'

// TypeScript interfaces
interface UserProfileData extends Profile {
    subscription?: Subscription
    subscriptionHistory?: Subscription[]
    progress?: (UserProgress & {
        video?: VideoWithRelations
    })[]
    questions?: (Question & {
        answers?: Answer[]
    })[]
    notifications?: unknown[]
    activityTimeline?: ActivityEvent[]
    deviceInfo?: DeviceInfo[]
    supportNotes?: SupportNote[]
    paymentHistory?: PaymentRecord[]
}

interface ActivityEvent {
    id: string
    type: 'video_watched' | 'question_asked' | 'subscription_changed' | 'login' | 'achievement' | 'support_note' | 'payment'
    title: string
    description: string
    timestamp: string
    metadata?: Record<string, unknown>
}

interface DeviceInfo {
    id: string
    deviceType: string
    deviceName: string
    platform: string
    lastUsed: string
    location?: string
    ipAddress?: string
}

interface SupportNote {
    id: string
    content: string
    admin_id: string
    admin_name: string
    created_at: string
    type: 'note' | 'warning' | 'escalation' | 'resolution'
    is_internal: boolean
}

interface PaymentRecord {
    id: string
    amount: number
    currency: string
    status: 'succeeded' | 'failed' | 'pending' | 'refunded'
    payment_method: string
    stripe_payment_intent_id?: string
    created_at: string
    subscription_id?: string
    description?: string
}

interface SubscriptionAction {
    id: string
    label: string
    description: string
    tier?: SubscriptionTier
    variant?: 'primary' | 'outline' | 'destructive'
    action: () => void
    disabled?: boolean
}

interface Answer {
    id: string
    content: string
    admin_id: string
    admin_name: string
    created_at: string
    is_official: boolean
}

interface SubscriptionAction {
    id: string
    label: string
    description: string
    tier?: SubscriptionTier
    action: () => void
    variant?: 'primary' | 'destructive' | 'outline'
    disabled?: boolean
}

interface UserEditForm {
    full_name: string
    email: string
    badge_number: string
    department: string
    rank: string
    admin_role: 'super_admin' | 'content_admin' | 'support_admin' | null
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter()
    const { user: currentUser, profile: currentProfile, hasPermission, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()
    const supabase = createClientComponentClient()

    // Await params in Next.js 15
    const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)

    useEffect(() => {
        params.then(setResolvedParams)
    }, [params])

    const userId = resolvedParams?.id

    // State
    const [activeTab, setActiveTab] = useState<'overview' | 'subscription' | 'activity' | 'progress' | 'questions' | 'support' | 'payments'>('overview')
    const [isEditing, setIsEditing] = useState(false)
    const [isAddingNote, setIsAddingNote] = useState(false)
    const [newNote, setNewNote] = useState('')
    const [noteType, setNoteType] = useState<SupportNote['type']>('note')
    const [isInternal, setIsInternal] = useState(true)
    const [editForm, setEditForm] = useState<UserEditForm>({
        full_name: '',
        email: '',
        badge_number: '',
        department: '',
        rank: '',
        admin_role: null
    })

    // Check permissions
    const canEditUsers = hasPermission('users.write')
    const canViewAnalytics = hasPermission('analytics.read')
    const canManageSubscriptions = hasPermission('subscriptions.write')
    const canSendMessages = hasPermission('messaging.write')
    const canImpersonateUsers = currentProfile?.admin_role === 'super_admin'
    const canAddSupportNotes = hasPermission('support.write')
    const canViewPayments = hasPermission('payments.read')

    // Fetch user profile data
    const userQuery = useQuery({
        queryKey: queryKeys.userDetail(userId || ''),
        enabled: !!userId, // Only run query when userId is available
        queryFn: async (): Promise<UserProfileData> => {
            console.log('Fetching user profile for ID:', userId)

            // Fetch basic profile data first
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single()

            if (profileError) {
                console.error('Profile error:', profileError)
                throw profileError
            }

            console.log('Profile data:', profile)

            // Try to fetch subscription data separately
            let subscriptions = []
            try {
                const { data: subData, error: subError } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })

                if (subError) {
                    console.warn('Subscription error:', subError)
                } else {
                    subscriptions = subData || []
                }
            } catch (error) {
                console.warn('Subscription fetch failed:', error)
            }

            // Try to fetch user progress separately (simplified)
            let progress = []
            try {
                const { data: progressData, error: progressError } = await supabase
                    .from('user_progress')
                    .select('*')
                    .eq('user_id', userId)
                    .limit(50)

                if (progressError) {
                    console.warn('Progress error:', progressError)
                } else {
                    progress = progressData || []
                }
            } catch (error) {
                console.warn('Progress fetch failed:', error)
            }

            // Try to fetch questions separately
            let questions = []
            try {
                const { data: questionsData, error: questionsError } = await supabase
                    .from('questions')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (questionsError) {
                    console.warn('Questions error:', questionsError)
                } else {
                    questions = questionsData || []
                }
            } catch (error) {
                console.warn('Questions fetch failed:', error)
            }

            // Try to fetch support notes separately
            let notes = []
            try {
                const { data: supportNotes, error: supportError } = await supabase
                    .from('support_notes')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })

                if (supportError) {
                    console.warn('Support notes error:', supportError)
                } else {
                    notes = supportNotes || []
                }
            } catch (error) {
                console.warn('Support notes fetch failed:', error)
            }

            // Try to fetch payment history separately
            let payments = []
            try {
                const { data: paymentHistory, error: paymentError } = await supabase
                    .from('payment_records')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(50)

                if (paymentError) {
                    console.warn('Payment history error:', paymentError)
                } else {
                    payments = paymentHistory || []
                }
            } catch (error) {
                console.warn('Payment history fetch failed:', error)
            }

            return {
                ...profile,
                subscription: subscriptions?.[0] || undefined,
                subscriptionHistory: subscriptions || [],
                progress: progress || [],
                questions: questions || [],
                supportNotes: notes,
                paymentHistory: payments,
                activityTimeline: generateActivityTimeline(profile, subscriptions, progress, questions, notes, payments),
                deviceInfo: [] // Would be populated from device tracking if implemented
            }
        }
    })

    // Generate activity timeline from various data sources
    const generateActivityTimeline = (
        profile: Profile,
        subscriptions: Subscription[],
        progress: (UserProgress & { videos?: VideoWithRelations })[],
        questions: Question[],
        supportNotes: SupportNote[] = [],
        paymentHistory: PaymentRecord[] = []
    ): ActivityEvent[] => {
        const events: ActivityEvent[] = []

        // Account creation
        events.push({
            id: 'account_created',
            type: 'login',
            title: 'Account Created',
            description: 'User joined Evolution Combatives',
            timestamp: profile.created_at
        })

        // Subscription events
        subscriptions.forEach(sub => {
            events.push({
                id: `sub_${sub.id} `,
                type: 'subscription_changed',
                title: `Subscription ${sub.status} `,
                description: `${sub.tier} tier subscription ${sub.status} `,
                timestamp: sub.created_at,
                metadata: { tier: sub.tier, status: sub.status }
            })
        })

        // Recent video progress
        progress.slice(0, 10).forEach(prog => {
            events.push({
                id: `progress_${prog.id} `,
                type: 'video_watched',
                title: 'Video Progress',
                description: `Watched ${prog.videos?.title || 'Unknown Video'} (${prog.progress_percentage}%)`,
                timestamp: prog.last_watched_at,
                metadata: { videoId: prog.video_id, progress: prog.progress_percentage }
            })
        })

        // Recent questions
        questions.slice(0, 5).forEach(question => {
            events.push({
                id: `question_${question.id} `,
                type: 'question_asked',
                title: 'Question Asked',
                description: question.title,
                timestamp: question.created_at,
                metadata: { questionId: question.id, status: question.status }
            })
        })

        // Support notes
        supportNotes.forEach(note => {
            events.push({
                id: `note_${note.id} `,
                type: 'support_note',
                title: `Support ${note.type} `,
                description: note.content.substring(0, 100) + (note.content.length > 100 ? '...' : ''),
                timestamp: note.created_at,
                metadata: { noteId: note.id, type: note.type, adminName: note.admin_name }
            })
        })

        // Payment history
        paymentHistory.forEach(payment => {
            events.push({
                id: `payment_${payment.id} `,
                type: 'payment',
                title: `Payment ${payment.status} `,
                description: `$${payment.amount} ${payment.currency.toUpperCase()} - ${payment.payment_method} `,
                timestamp: payment.created_at,
                metadata: { paymentId: payment.id, amount: payment.amount, status: payment.status }
            })
        })

        return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }

    // Update user mutation
    const updateUserMutation = useMutation({
        mutationFn: async (updates: Partial<UserEditForm> & { is_active?: boolean }) => {
            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.userDetail(userId || '') })
            setIsEditing(false)
            toast.success('User profile updated successfully')
        },
        onError: (error: Error) => {
            toast.error('Failed to update user profile', {
                description: error.message
            })
        }
    })

    // Subscription management mutation
    const updateSubscriptionMutation = useMutation({
        mutationFn: async ({ tier, status }: { tier?: SubscriptionTier; status?: SubscriptionStatus }) => {
            if (!userData?.subscription) {
                // Create new subscription
                const { data, error } = await supabase
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        tier: tier!,
                        status: status || 'active',
                        platform: 'stripe' as const,
                        external_subscription_id: `admin_${userId}_${Date.now()}`,
                        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    })
                    .select()
                    .single()

                if (error) throw error
                return data
            } else {
                // Update existing subscription
                const { data, error } = await supabase
                    .from('subscriptions')
                    .update({ tier, status })
                    .eq('id', userData.subscription.id)
                    .select()
                    .single()

                if (error) throw error
                return data
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.userDetail(userId || '') })
            toast.success('Subscription updated successfully')
        },
        onError: (error: Error) => {
            toast.error('Failed to update subscription', {
                description: error.message
            })
        }
    })

    // Add support note mutation
    const addSupportNoteMutation = useMutation({
        mutationFn: async (noteData: { content: string; type: SupportNote['type']; is_internal: boolean }) => {
            const { data, error } = await supabase
                .from('support_notes')
                .insert({
                    user_id: userId,
                    admin_id: currentUser!.id,
                    admin_name: currentProfile!.full_name || currentProfile!.email,
                    ...noteData
                })
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.userDetail(userId || '') })
            setIsAddingNote(false)
            setNewNote('')
            toast.success('Support note added successfully')
        },
        onError: (error: Error) => {
            toast.error('Failed to add support note', {
                description: error.message
            })
        }
    })

    // User impersonation mutation
    const impersonateUserMutation = useMutation({
        mutationFn: async () => {
            // Create impersonation session token
            const { data, error } = await supabase.rpc('create_impersonation_token', {
                target_user_id: userId,
                admin_user_id: currentUser!.id
            })

            if (error) throw error
            return data
        },
        onSuccess: (token: string) => {
            // Store impersonation token and redirect to mobile app
            localStorage.setItem('impersonation_token', token)
            window.open(`/ impersonate / ${token} `, '_blank')
            toast.success('Impersonation session created')
        },
        onError: (error: Error) => {
            toast.error('Failed to create impersonation session', {
                description: error.message
            })
        }
    })

    const userData = userQuery.data

    // Initialize edit form when user data loads
    useState(() => {
        if (userData && !isEditing) {
            setEditForm({
                full_name: userData.full_name || '',
                email: userData.email,
                badge_number: userData.badge_number || '',
                department: userData.department || '',
                rank: userData.rank || '',
                admin_role: userData.admin_role
            })
        }
    })

    // Subscription management actions
    const subscriptionActions: SubscriptionAction[] = [
        {
            id: 'set_intermediate',
            label: 'Set to Intermediate',
            description: 'Access to advanced training content',
            tier: 'tier2',
            action: () => updateSubscriptionMutation.mutate({ tier: 'tier2', status: 'active' }),
            disabled: userData?.subscription?.tier === 'tier2' || userData?.subscription?.tier === 'tier3'
        },
        {
            id: 'set_advanced',
            label: 'Set to Advanced',
            description: 'Full access to all premium content',
            tier: 'tier3',
            action: () => updateSubscriptionMutation.mutate({ tier: 'tier3', status: 'active' }),
            disabled: userData?.subscription?.tier === 'tier3'
        },
        {
            id: 'cancel_subscription',
            label: 'Cancel Subscription',
            description: 'Cancel at end of current period',
            action: () => updateSubscriptionMutation.mutate({ status: 'canceled' }),
            variant: 'destructive' as const,
            disabled: userData?.subscription?.status === 'canceled'
        }
    ]

    // Handle form submission
    const handleSaveProfile = () => {
        updateUserMutation.mutate(editForm)
    }

    // Handle admin actions
    const handleSuspendUser = () => {
        if (confirm(`Are you sure you want to suspend ${userData?.full_name}?`)) {
            updateUserMutation.mutate({ is_active: false })
        }
    }

    const handleActivateUser = () => {
        updateUserMutation.mutate({ is_active: true })
    }

    const handleSendMessage = () => {
        toast.info('Messaging System Coming Soon', {
            description: 'Direct messaging functionality will be available in a future update.'
        })
    }

    const handleViewAnalytics = () => {
        toast.info('User Analytics Coming Soon', {
            description: 'Individual user analytics dashboard will be available in a future update.'
        })
    }

    const handleImpersonateUser = () => {
        if (confirm(`Are you sure you want to impersonate ${userData?.full_name}? This will create a new session as this user.`)) {
            impersonateUserMutation.mutate()
        }
    }

    const handleAddSupportNote = () => {
        if (newNote.trim()) {
            addSupportNoteMutation.mutate({
                content: newNote.trim(),
                type: noteType,
                is_internal: isInternal
            })
        }
    }

    if (authLoading || !currentUser || !currentProfile?.admin_role) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (userQuery.isLoading || !userId) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (userQuery.error || !userData) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">User Not Found</h1>
                    <p className="text-neutral-400 mb-4">The requested user profile could not be found.</p>
                    <Button onClick={() => router.push('/users')}>
                        <ArrowLeftIcon className="h-4 w-4 mr-2" />
                        Back to Users
                    </Button>
                </div>
            </div>
        )
    }

    // Calculate user statistics
    const totalVideosWatched = userData.progress?.length || 0
    const completedVideos = userData.progress?.filter(p => p.completed).length || 0
    const averageProgress = userData.progress?.length ?
        userData.progress.reduce((sum, p) => sum + p.progress_percentage, 0) / userData.progress.length : 0
    const totalQuestions = userData.questions?.length || 0


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => router.push('/users')}
                        className="flex items-center gap-2 w-fit"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Back to Users</span>
                        <span className="sm:hidden">Back</span>
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
                            {userData.full_name || 'Unnamed User'}
                        </h1>
                        <p className="text-neutral-400 mt-1 text-sm sm:text-base">
                            User Profile Management
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    {canSendMessages && (
                        <Button
                            variant="outline"
                            onClick={handleSendMessage}
                            className="w-full sm:w-auto opacity-75 hover:opacity-100"
                            title="Coming Soon - Direct messaging functionality"
                        >
                            <EnvelopeIcon className="h-4 w-4 mr-2" />
                            <span className="sm:hidden">Message</span>
                            <span className="hidden sm:inline">Send Message</span>
                            <span className="ml-1 text-xs text-neutral-400 hidden lg:inline">(Soon)</span>
                        </Button>
                    )}
                    {canViewAnalytics && (
                        <Button
                            variant="outline"
                            onClick={handleViewAnalytics}
                            className="w-full sm:w-auto opacity-75 hover:opacity-100"
                            title="Coming Soon - Individual user analytics"
                        >
                            <ChartBarIcon className="h-4 w-4 mr-2" />
                            <span className="sm:hidden">Analytics</span>
                            <span className="hidden sm:inline">View Analytics</span>
                            <span className="ml-1 text-xs text-neutral-400 hidden lg:inline">(Soon)</span>
                        </Button>
                    )}
                    {canEditUsers && (
                        <Button
                            onClick={() => setIsEditing(!isEditing)}
                            disabled={updateUserMutation.isPending}
                            className="w-full sm:w-auto"
                        >
                            <PencilIcon className="h-4 w-4 mr-2" />
                            <span className="sm:hidden">{isEditing ? 'Cancel' : 'Edit'}</span>
                            <span className="hidden sm:inline">{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* User Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <Card className="p-4 lg:p-6">
                    <div className="flex items-center gap-3 lg:gap-4">
                        <Avatar
                            src={userData.avatar_url || undefined}
                            alt={userData.full_name || 'User'}
                            size="lg"
                            className="flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-white truncate">
                                {userData.full_name || 'Unnamed User'}
                            </h3>
                            <p className="text-sm text-neutral-400 truncate">{userData.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant={userData.is_active ? 'success' : 'error'}>
                                    {userData.is_active ? 'Active' : 'Suspended'}
                                </Badge>
                                {userData.admin_role && (
                                    <Badge variant="info">
                                        <ShieldCheckIcon className="h-3 w-3 mr-1" />
                                        {userData.admin_role.replace('_', ' ')}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-neutral-400">Subscription</p>
                            <p className="text-2xl font-bold text-white">
                                {userData.subscription?.tier || 'None'}
                            </p>
                            <Badge
                                variant={
                                    userData.subscription?.status === 'active' ? 'success' :
                                        userData.subscription?.status === 'canceled' ? 'error' :
                                            'warning'
                                }
                            >
                                {userData.subscription?.status || 'No Subscription'}
                            </Badge>
                        </div>
                        <CreditCardIcon className="h-8 w-8 text-neutral-400" />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-neutral-400">Videos Watched</p>
                            <p className="text-2xl font-bold text-white">{totalVideosWatched}</p>
                            <p className="text-sm text-green-400">
                                {completedVideos} completed
                            </p>
                        </div>
                        <PlayIcon className="h-8 w-8 text-neutral-400" />
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-neutral-400">Questions Asked</p>
                            <p className="text-2xl font-bold text-white">{totalQuestions}</p>
                            <p className="text-sm text-blue-400">
                                {userData.questions?.filter(q => q.status === 'answered').length || 0} answered
                            </p>
                        </div>
                        <ChatBubbleLeftIcon className="h-8 w-8 text-neutral-400" />
                    </div>
                </Card>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-neutral-700">
                <nav className="-mb-px flex flex-wrap sm:flex-nowrap gap-2 sm:gap-4 lg:gap-8 px-1">
                    {[
                        { id: 'overview', label: 'Overview', icon: EyeIcon },
                        { id: 'subscription', label: 'Subscription', icon: CreditCardIcon },
                        { id: 'activity', label: 'Activity', icon: ClockIcon },
                        { id: 'progress', label: 'Progress', icon: ChartBarIcon },
                        { id: 'questions', label: 'Q&A', icon: ChatBubbleLeftIcon },
                        ...(canAddSupportNotes ? [{ id: 'support', label: 'Support', icon: DocumentTextIcon }] : []),
                        ...(canViewPayments ? [{ id: 'payments', label: 'Payments', icon: BanknotesIcon }] : [])
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 py-3 px-3 sm:px-2 lg:px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-neutral-400 hover:text-neutral-300 hover:border-neutral-300'
                                }`}
                        >
                            <tab.icon className="h-4 w-4 flex-shrink-0" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">
                                {tab.id === 'overview' ? 'Info' :
                                    tab.id === 'subscription' ? 'Sub' :
                                        tab.id === 'activity' ? 'Act' :
                                            tab.id === 'progress' ? 'Prog' :
                                                tab.id === 'questions' ? 'Q&A' :
                                                    tab.id === 'support' ? 'Help' :
                                                        tab.id === 'payments' ? 'Pay' : tab.label}
                            </span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    {/* Profile Information */}
                    <Card className="p-4 lg:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Profile Information</h3>
                            {canEditUsers && !isEditing && (
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                                    <PencilIcon className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {isEditing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                                        Full Name
                                    </label>
                                    <Input
                                        value={editForm.full_name}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                                        placeholder="Enter full name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                                        Email
                                    </label>
                                    <Input
                                        value={editForm.email}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="Enter email"
                                        type="email"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                                        Badge Number
                                    </label>
                                    <Input
                                        value={editForm.badge_number}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, badge_number: e.target.value }))}
                                        placeholder="Enter badge number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                                        Department
                                    </label>
                                    <Input
                                        value={editForm.department}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                                        placeholder="Enter department"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                                        Rank
                                    </label>
                                    <Input
                                        value={editForm.rank}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, rank: e.target.value }))}
                                        placeholder="Enter rank"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-1">
                                        Admin Role
                                    </label>
                                    <select
                                        value={editForm.admin_role || ''}
                                        onChange={(e) => setEditForm(prev => ({
                                            ...prev,
                                            admin_role: (e.target.value as UserEditForm['admin_role']) || null
                                        }))}
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white"
                                    >
                                        <option value="">No Admin Role</option>
                                        <option value="support_admin">Support Admin</option>
                                        <option value="content_admin">Content Admin</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleSaveProfile}
                                        disabled={updateUserMutation.isPending}
                                        className="flex-1"
                                    >
                                        {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsEditing(false)}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Email:</span>
                                    <span className="text-white">{userData.email}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Badge Number:</span>
                                    <span className="text-white">{userData.badge_number || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Department:</span>
                                    <span className="text-white">{userData.department || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Rank:</span>
                                    <span className="text-white">{userData.rank || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Joined:</span>
                                    <span className="text-white">
                                        {new Date(userData.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-400">Last Login:</span>
                                    <span className="text-white">
                                        {userData.last_login_at ?
                                            new Date(userData.last_login_at).toLocaleDateString() :
                                            'Never'
                                        }
                                    </span>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Admin Actions */}
                    {canEditUsers && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Admin Actions</h3>
                            <div className="space-y-3">
                                <Button
                                    variant="outline"
                                    onClick={handleSendMessage}
                                    disabled={!canSendMessages}
                                    className="w-full justify-start opacity-75 hover:opacity-100"
                                    title="Coming Soon - Direct messaging functionality"
                                >
                                    <EnvelopeIcon className="h-4 w-4 mr-3" />
                                    Send Direct Message
                                    <span className="ml-auto text-xs text-neutral-400">(Soon)</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleViewAnalytics}
                                    disabled={!canViewAnalytics}
                                    className="w-full justify-start opacity-75 hover:opacity-100"
                                    title="Coming Soon - Individual user analytics"
                                >
                                    <ChartBarIcon className="h-4 w-4 mr-3" />
                                    View User Analytics
                                    <span className="ml-auto text-xs text-neutral-400">(Soon)</span>
                                </Button>
                                {canImpersonateUsers && (
                                    <Button
                                        variant="outline"
                                        onClick={handleImpersonateUser}
                                        disabled={impersonateUserMutation.isPending}
                                        className="w-full justify-start"
                                    >
                                        <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                                        Impersonate User
                                    </Button>
                                )}
                                {userData.is_active ? (
                                    <Button
                                        variant="destructive"
                                        onClick={handleSuspendUser}
                                        className="w-full justify-start"
                                    >
                                        <ExclamationTriangleIcon className="h-4 w-4 mr-3" />
                                        Suspend Account
                                    </Button>
                                ) : (
                                    <Button
                                        variant="primary"
                                        onClick={handleActivateUser}
                                        className="w-full justify-start"
                                    >
                                        <CheckCircleIcon className="h-4 w-4 mr-3" />
                                        Activate Account
                                    </Button>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {activeTab === 'subscription' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    {/* Current Subscription */}
                    <Card className="p-4 lg:p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Current Subscription</h3>
                        {userData.subscription ? (
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <p className="text-lg sm:text-xl font-bold text-white capitalize">
                                            {userData.subscription.tier} Plan
                                        </p>
                                        <Badge
                                            variant={
                                                userData.subscription.status === 'active' ? 'success' :
                                                    userData.subscription.status === 'canceled' ? 'error' :
                                                        'warning'
                                            }
                                        >
                                            {userData.subscription.status}
                                        </Badge>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p className="text-xl sm:text-2xl font-bold text-white">
                                            ${userData.subscription.tier === 'tier1' ? '9' :
                                                userData.subscription.tier === 'tier2' ? '19' :
                                                    userData.subscription.tier === 'tier3' ? '49' : '0'}
                                        </p>
                                        <p className="text-sm text-neutral-400">/month</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-neutral-400">Started:</span>
                                        <span className="text-white">
                                            {new Date(userData.subscription.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {userData.subscription.current_period_end && (
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Period End:</span>
                                            <span className="text-white">
                                                {new Date(userData.subscription.current_period_end).toLocaleDateString()}
                                            </span>
                                        </div>
                                    )}
                                    {userData.subscription.status === 'canceled' && (
                                        <div className="flex justify-between">
                                            <span className="text-neutral-400">Status:</span>
                                            <span className="text-red-400">Canceled</span>
                                        </div>
                                    )}
                                    {userData.paymentHistory && userData.paymentHistory.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-neutral-700">
                                            <p className="text-sm text-neutral-400 mb-2">Recent Payments:</p>
                                            <div className="space-y-1">
                                                {userData.paymentHistory.slice(0, 3).map(payment => (
                                                    <div key={payment.id} className="flex justify-between text-xs">
                                                        <span className="text-neutral-400">
                                                            ${payment.amount} - {new Date(payment.created_at).toLocaleDateString()}
                                                        </span>
                                                        <Badge
                                                            variant={payment.status === 'succeeded' ? 'success' : 'error'}
                                                            size="sm"
                                                        >
                                                            {payment.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <CreditCardIcon className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                                <p className="text-neutral-400 mb-4">No active subscription</p>
                                <p className="text-sm text-neutral-500">User has free access to beginner content</p>
                                {userData.paymentHistory && userData.paymentHistory.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-sm text-neutral-400">
                                            Previous payments found - check Payment History
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Subscription Management */}
                    {canManageSubscriptions && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Manage Subscription</h3>
                            <div className="space-y-3">
                                {subscriptionActions.map(action => (
                                    <Button
                                        key={action.id}
                                        variant={action.variant || 'outline'}
                                        onClick={action.action}
                                        disabled={action.disabled || updateSubscriptionMutation.isPending}
                                        className="w-full justify-start"
                                    >
                                        <div className="text-left">
                                            <div className="font-medium">{action.label}</div>
                                            <div className="text-sm opacity-75">{action.description}</div>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Subscription History */}
                    <Card className="p-6 lg:col-span-2">
                        <h3 className="text-lg font-semibold text-white mb-4">Subscription History</h3>
                        {userData.subscriptionHistory && userData.subscriptionHistory.length > 0 ? (
                            <div className="space-y-3">
                                {userData.subscriptionHistory.map(sub => (
                                    <div key={sub.id} className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                                        <div>
                                            <p className="font-medium text-white capitalize">{sub.tier} Plan</p>
                                            <p className="text-sm text-neutral-400">
                                                {new Date(sub.created_at).toLocaleDateString()} -
                                                {sub.status === 'canceled' ? 'Canceled' : 'Present'}
                                            </p>
                                        </div>
                                        <Badge
                                            variant={
                                                sub.status === 'active' ? 'success' :
                                                    sub.status === 'canceled' ? 'error' :
                                                        'warning'
                                            }
                                        >
                                            {sub.status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-neutral-400 text-center py-4">No subscription history</p>
                        )}
                    </Card>
                </div>
            )}

            {activeTab === 'activity' && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Activity Timeline</h3>
                        <Badge variant="warning" className="text-xs">
                            Enhanced Soon
                        </Badge>
                    </div>
                    {userData.activityTimeline && userData.activityTimeline.length > 0 ? (
                        <div className="space-y-4">
                            {userData.activityTimeline.slice(0, 20).map(event => (
                                <div key={event.id} className="flex items-start gap-4 p-4 bg-neutral-800 rounded-lg">
                                    <div className={`p-2 rounded-full ${event.type === 'video_watched' ? 'bg-blue-500/20 text-blue-400' :
                                        event.type === 'question_asked' ? 'bg-green-500/20 text-green-400' :
                                            event.type === 'subscription_changed' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        {event.type === 'video_watched' && <PlayIcon className="h-4 w-4" />}
                                        {event.type === 'question_asked' && <ChatBubbleLeftIcon className="h-4 w-4" />}
                                        {event.type === 'subscription_changed' && <CreditCardIcon className="h-4 w-4" />}
                                        {event.type === 'login' && <CalendarIcon className="h-4 w-4" />}
                                        {event.type === 'support_note' && <DocumentTextIcon className="h-4 w-4" />}
                                        {event.type === 'payment' && <BanknotesIcon className="h-4 w-4" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium text-white">{event.title}</h4>
                                            <span className="text-sm text-neutral-400">
                                                {new Date(event.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-400 mt-1">{event.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-neutral-400 text-center py-8">No activity recorded</p>
                    )}
                </Card>
            )}

            {activeTab === 'progress' && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Learning Progress</h3>
                    {userData.progress && userData.progress.length > 0 ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="text-center p-4 bg-neutral-800 rounded-lg">
                                    <p className="text-2xl font-bold text-white">{totalVideosWatched}</p>
                                    <p className="text-sm text-neutral-400">Videos Started</p>
                                </div>
                                <div className="text-center p-4 bg-neutral-800 rounded-lg">
                                    <p className="text-2xl font-bold text-green-400">{completedVideos}</p>
                                    <p className="text-sm text-neutral-400">Videos Completed</p>
                                </div>
                                <div className="text-center p-4 bg-neutral-800 rounded-lg">
                                    <p className="text-2xl font-bold text-blue-400">{averageProgress.toFixed(1)}%</p>
                                    <p className="text-sm text-neutral-400">Average Progress</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {userData.progress.slice(0, 10).map(progress => (
                                    <div key={progress.id} className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-white">
                                                {progress.video?.title || 'Unknown Video'}
                                            </h4>
                                            <p className="text-sm text-neutral-400">
                                                {progress.video?.category?.name} •
                                                Last watched: {new Date(progress.last_watched_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-24 bg-neutral-700 rounded-full h-2">
                                                <div
                                                    className="bg-blue-500 h-2 rounded-full"
                                                    style={{ width: `${progress.progress_percentage}% ` }}
                                                />
                                            </div>
                                            <span className="text-sm text-white w-12 text-right">
                                                {progress.progress_percentage.toFixed(0)}%
                                            </span>
                                            {progress.completed && (
                                                <CheckCircleIcon className="h-5 w-5 text-green-400" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-neutral-400 text-center py-8">No video progress recorded</p>
                    )}
                </Card>
            )}

            {activeTab === 'questions' && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Questions & Answers</h3>
                    {userData.questions && userData.questions.length > 0 ? (
                        <div className="space-y-4">
                            {userData.questions.map(question => (
                                <div key={question.id} className="p-4 bg-neutral-800 rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <h4 className="font-medium text-white">{question.title}</h4>
                                        <Badge
                                            variant={
                                                question.status === 'answered' ? 'success' :
                                                    question.status === 'pending' ? 'warning' :
                                                        'secondary'
                                            }
                                        >
                                            {question.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-neutral-400 mb-2">{question.content}</p>

                                    {/* Show answers if any */}
                                    {question.answers && question.answers.length > 0 && (
                                        <div className="mt-3 pl-4 border-l-2 border-blue-500">
                                            {question.answers.map(answer => (
                                                <div key={answer.id} className="mb-3 last:mb-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-medium text-blue-400">
                                                            {answer.admin_name}
                                                        </span>
                                                        {answer.is_official && (
                                                            <Badge variant="info" size="sm">Official</Badge>
                                                        )}
                                                        <span className="text-xs text-neutral-500">
                                                            {new Date(answer.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-neutral-300">{answer.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between text-xs text-neutral-500 mt-3">
                                        <span>Asked: {new Date(question.created_at).toLocaleDateString()}</span>
                                        <span>{question.upvotes} upvotes</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-neutral-400 text-center py-8">No questions asked yet</p>
                    )}
                </Card>
            )}

            {activeTab === 'support' && (
                <div className="space-y-6">
                    {/* Add New Support Note */}
                    {canAddSupportNotes && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Add Support Note</h3>
                            {isAddingNote ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-300 mb-1">
                                                Note Type
                                            </label>
                                            <select
                                                value={noteType}
                                                onChange={(e) => setNoteType(e.target.value as SupportNote['type'])}
                                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white"
                                            >
                                                <option value="note">General Note</option>
                                                <option value="warning">Warning</option>
                                                <option value="escalation">Escalation</option>
                                                <option value="resolution">Resolution</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 text-sm text-neutral-300">
                                                <input
                                                    type="checkbox"
                                                    checked={isInternal}
                                                    onChange={(e) => setIsInternal(e.target.checked)}
                                                    className="rounded border-neutral-600"
                                                />
                                                Internal Note (Admin only)
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-300 mb-1">
                                            Note Content
                                        </label>
                                        <textarea
                                            value={newNote}
                                            onChange={(e) => setNewNote(e.target.value)}
                                            placeholder="Enter support note..."
                                            rows={4}
                                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleAddSupportNote}
                                            disabled={!newNote.trim() || addSupportNoteMutation.isPending}
                                        >
                                            <PlusIcon className="h-4 w-4 mr-2" />
                                            {addSupportNoteMutation.isPending ? 'Adding...' : 'Add Note'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsAddingNote(false)
                                                setNewNote('')
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button onClick={() => setIsAddingNote(true)}>
                                    <PlusIcon className="h-4 w-4 mr-2" />
                                    Add Support Note
                                </Button>
                            )}
                        </Card>
                    )}

                    {/* Support Notes History */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Support Notes</h3>
                        {userData.supportNotes && userData.supportNotes.length > 0 ? (
                            <div className="space-y-4">
                                {userData.supportNotes.map(note => (
                                    <div key={note.id} className="p-4 bg-neutral-800 rounded-lg">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={
                                                        note.type === 'warning' ? 'error' :
                                                            note.type === 'escalation' ? 'warning' :
                                                                note.type === 'resolution' ? 'success' :
                                                                    'secondary'
                                                    }
                                                >
                                                    {note.type}
                                                </Badge>
                                                {note.is_internal && (
                                                    <Badge variant="info" size="sm">
                                                        <LockClosedIcon className="h-3 w-3 mr-1" />
                                                        Internal
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-xs text-neutral-500">
                                                {new Date(note.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-neutral-300 mb-2">{note.content}</p>
                                        <div className="flex items-center justify-between text-xs text-neutral-500">
                                            <span>By: {note.admin_name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-neutral-400 text-center py-8">No support notes recorded</p>
                        )}
                    </Card>
                </div>
            )}

            {activeTab === 'payments' && (
                <div className="space-y-6">
                    {/* Payment Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-neutral-400">Total Paid</p>
                                    <p className="text-xl font-bold text-green-400">
                                        ${userData.paymentHistory?.filter(p => p.status === 'succeeded')
                                            .reduce((sum, p) => sum + p.amount, 0).toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <BanknotesIcon className="h-8 w-8 text-green-400" />
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-neutral-400">Failed Payments</p>
                                    <p className="text-xl font-bold text-red-400">
                                        {userData.paymentHistory?.filter(p => p.status === 'failed').length || 0}
                                    </p>
                                </div>
                                <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-neutral-400">Refunds</p>
                                    <p className="text-xl font-bold text-yellow-400">
                                        ${userData.paymentHistory?.filter(p => p.status === 'refunded')
                                            .reduce((sum, p) => sum + p.amount, 0).toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <ArrowUpIcon className="h-8 w-8 text-yellow-400" />
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-neutral-400">Last Payment</p>
                                    <p className="text-sm font-medium text-white">
                                        {userData.paymentHistory?.[0] ?
                                            new Date(userData.paymentHistory[0].created_at).toLocaleDateString() :
                                            'Never'
                                        }
                                    </p>
                                </div>
                                <CalendarIcon className="h-8 w-8 text-neutral-400" />
                            </div>
                        </Card>
                    </div>

                    {/* Payment History */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Payment History</h3>
                        {userData.paymentHistory && userData.paymentHistory.length > 0 ? (
                            <div className="space-y-3">
                                {userData.paymentHistory.map(payment => (
                                    <div key={payment.id} className="flex items-center justify-between p-4 bg-neutral-800 rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className={`p - 2 rounded - full ${payment.status === 'succeeded' ? 'bg-green-500/20 text-green-400' :
                                                payment.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                                    payment.status === 'refunded' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                                } `}>
                                                <BanknotesIcon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">
                                                    ${payment.amount} {payment.currency.toUpperCase()}
                                                </p>
                                                <p className="text-sm text-neutral-400">
                                                    {payment.description || payment.payment_method}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge
                                                variant={
                                                    payment.status === 'succeeded' ? 'success' :
                                                        payment.status === 'failed' ? 'error' :
                                                            payment.status === 'refunded' ? 'warning' :
                                                                'secondary'
                                                }
                                            >
                                                {payment.status}
                                            </Badge>
                                            <p className="text-xs text-neutral-500 mt-1">
                                                {new Date(payment.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-neutral-400 text-center py-8">No payment history</p>
                        )}
                    </Card>
                </div>
            )}
        </div>
    )
} 