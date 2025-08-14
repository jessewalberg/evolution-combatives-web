/**
 * Evolution Combatives - Question Detail & Answer Interface
 * Comprehensive question management with video context and rich answer tools
 * 
 * @description Admin interface for detailed question review and expert answer creation
 * @author Evolution Combatives
 */

'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../src/hooks/useAuth'
import { Card } from '../../../src/components/ui/card'
import { Button } from '../../../src/components/ui/button'
import { Badge } from '../../../src/components/ui/badge'
import { Avatar } from '../../../src/components/ui/avatar'
import { LoadingOverlay } from '../../../src/components/ui/loading'
import { createClientComponentClient } from '../../../src/lib/supabase-browser'
import { queryKeys } from '../../../src/lib/query-client'

// Icons
import {
    ArrowLeftIcon,
    ClockIcon,
    TagIcon,
    VideoCameraIcon,
    CreditCardIcon,
    PaperAirplaneIcon,
    DocumentTextIcon,
    ChartBarIcon,
    UserIcon,
    CalendarIcon,
    EyeIcon,
    ArrowUpIcon,
    BookmarkIcon,
    ChatBubbleLeftIcon
} from '@heroicons/react/24/outline'

// TypeScript interfaces
interface QuestionDetail {
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
    tags?: string[]
    user: {
        id: string
        full_name: string
        email: string
        avatar_url?: string
        subscription_tier?: 'beginner' | 'intermediate' | 'advanced' | null
        created_at: string
        last_sign_in_at?: string
    }
    video?: {
        id: string
        title: string
        description?: string
        thumbnail_url?: string
        stream_url?: string
        duration: number
        category: {
            name: string
            discipline: {
                name: string
            }
        }
    }
    answers: Answer[]
}

interface Answer {
    id: string
    content: string
    is_official: boolean
    upvotes: number
    created_at: string
    updated_at: string
    admin_id: string
    admin: {
        full_name: string
        email: string
        avatar_url?: string
    }
}

interface RelatedQuestion {
    id: string
    title: string
    status: string
    created_at: string
    answers_count: number
}

interface AnswerTemplate {
    id: string
    title: string
    content: string
    category: string
    usage_count: number
}



