/**
 * Evolution Combatives - Q&A Management Dashboard
 * Comprehensive question and answer management for tactical training platform
 * 
 * @description Admin dashboard for managing user questions and providing expert answers
 * @author Evolution Combatives
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../src/hooks/useAuth'
import { Card } from '../../src/components/ui/card'
import { Button } from '../../src/components/ui/button'
import { Input } from '../../src/components/ui/input'
import { Badge } from '../../src/components/ui/badge'
import { Avatar } from '../../src/components/ui/avatar'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../src/components/ui/table'
import { LoadingOverlay } from '../../src/components/ui/loading'
import { createClientComponentClient } from '../../src/lib/supabase-browser'
import { queryKeys } from '../../src/lib/query-client'

// Icons
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    ChatBubbleLeftIcon,
    ClockIcon,
    CheckCircleIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    EyeIcon,
    PencilIcon,
    XMarkIcon,
    StarIcon,
    TagIcon,
    VideoCameraIcon,
    CreditCardIcon
} from '@heroicons/react/24/outline'

// TypeScript interfaces
interface QuestionWithRelations {
    id: string
    title: string
    content: string
    status: 'pending' | 'answered' | 'closed'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    category: string
    video_id?: string
    video_timestamp?: number
    upvotes: number
    created_at: string
    updated_at: string
    user_id: string
    user?: {
        id: string
        full_name: string
        email: string
        avatar_url?: string
        subscription_tier?: 'beginner' | 'intermediate' | 'advanced' | null
        admin_role?: string
    }
    video?: {
        id: string
        title: string
        thumbnail_url?: string
        duration: number
        category?: {
            name: string
            discipline?: {
                name: string
            }
        }
    }
    answers?: Answer[]
    tags?: string[]
}

interface Answer {
    id: string
    content: string
    is_official: boolean
    upvotes: number
    created_at: string
    admin_id: string
    admin?: {
        full_name: string
        email: string
        avatar_url?: string
    }
}

interface QAFilters {
    search: string
    status: string[]
    priority: string[]
    category: string[]
    userTier: string[]
    videoId?: string
    dateRange: {
        start?: string
        end?: string
    }
    hasAnswers: 'all' | 'answered' | 'unanswered'
    sortBy: 'created_at' | 'updated_at' | 'priority' | 'upvotes'
    sortOrder: 'asc' | 'desc'
}

interface QAStats {
    totalQuestions: number
    pendingQuestions: number
    answeredQuestions: number
    avgResponseTime: number
    topCategories: { name: string; count: number }[]
    questionsGrowth: number
}

interface BulkAction {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    action: (questionIds: string[]) => void
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'warning'
    requiresConfirmation?: boolean
}

export default function QAManagementPage() {
    const router = useRouter()
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()
    const supabase = createClientComponentClient()

    // State
    const [filters, setFilters] = useState<QAFilters>({
        search: '',
        status: [],
        priority: [],
        category: [],
        userTier: [],
        dateRange: {},
        hasAnswers: 'all',
        sortBy: 'created_at',
        sortOrder: 'desc'
    })
    const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
    const [showFilters, setShowFilters] = useState(false)
    const [bulkActionLoading, setBulkActionLoading] = useState(false)
    const [answerModalOpen, setAnswerModalOpen] = useState(false)
    const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithRelations | null>(null)
    const [newAnswer, setNewAnswer] = useState('')

    // Check permissions
    const canAnswerQuestions = hasPermission('qa.write')
    const canViewAnalytics = hasPermission('analytics.read')

    // Fetch Q&A statistics
    const qaStatsQuery = useQuery({
        queryKey: [...queryKeys.all, 'qa', 'stats'],
        queryFn: async (): Promise<QAStats> => {
            const [questionsResult, categoriesResult] = await Promise.all([
                supabase
                    .from('questions')
                    .select('id, status, created_at, category')
                    .order('created_at', { ascending: false }),

                supabase
                    .from('questions')
                    .select('category')
                    .not('category', 'is', null)
            ])

            if (questionsResult.error) throw questionsResult.error
            if (categoriesResult.error) throw categoriesResult.error

            const questions = questionsResult.data || []
            const categories = categoriesResult.data || []

            const now = new Date()
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

            // Calculate metrics
            const totalQuestions = questions.length
            const pendingQuestions = questions.filter(q => q.status === 'pending').length
            const answeredQuestions = questions.filter(q => q.status === 'answered').length
            const recentQuestions = questions.filter(q =>
                new Date(q.created_at) >= sevenDaysAgo
            ).length
            const previousWeekQuestions = questions.filter(q => {
                const createdAt = new Date(q.created_at)
                return createdAt >= new Date(sevenDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000) &&
                    createdAt < sevenDaysAgo
            }).length

            const questionsGrowth = previousWeekQuestions > 0 ?
                ((recentQuestions - previousWeekQuestions) / previousWeekQuestions) * 100 : 0

            // Top categories
            const categoryCount = categories.reduce((acc, item) => {
                acc[item.category] = (acc[item.category] || 0) + 1
                return acc
            }, {} as Record<string, number>)

            const topCategories = Object.entries(categoryCount)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)

            return {
                totalQuestions,
                pendingQuestions,
                answeredQuestions,
                avgResponseTime: 24, // Would calculate from actual data
                topCategories,
                questionsGrowth
            }
        },
        enabled: !!user && !!profile?.admin_role
    })

    // Fetch questions with relations
    const questionsQuery = useQuery({
        queryKey: [...queryKeys.all, 'qa', 'list', filters],
        queryFn: async (): Promise<QuestionWithRelations[]> => {
            let query = supabase
                .from('questions')
                .select(`
                    *,
                    user:profiles!questions_user_id_fkey(
                        id,
                        full_name,
                        email,
                        avatar_url,
                        subscriptions(tier, status)
                    ),
                    video:videos(
                        id,
                        title,
                        thumbnail_url,
                        duration,
                        category(
                            name,
                            discipline(name)
                        )
                    ),
                    answers(
                        *,
                        admin:profiles!answers_admin_id_fkey(
                            full_name,
                            email,
                            avatar_url
                        )
                    )
                `)

            // Apply filters
            if (filters.status.length > 0) {
                query = query.in('status', filters.status)
            }

            if (filters.priority.length > 0) {
                query = query.in('priority', filters.priority)
            }

            if (filters.category.length > 0) {
                query = query.in('category', filters.category)
            }

            if (filters.videoId) {
                query = query.eq('video_id', filters.videoId)
            }

            if (filters.dateRange.start) {
                query = query.gte('created_at', filters.dateRange.start)
            }

            if (filters.dateRange.end) {
                query = query.lte('created_at', filters.dateRange.end)
            }

            // Apply sorting
            query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })

            const { data, error } = await query.limit(100)

            if (error) throw error

            // Process and filter data
            let questions = (data || []).map(question => ({
                ...question,
                user: question.user ? {
                    ...question.user,
                    subscription_tier: question.user.subscriptions?.[0]?.tier || null
                } : undefined
            }))

            // Apply client-side filters
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                questions = questions.filter(q =>
                    q.title.toLowerCase().includes(searchLower) ||
                    q.content.toLowerCase().includes(searchLower) ||
                    q.user?.full_name?.toLowerCase().includes(searchLower) ||
                    q.user?.email.toLowerCase().includes(searchLower)
                )
            }

            if (filters.userTier.length > 0) {
                questions = questions.filter(q =>
                    filters.userTier.includes(q.user?.subscription_tier || 'none')
                )
            }

            if (filters.hasAnswers !== 'all') {
                questions = questions.filter(q => {
                    const hasAnswers = q.answers && q.answers.length > 0
                    return filters.hasAnswers === 'answered' ? hasAnswers : !hasAnswers
                })
            }

            return questions
        },
        enabled: !!user && !!profile?.admin_role
    })

    // Answer question mutation
    const answerQuestionMutation = useMutation({
        mutationFn: async ({ questionId, content, isOfficial }: {
            questionId: string
            content: string
            isOfficial: boolean
        }) => {
            const { data, error } = await supabase
                .from('answers')
                .insert({
                    question_id: questionId,
                    content,
                    admin_id: user!.id,
                    is_official: isOfficial
                })
                .select()
                .single()

            if (error) throw error

            // Update question status to answered
            await supabase
                .from('questions')
                .update({
                    status: 'answered',
                    updated_at: new Date().toISOString()
                })
                .eq('id', questionId)

            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...queryKeys.all, 'qa', 'list'] })
            queryClient.invalidateQueries({ queryKey: [...queryKeys.all, 'qa', 'stats'] })
            setAnswerModalOpen(false)
            setNewAnswer('')
            setSelectedQuestion(null)
            toast.success('Answer posted successfully')
        },
        onError: (error: Error) => {
            toast.error('Failed to post answer', {
                description: error.message
            })
        }
    })

    // Update question status mutation
    const updateQuestionMutation = useMutation({
        mutationFn: async ({ questionIds, updates }: {
            questionIds: string[]
            updates: Partial<QuestionWithRelations>
        }) => {
            const { error } = await supabase
                .from('questions')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .in('id', questionIds)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...queryKeys.all, 'qa', 'list'] })
            queryClient.invalidateQueries({ queryKey: [...queryKeys.all, 'qa', 'stats'] })
            setSelectedQuestions(new Set())
            toast.success('Questions updated successfully')
        },
        onError: (error: Error) => {
            toast.error('Failed to update questions', {
                description: error.message
            })
        }
    })

    const questions = questionsQuery.data || []
    const stats = qaStatsQuery.data

    // Filter options
    const statusOptions = [
        { value: 'pending', label: 'Pending', color: 'warning' },
        { value: 'answered', label: 'Answered', color: 'success' },
        { value: 'closed', label: 'Closed', color: 'secondary' }
    ]

    const priorityOptions = [
        { value: 'low', label: 'Low', color: 'secondary' },
        { value: 'medium', label: 'Medium', color: 'info' },
        { value: 'high', label: 'High', color: 'warning' },
        { value: 'urgent', label: 'Urgent', color: 'error' }
    ]

    const tierOptions = [
        { value: 'beginner', label: 'Beginner', color: 'info' },
        { value: 'intermediate', label: 'Intermediate', color: 'warning' },
        { value: 'advanced', label: 'Advanced', color: 'success' },
        { value: 'none', label: 'None', color: 'secondary' }
    ]

    // Bulk actions
    const bulkActions: BulkAction[] = [
        {
            id: 'mark_answered',
            label: 'Mark as Answered',
            icon: CheckCircleIcon,
            action: (questionIds) => updateQuestionMutation.mutate({
                questionIds,
                updates: { status: 'answered' }
            })
        },
        {
            id: 'mark_pending',
            label: 'Mark as Pending',
            icon: ClockIcon,
            action: (questionIds) => updateQuestionMutation.mutate({
                questionIds,
                updates: { status: 'pending' }
            })
        },
        {
            id: 'set_high_priority',
            label: 'Set High Priority',
            icon: ArrowUpIcon,
            action: (questionIds) => updateQuestionMutation.mutate({
                questionIds,
                updates: { priority: 'high' }
            })
        },
        {
            id: 'close_questions',
            label: 'Close Questions',
            icon: XMarkIcon,
            action: (questionIds) => updateQuestionMutation.mutate({
                questionIds,
                updates: { status: 'closed' }
            }),
            variant: 'destructive',
            requiresConfirmation: true
        }
    ]

    // Handle bulk action
    const handleBulkAction = async (action: BulkAction) => {
        if (selectedQuestions.size === 0) {
            toast.error('Please select questions first')
            return
        }

        if (action.requiresConfirmation) {
            const confirmed = confirm(`Are you sure you want to ${action.label.toLowerCase()} ${selectedQuestions.size} question(s)?`)
            if (!confirmed) return
        }

        setBulkActionLoading(true)
        try {
            action.action(Array.from(selectedQuestions))
        } finally {
            setBulkActionLoading(false)
        }
    }

    // Handle question selection
    const handleSelectQuestion = (questionId: string, selected: boolean) => {
        const newSelected = new Set(selectedQuestions)
        if (selected) {
            newSelected.add(questionId)
        } else {
            newSelected.delete(questionId)
        }
        setSelectedQuestions(newSelected)
    }

    const handleSelectAll = (selected: boolean) => {
        if (selected) {
            setSelectedQuestions(new Set(questions.map(q => q.id)))
        } else {
            setSelectedQuestions(new Set())
        }
    }

    // Handle answer question
    const handleAnswerQuestion = (question: QuestionWithRelations) => {
        setSelectedQuestion(question)
        setAnswerModalOpen(true)
    }

    const handleSubmitAnswer = () => {
        if (!selectedQuestion || !newAnswer.trim()) return

        answerQuestionMutation.mutate({
            questionId: selectedQuestion.id,
            content: newAnswer.trim(),
            isOfficial: true
        })
    }

    // Clear filters
    const clearFilters = () => {
        setFilters({
            search: '',
            status: [],
            priority: [],
            category: [],
            userTier: [],
            dateRange: {},
            hasAnswers: 'all',
            sortBy: 'created_at',
            sortOrder: 'desc'
        })
    }

    // Format timestamp for video
    const formatTimestamp = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    if (authLoading || !user || !profile?.admin_role) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingOverlay isVisible={true} />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Q&A Management</h1>
                    <p className="text-neutral-400 mt-1">
                        Manage user questions and provide expert answers
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2"
                    >
                        <FunnelIcon className="h-4 w-4" />
                        Filters
                    </Button>
                    {canViewAnalytics && (
                        <Button
                            variant="outline"
                            onClick={() => router.push('/dashboard/analytics/qa')}
                        >
                            View Analytics
                        </Button>
                    )}
                </div>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-neutral-400">Total Questions</p>
                                <p className="text-2xl font-bold text-white">{stats.totalQuestions}</p>
                                <p className={`text-sm ${stats.questionsGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {stats.questionsGrowth >= 0 ? '+' : ''}{stats.questionsGrowth.toFixed(1)}% this week
                                </p>
                            </div>
                            <ChatBubbleLeftIcon className="h-8 w-8 text-neutral-400" />
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-neutral-400">Pending Questions</p>
                                <p className="text-2xl font-bold text-yellow-400">{stats.pendingQuestions}</p>
                                <p className="text-sm text-neutral-400">Need attention</p>
                            </div>
                            <ClockIcon className="h-8 w-8 text-yellow-400" />
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-neutral-400">Answered Questions</p>
                                <p className="text-2xl font-bold text-green-400">{stats.answeredQuestions}</p>
                                <p className="text-sm text-neutral-400">
                                    {stats.totalQuestions > 0 ?
                                        Math.round((stats.answeredQuestions / stats.totalQuestions) * 100) : 0}% response rate
                                </p>
                            </div>
                            <CheckCircleIcon className="h-8 w-8 text-green-400" />
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-neutral-400">Avg Response Time</p>
                                <p className="text-2xl font-bold text-blue-400">{stats.avgResponseTime}h</p>
                                <p className="text-sm text-neutral-400">Target: &lt;24h</p>
                            </div>
                            <StarIcon className="h-8 w-8 text-blue-400" />
                        </div>
                    </Card>
                </div>
            )}

            {/* Search and Filters */}
            <Card className="p-6">
                <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <Input
                                placeholder="Search questions, answers, or users..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="pl-10"
                            />
                        </div>
                        <select
                            value={filters.sortBy}
                            onChange={(e) => setFilters(prev => ({
                                ...prev,
                                sortBy: e.target.value as QAFilters['sortBy']
                            }))}
                            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white"
                        >
                            <option value="created_at">Sort by Date</option>
                            <option value="priority">Sort by Priority</option>
                            <option value="upvotes">Sort by Upvotes</option>
                            <option value="updated_at">Sort by Last Updated</option>
                        </select>
                        <Button
                            variant="outline"
                            onClick={() => setFilters(prev => ({
                                ...prev,
                                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
                            }))}
                        >
                            {filters.sortOrder === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* Filter Pills */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-neutral-800 rounded-lg">
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Status</label>
                                <div className="space-y-1">
                                    {statusOptions.map(option => (
                                        <label key={option.value} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={filters.status.includes(option.value)}
                                                onChange={(e) => {
                                                    const newStatus = e.target.checked
                                                        ? [...filters.status, option.value]
                                                        : filters.status.filter(s => s !== option.value)
                                                    setFilters(prev => ({ ...prev, status: newStatus }))
                                                }}
                                                className="rounded border-neutral-600"
                                            />
                                            <span className="text-sm text-neutral-300">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Priority</label>
                                <div className="space-y-1">
                                    {priorityOptions.map(option => (
                                        <label key={option.value} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={filters.priority.includes(option.value)}
                                                onChange={(e) => {
                                                    const newPriority = e.target.checked
                                                        ? [...filters.priority, option.value]
                                                        : filters.priority.filter(p => p !== option.value)
                                                    setFilters(prev => ({ ...prev, priority: newPriority }))
                                                }}
                                                className="rounded border-neutral-600"
                                            />
                                            <span className="text-sm text-neutral-300">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">User Tier</label>
                                <div className="space-y-1">
                                    {tierOptions.map(option => (
                                        <label key={option.value} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={filters.userTier.includes(option.value)}
                                                onChange={(e) => {
                                                    const newTier = e.target.checked
                                                        ? [...filters.userTier, option.value]
                                                        : filters.userTier.filter(t => t !== option.value)
                                                    setFilters(prev => ({ ...prev, userTier: newTier }))
                                                }}
                                                className="rounded border-neutral-600"
                                            />
                                            <span className="text-sm text-neutral-300">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Answer Status</label>
                                <select
                                    value={filters.hasAnswers}
                                    onChange={(e) => setFilters(prev => ({
                                        ...prev,
                                        hasAnswers: e.target.value as QAFilters['hasAnswers']
                                    }))}
                                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white"
                                >
                                    <option value="all">All Questions</option>
                                    <option value="answered">Answered Only</option>
                                    <option value="unanswered">Unanswered Only</option>
                                </select>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="w-full mt-2"
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Bulk Actions */}
            {selectedQuestions.size > 0 && (
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">
                            {selectedQuestions.size} question(s) selected
                        </span>
                        <div className="flex items-center gap-2">
                            {bulkActions.map(action => (
                                <Button
                                    key={action.id}
                                    variant={action.variant || 'outline'}
                                    size="sm"
                                    onClick={() => handleBulkAction(action)}
                                    disabled={bulkActionLoading || updateQuestionMutation.isPending}
                                    className="flex items-center gap-1"
                                >
                                    <action.icon className="h-3 w-3" />
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </Card>
            )}

            {/* Questions Table */}
            <Card className="overflow-hidden">
                {questionsQuery.isLoading ? (
                    <div className="p-8">
                        <LoadingOverlay isVisible={true} />
                    </div>
                ) : questions.length === 0 ? (
                    <div className="p-8 text-center">
                        <ChatBubbleLeftIcon className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">No questions found</h3>
                        <p className="text-neutral-400">Try adjusting your filters or search terms.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedQuestions.size === questions.length && questions.length > 0}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded border-neutral-600"
                                    />
                                </TableHead>
                                <TableHead>Question</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Video Context</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Answers</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {questions.map(question => (
                                <TableRow key={question.id}>
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            checked={selectedQuestions.has(question.id)}
                                            onChange={(e) => handleSelectQuestion(question.id, e.target.checked)}
                                            className="rounded border-neutral-600"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-md">
                                            <h4 className="font-medium text-white mb-1">{question.title}</h4>
                                            <p className="text-sm text-neutral-400 line-clamp-2">
                                                {question.content}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Badge variant="secondary" size="sm">
                                                    <TagIcon className="h-3 w-3 mr-1" />
                                                    {question.category}
                                                </Badge>
                                                {question.upvotes > 0 && (
                                                    <Badge variant="info" size="sm">
                                                        <ArrowUpIcon className="h-3 w-3 mr-1" />
                                                        {question.upvotes}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                src={question.user?.avatar_url}
                                                alt={question.user?.full_name || 'User'}
                                                size="sm"
                                            />
                                            <div>
                                                <p className="font-medium text-white text-sm">
                                                    {question.user?.full_name || 'Unknown User'}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <Badge
                                                        variant={
                                                            question.user?.subscription_tier === 'advanced' ? 'success' :
                                                                question.user?.subscription_tier === 'intermediate' ? 'warning' :
                                                                    question.user?.subscription_tier === 'beginner' ? 'info' :
                                                                        'secondary'
                                                        }
                                                        size="sm"
                                                    >
                                                        <CreditCardIcon className="h-3 w-3 mr-1" />
                                                        {question.user?.subscription_tier || 'None'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {question.video ? (
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Image
                                                        src={question.video.thumbnail_url || '/placeholder-video.jpg'}
                                                        alt={question.video.title}
                                                        width={64}
                                                        height={36}
                                                        className="w-16 h-9 object-cover rounded"
                                                    />
                                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded">
                                                        <VideoCameraIcon className="h-4 w-4 text-white" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white text-sm">
                                                        {question.video.title}
                                                    </p>
                                                    {question.video_timestamp && (
                                                        <p className="text-xs text-blue-400">
                                                            @ {formatTimestamp(question.video_timestamp)}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-neutral-400">
                                                        {question.video.category?.discipline?.name} • {question.video.category?.name}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-neutral-400 text-sm">No video context</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                question.status === 'answered' ? 'success' :
                                                    question.status === 'pending' ? 'warning' :
                                                        'secondary'
                                            }
                                        >
                                            {question.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                question.priority === 'urgent' ? 'error' :
                                                    question.priority === 'high' ? 'warning' :
                                                        question.priority === 'medium' ? 'info' :
                                                            'secondary'
                                            }
                                        >
                                            {question.priority}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <span className="text-white">{question.answers?.length || 0}</span>
                                            {question.answers && question.answers.some(a => a.is_official) && (
                                                <CheckCircleIcon className="h-4 w-4 text-green-400" />
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            <p className="text-white">
                                                {new Date(question.created_at).toLocaleDateString()}
                                            </p>
                                            <p className="text-neutral-400">
                                                {new Date(question.created_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => router.push(`/dashboard/qa/${question.id}`)}
                                            >
                                                <EyeIcon className="h-4 w-4" />
                                            </Button>
                                            {canAnswerQuestions && question.status === 'pending' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleAnswerQuestion(question)}
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            {/* Answer Modal */}
            {answerModalOpen && selectedQuestion && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-2xl m-4 max-h-[80vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Answer Question</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setAnswerModalOpen(false)}
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-neutral-800 rounded-lg">
                                    <h4 className="font-medium text-white mb-2">{selectedQuestion.title}</h4>
                                    <p className="text-neutral-300 text-sm">{selectedQuestion.content}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                                        Your Answer
                                    </label>
                                    <textarea
                                        value={newAnswer}
                                        onChange={(e) => setNewAnswer(e.target.value)}
                                        placeholder="Provide a detailed answer to help the user..."
                                        rows={6}
                                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white resize-none"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setAnswerModalOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSubmitAnswer}
                                        disabled={!newAnswer.trim() || answerQuestionMutation.isPending}
                                    >
                                        {answerQuestionMutation.isPending ? 'Posting...' : 'Post Answer'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
} 