export default function QuestionDetailPage() {
    const router = useRouter()
    const params = useParams()
    const questionId = params.id as string
    const { user, profile, hasPermission, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()
    const supabase = createClientComponentClient()

    // State
    const [answerContent, setAnswerContent] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState<AnswerTemplate | null>(null)
    const [showTemplates, setShowTemplates] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [startTime] = useState(new Date())
    const [, setVideoCurrentTime] = useState(0)
    const [showRelated, setShowRelated] = useState(false)
    const [notificationSettings, setNotificationSettings] = useState({
        email: true,
        push: true
    })

    // Check permissions
    const canAnswerQuestions = hasPermission('qa.write')
    const canViewMetrics = hasPermission('analytics.read')

    // Fetch question details
    const questionQuery = useQuery({
        queryKey: [...queryKeys.all, 'qa', 'detail', questionId],
        queryFn: async (): Promise<QuestionDetail> => {
            const { data, error } = await supabase
                .from('questions')
                .select(`
                    *,
                    user:profiles!questions_user_id_fkey(
                        id,
                        full_name,
                        email,
                        avatar_url,
                        created_at,
                        last_sign_in_at,
                        subscriptions(tier, status, created_at)
                    ),
                    video:videos(
                        id,
                        title,
                        description,
                        thumbnail_url,
                        stream_url,
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
                .eq('id', questionId)
                .single()

            if (error) throw error

            // Process subscription data
            const processedData = {
                ...data,
                user: {
                    ...data.user,
                    subscription_tier: data.user.subscriptions?.[0]?.tier || null
                }
            }

            return processedData
        },
        enabled: !!questionId && !!user && !!profile?.admin_role
    })

    // Fetch related questions from same user
    const relatedQuestionsQuery = useQuery({
        queryKey: [...queryKeys.all, 'qa', 'related', questionId],
        queryFn: async (): Promise<RelatedQuestion[]> => {
            if (!questionQuery.data?.user_id) return []

            const { data, error } = await supabase
                .from('questions')
                .select(`
                    id,
                    title,
                    status,
                    created_at,
                    answers(count)
                `)
                .eq('user_id', questionQuery.data.user_id)
                .neq('id', questionId)
                .order('created_at', { ascending: false })
                .limit(5)

            if (error) throw error

            return data.map(q => ({
                ...q,
                answers_count: q.answers?.[0]?.count || 0
            }))
        },
        enabled: !!questionQuery.data?.user_id && showRelated
    })

    // Fetch answer templates
    const templatesQuery = useQuery({
        queryKey: [...queryKeys.all, 'qa', 'templates'],
        queryFn: async (): Promise<AnswerTemplate[]> => {
            const { data, error } = await supabase
                .from('answer_templates')
                .select('*')
                .order('usage_count', { ascending: false })

            if (error) {
                console.warn('Answer templates not available:', error)
                return []
            }

            return data || []
        },
        enabled: showTemplates && !!user && !!profile?.admin_role
    })

    // Submit answer mutation
    const submitAnswerMutation = useMutation({
        mutationFn: async ({
            content,
            templateId
        }: {
            content: string
            templateId?: string
        }) => {
            setIsSubmitting(true)

            // Calculate response time
            const responseTime = Math.round((new Date().getTime() - startTime.getTime()) / 60000)

            // Insert answer
            const { data: answer, error: answerError } = await supabase
                .from('answers')
                .insert({
                    question_id: questionId,
                    content,
                    admin_id: user!.id,
                    is_official: true
                })
                .select()
                .single()

            if (answerError) throw answerError

            // Update question status
            await supabase
                .from('questions')
                .update({
                    status: 'answered',
                    updated_at: new Date().toISOString()
                })
                .eq('id', questionId)

            // Track response metrics
            if (canViewMetrics) {
                await supabase
                    .from('response_metrics')
                    .insert({
                        response_time_minutes: responseTime,
                        admin_id: user!.id,
                        question_id: questionId,
                        template_used: templateId
                    })
                    .select()
            }

            // Update template usage count
            if (templateId) {
                const { data: template } = await supabase
                    .from('answer_templates')
                    .select('usage_count')
                    .eq('id', templateId)
                    .single()

                if (template) {
                    await supabase
                        .from('answer_templates')
                        .update({
                            usage_count: template.usage_count + 1
                        })
                        .eq('id', templateId)
                }
            }

            // Send notifications
            if (notificationSettings.email || notificationSettings.push) {
                await supabase.functions.invoke('send-answer-notification', {
                    body: {
                        questionId,
                        answerId: answer.id,
                        userId: questionQuery.data?.user_id,
                        sendEmail: notificationSettings.email,
                        sendPush: notificationSettings.push
                    }
                })
            }

            return answer
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...queryKeys.all, 'qa'] })
            setAnswerContent('')
            setSelectedTemplate(null)
            toast.success('Answer posted successfully')
        },
        onError: (error: Error) => {
            toast.error('Failed to post answer', {
                description: error.message
            })
        },
        onSettled: () => {
            setIsSubmitting(false)
        }
    })

    // Handle template selection
    const handleTemplateSelect = (template: AnswerTemplate) => {
        setSelectedTemplate(template)
        setAnswerContent(template.content)
        setShowTemplates(false)
    }

    // Handle answer submission
    const handleSubmitAnswer = () => {
        if (!answerContent.trim()) {
            toast.error('Please enter an answer')
            return
        }

        submitAnswerMutation.mutate({
            content: answerContent.trim(),
            templateId: selectedTemplate?.id
        })
    }

    // Format timestamp for video
    const formatTimestamp = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // Get priority color
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'error'
            case 'high': return 'warning'
            case 'medium': return 'info'
            default: return 'secondary'
        }
    }

    // Get status color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'answered': return 'success'
            case 'pending': return 'warning'
            default: return 'secondary'
        }
    }

    const question = questionQuery.data

    if (authLoading || !user || !profile?.admin_role) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingOverlay isVisible={true} />
            </div>
        )
    }

    if (questionQuery.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingOverlay isVisible={true} message="Loading question details..." />
            </div>
        )
    }

    if (!question) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-white mb-2">Question not found</h2>
                    <p className="text-neutral-400 mb-4">The question you&apos;re looking for doesn&apos;t exist.</p>
                    <Button onClick={() => router.push('/qa')} variant="outline">
                        Back to Q&A
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/qa')}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to Q&A
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Question Details</h1>
                        <p className="text-neutral-400 mt-1">
                            Review and respond to user question
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={getPriorityColor(question.priority)}>
                        {question.priority} priority
                    </Badge>
                    <Badge variant={getStatusColor(question.status)}>
                        {question.status}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Question Details */}
                    <Card className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h2 className="text-xl font-semibold text-white mb-2">
                                        {question.title}
                                    </h2>
                                    <div className="flex items-center gap-4 text-sm text-neutral-400 mb-4">
                                        <div className="flex items-center gap-1">
                                            <CalendarIcon className="h-4 w-4" />
                                            {new Date(question.created_at).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <ClockIcon className="h-4 w-4" />
                                            {new Date(question.created_at).toLocaleTimeString()}
                                        </div>
                                        {question.upvotes > 0 && (
                                            <div className="flex items-center gap-1">
                                                <ArrowUpIcon className="h-4 w-4" />
                                                {question.upvotes} upvotes
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="prose prose-invert max-w-none">
                                <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
                                    {question.content}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                    <TagIcon className="h-3 w-3 mr-1" />
                                    {question.category}
                                </Badge>
                                {question.tags?.map(tag => (
                                    <Badge key={tag} variant="secondary" size="sm">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* Video Context */}
                    {question.video && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <VideoCameraIcon className="h-5 w-5" />
                                Video Context
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="aspect-video bg-neutral-800 rounded-lg overflow-hidden">
                                        {question.video.stream_url ? (
                                            <video
                                                src={question.video.stream_url}
                                                poster={question.video.thumbnail_url}
                                                controls
                                                className="w-full h-full object-cover"
                                                onTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime)}
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="text-center">
                                                    <VideoCameraIcon className="h-12 w-12 text-neutral-400 mx-auto mb-2" />
                                                    <p className="text-neutral-400">Video processing...</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {question.video_timestamp && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const video = document.querySelector('video')
                                                    if (video) video.currentTime = question.video_timestamp!
                                                }}
                                            >
                                                Jump to {formatTimestamp(question.video_timestamp)}
                                            </Button>
                                            <span className="text-neutral-400">
                                                Question timestamp
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="font-medium text-white mb-2">{question.video.title}</h4>
                                        {question.video.description && (
                                            <p className="text-sm text-neutral-400 mb-3">
                                                {question.video.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                                            <span>{question.video.category.discipline.name}</span>
                                            <span>•</span>
                                            <span>{question.video.category.name}</span>
                                            <span>•</span>
                                            <span>{formatTimestamp(question.video.duration)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Existing Answers */}
                    {question.answers.length > 0 && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <ChatBubbleLeftIcon className="h-5 w-5" />
                                Previous Answers ({question.answers.length})
                            </h3>
                            <div className="space-y-4">
                                {question.answers.map(answer => (
                                    <div key={answer.id} className="border border-neutral-700 rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar
                                                    src={answer.admin.avatar_url}
                                                    alt={answer.admin.full_name}
                                                    size="sm"
                                                />
                                                <div>
                                                    <p className="font-medium text-white text-sm">
                                                        {answer.admin.full_name}
                                                    </p>
                                                    <p className="text-xs text-neutral-400">
                                                        {new Date(answer.created_at).toLocaleDateString()} at{' '}
                                                        {new Date(answer.created_at).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                            {answer.is_official && (
                                                <Badge variant="success" size="sm">
                                                    Official
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <p className="text-neutral-300 whitespace-pre-wrap">
                                                {answer.content}
                                            </p>
                                        </div>
                                        {answer.upvotes > 0 && (
                                            <div className="flex items-center gap-1 mt-3 text-sm text-neutral-400">
                                                <ArrowUpIcon className="h-4 w-4" />
                                                {answer.upvotes} upvotes
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Answer Form */}
                    {canAnswerQuestions && question.status !== 'closed' && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <PaperAirplaneIcon className="h-5 w-5" />
                                Post Answer
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowTemplates(!showTemplates)}
                                        className="flex items-center gap-2"
                                    >
                                        <DocumentTextIcon className="h-4 w-4" />
                                        Templates
                                    </Button>
                                    {selectedTemplate && (
                                        <Badge variant="info" className="flex items-center gap-1">
                                            <BookmarkIcon className="h-3 w-3" />
                                            Using: {selectedTemplate.title}
                                        </Badge>
                                    )}
                                </div>

                                {showTemplates && templatesQuery.data && (
                                    <div className="border border-neutral-700 rounded-lg p-4 bg-neutral-800">
                                        <h4 className="font-medium text-white mb-3">Answer Templates</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {templatesQuery.data.map(template => (
                                                <button
                                                    key={template.id}
                                                    onClick={() => handleTemplateSelect(template)}
                                                    className="text-left p-3 border border-neutral-600 rounded-lg hover:border-primary-500 transition-colors"
                                                >
                                                    <h5 className="font-medium text-white text-sm mb-1">
                                                        {template.title}
                                                    </h5>
                                                    <p className="text-xs text-neutral-400 line-clamp-2">
                                                        {template.content}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Badge variant="secondary" size="sm">
                                                            {template.category}
                                                        </Badge>
                                                        <span className="text-xs text-neutral-500">
                                                            Used {template.usage_count} times
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                                        Your Answer
                                    </label>
                                    <textarea
                                        value={answerContent}
                                        onChange={(e) => setAnswerContent(e.target.value)}
                                        placeholder="Provide a detailed, helpful answer..."
                                        rows={8}
                                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="email-notification"
                                                checked={notificationSettings.email}
                                                onChange={(e) => setNotificationSettings(prev => ({
                                                    ...prev,
                                                    email: e.target.checked
                                                }))}
                                                className="rounded border-neutral-600"
                                            />
                                            <label htmlFor="email-notification" className="text-sm text-neutral-300">
                                                Send email notification
                                            </label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="push-notification"
                                                checked={notificationSettings.push}
                                                onChange={(e) => setNotificationSettings(prev => ({
                                                    ...prev,
                                                    push: e.target.checked
                                                }))}
                                                className="rounded border-neutral-600"
                                            />
                                            <label htmlFor="push-notification" className="text-sm text-neutral-300">
                                                Send push notification
                                            </label>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleSubmitAnswer}
                                        disabled={!answerContent.trim() || isSubmitting}
                                        loading={isSubmitting}
                                        loadingText="Posting..."
                                        className="flex items-center gap-2"
                                    >
                                        <PaperAirplaneIcon className="h-4 w-4" />
                                        Post Answer
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* User Profile */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <UserIcon className="h-5 w-5" />
                            User Profile
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Avatar
                                    src={question.user.avatar_url}
                                    alt={question.user.full_name}
                                    size="lg"
                                />
                                <div>
                                    <h4 className="font-medium text-white">{question.user.full_name}</h4>
                                    <p className="text-sm text-neutral-400">{question.user.email}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-neutral-400">Subscription</span>
                                    <Badge
                                        variant={
                                            question.user.subscription_tier === 'advanced' ? 'success' :
                                                question.user.subscription_tier === 'intermediate' ? 'warning' :
                                                    question.user.subscription_tier === 'beginner' ? 'info' :
                                                        'secondary'
                                        }
                                    >
                                        <CreditCardIcon className="h-3 w-3 mr-1" />
                                        {question.user.subscription_tier || 'None'}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-neutral-400">Member since</span>
                                    <span className="text-sm text-white">
                                        {new Date(question.user.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {question.user.last_sign_in_at && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-400">Last active</span>
                                        <span className="text-sm text-white">
                                            {new Date(question.user.last_sign_in_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/users/${question.user.id}`)}
                                    className="flex-1"
                                >
                                    <EyeIcon className="h-4 w-4 mr-1" />
                                    View Profile
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowRelated(!showRelated)}
                                    className="flex-1"
                                >
                                    <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
                                    Related
                                </Button>
                            </div>
                        </div>
                    </Card>

                    {/* Related Questions */}
                    {showRelated && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">
                                Related Questions
                            </h3>
                            {relatedQuestionsQuery.isLoading ? (
                                <div className="text-center py-4">
                                    <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
                                </div>
                            ) : relatedQuestionsQuery.data?.length === 0 ? (
                                <p className="text-sm text-neutral-400 text-center py-4">
                                    No other questions from this user
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {relatedQuestionsQuery.data?.map(related => (
                                        <button
                                            key={related.id}
                                            onClick={() => router.push(`/qa/${related.id}`)}
                                            className="w-full text-left p-3 border border-neutral-700 rounded-lg hover:border-primary-500 transition-colors"
                                        >
                                            <h4 className="font-medium text-white text-sm mb-1 line-clamp-2">
                                                {related.title}
                                            </h4>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="secondary" size="sm">
                                                    {related.status}
                                                </Badge>
                                                <span className="text-xs text-neutral-400">
                                                    {related.answers_count} answers
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Performance Metrics */}
                    {canViewMetrics && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <ChartBarIcon className="h-5 w-5" />
                                Metrics
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-neutral-400">Response time</span>
                                    <span className="text-sm text-white">
                                        {Math.round((new Date().getTime() - startTime.getTime()) / 60000)}m
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-neutral-400">Question age</span>
                                    <span className="text-sm text-white">
                                        {Math.round((new Date().getTime() - new Date(question.created_at).getTime()) / (1000 * 60 * 60))}h
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-neutral-400">Priority level</span>
                                    <Badge variant={getPriorityColor(question.priority)} size="sm">
                                        {question.priority}
                                    </Badge>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
} 