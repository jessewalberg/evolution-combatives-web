/**
 * Evolution Combatives - Disciplines Management Page
 * Professional discipline management interface for tactical training content
 * Designed for content administrators managing law enforcement training disciplines
 * 
 * @description Comprehensive disciplines management with CRUD operations
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// UI Components
import { Button } from '../../../../src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../src/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../src/components/ui/table'
import { Badge } from '../../../../src/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ConfirmationDialog } from '../../../../src/components/ui/dialog'
import { Input } from '../../../../src/components/ui/input'

// Icons
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    DocumentDuplicateIcon,
    ShieldCheckIcon,
    UserGroupIcon,
    VideoCameraIcon,
} from '@heroicons/react/24/outline'

// Services & Types
import { clientContentService } from '../../../../src/services/content-client'
import { queryKeys } from '../../../../src/lib/query-client'
import { useAuth } from '../../../../src/hooks/useAuth'
import type { DisciplineWithRelations, CategoryWithRelations, DisciplineInsert, DisciplineUpdate } from '../../../../src/lib/shared/types/database'

// Loading Spinner Component
function LoadingSpinner({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        default: 'h-6 w-6',
        lg: 'h-8 w-8'
    }

    return (
        <div className="animate-spin">
            <svg
                className={sizeClasses[size]}
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
        </div>
    )
}

// Empty State Component
function EmptyState({
    title,
    description,
    action
}: {
    title: string
    description: string
    action?: { label: string; onClick: () => void }
}) {
    return (
        <div className="text-center py-12">
            <ShieldCheckIcon className="mx-auto h-12 w-12 text-neutral-400" />
            <h3 className="mt-4 text-lg font-medium text-neutral-0">{title}</h3>
            <p className="mt-2 text-sm text-neutral-400 max-w-md mx-auto">{description}</p>
            {action && (
                <Button onClick={action.onClick} className="mt-4">
                    {action.label}
                </Button>
            )}
        </div>
    )
}

// Subscription tier options
const SUBSCRIPTION_TIERS = [
    { value: 'none', label: 'Free', color: 'secondary' },
    { value: 'tier1', label: 'Tier 1 ($9)', color: 'info' },
    { value: 'tier2', label: 'Tier 2 ($19)', color: 'secondary' },
    { value: 'tier3', label: 'Tier 3 ($49)', color: 'success' },
] as const

type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number]['value']

export default function DisciplinesPage() {
    const { user, profile } = useAuth()
    const queryClient = useQueryClient()

    // State
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineWithRelations | null>(null)
    const [formData, setFormData] = useState<{
        name: string
        slug: string
        description: string
        color: string
        subscriptionTierRequired: SubscriptionTier
        isActive: boolean
    }>({
        name: '',
        slug: '',
        description: '',
        color: '#3B82F6',
        subscriptionTierRequired: 'none',
        isActive: true
    })

    // Check permissions
    const canManageContent = profile?.admin_role === 'super_admin' || profile?.admin_role === 'content_admin'

    // Queries
    const disciplinesQuery = useQuery({
        queryKey: ['disciplines', 'list'],
        queryFn: () => clientContentService.fetchDisciplines(),
        enabled: !!user && !!profile?.admin_role,
    })

    // Calculate stats
    const disciplines = disciplinesQuery.data || []
    const totalDisciplines = disciplines.length
    const activeDisciplines = disciplines.filter((d: DisciplineWithRelations) => d.is_active).length
    const totalCategories = disciplines.reduce((sum: number, d: DisciplineWithRelations) => sum + (d.categories?.length || 0), 0)
    const disciplinesNeedingCategories = disciplines.filter((d: DisciplineWithRelations) => !d.categories || d.categories.length === 0).length

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: DisciplineInsert) => clientContentService.createDiscipline(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.disciplines() })
            toast.success('Discipline created successfully')
            setCreateDialogOpen(false)
            resetForm()
        },
        onError: (error: Error) => {
            toast.error(`Failed to create discipline: ${error.message}`)
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: DisciplineUpdate }) =>
            clientContentService.updateDiscipline(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.disciplines() })
            toast.success('Discipline updated successfully')
            setEditDialogOpen(false)
            setSelectedDiscipline(null)
            resetForm()
        },
        onError: (error: Error) => {
            toast.error(`Failed to update discipline: ${error.message}`)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (disciplineId: string) => clientContentService.deleteDiscipline(disciplineId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.disciplines() })
            toast.success('Discipline deleted successfully')
            setDeleteDialogOpen(false)
            setSelectedDiscipline(null)
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete discipline: ${error.message}`)
        },
    })

    // Handlers
    const resetForm = () => {
        setFormData({
            name: '',
            slug: '',
            description: '',
            color: '#3B82F6',
            subscriptionTierRequired: 'none',
            isActive: true
        })
    }

    const handleCreate = () => {
        if (!canManageContent) {
            toast.error('You do not have permission to create disciplines')
            return
        }
        resetForm()
        setCreateDialogOpen(true)
    }

    const handleEdit = (discipline: DisciplineWithRelations) => {
        if (!canManageContent) {
            toast.error('You do not have permission to edit disciplines')
            return
        }
        setSelectedDiscipline(discipline)
        setFormData({
            name: discipline.name,
            slug: discipline.slug,
            description: discipline.description || '',
            color: discipline.color,
            subscriptionTierRequired: discipline.subscription_tier_required,
            isActive: discipline.is_active,
        })
        setEditDialogOpen(true)
    }

    const handleDelete = (discipline: DisciplineWithRelations) => {
        if (!canManageContent) {
            toast.error('You do not have permission to delete disciplines')
            return
        }
        setSelectedDiscipline(discipline)
        setDeleteDialogOpen(true)
    }

    const generateSlugFromName = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const onSubmit = async () => {
        try {
            const disciplineData = {
                name: formData.name,
                slug: formData.slug,
                description: formData.description,
                color: formData.color,
                subscription_tier_required: formData.subscriptionTierRequired,
                is_active: formData.isActive,
                sort_order: selectedDiscipline ? selectedDiscipline.sort_order : (disciplines.length || 0) + 1,
            }

            if (selectedDiscipline) {
                updateMutation.mutate({ id: selectedDiscipline.id, data: disciplineData })
            } else {
                createMutation.mutate(disciplineData)
            }
        } catch (error) {
            toast.error('An unexpected error occurred')
        }
    }

    // Loading state
    if (disciplinesQuery.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    // Error state
    if (disciplinesQuery.error) {
        return (
            <EmptyState
                title="Failed to load disciplines"
                description="There was an error loading the disciplines. Please try again."
                action={{
                    label: 'Retry',
                    onClick: () => disciplinesQuery.refetch()
                }}
            />
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-0">Disciplines</h1>
                    <p className="text-neutral-400">
                        Manage training disciplines and their organization
                    </p>
                </div>
                {canManageContent && (
                    <Button onClick={handleCreate}>
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Create Discipline
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary-500/10 rounded-lg">
                                <ShieldCheckIcon className="h-6 w-6 text-primary-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {totalDisciplines}
                                </p>
                                <p className="text-sm text-neutral-400">Total Disciplines</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-success-500/10 rounded-lg">
                                <UserGroupIcon className="h-6 w-6 text-success-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {activeDisciplines}
                                </p>
                                <p className="text-sm text-neutral-400">Active Disciplines</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-warning-500/10 rounded-lg">
                                <DocumentDuplicateIcon className="h-6 w-6 text-warning-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {totalCategories}
                                </p>
                                <p className="text-sm text-neutral-400">Total Categories</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-warning-500/10 rounded-lg">
                                <DocumentDuplicateIcon className="h-6 w-6 text-warning-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {disciplinesNeedingCategories}
                                </p>
                                <p className="text-sm text-neutral-400">Need Categories</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Disciplines Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Disciplines Management
                        {disciplines.length > 0 && (
                            <Badge variant="secondary">{disciplines.length} disciplines</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {disciplines.length === 0 ? (
                        <EmptyState
                            title="No disciplines found"
                            description="Get started by creating your first discipline to organize training content."
                            action={canManageContent ? {
                                label: 'Create Discipline',
                                onClick: handleCreate
                            } : undefined}
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Discipline</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Tier</TableHead>
                                    <TableHead>Categories</TableHead>
                                    <TableHead>Videos</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead align="right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {disciplines.map((discipline: DisciplineWithRelations) => {
                                    const categoryCount = discipline.categories?.length || 0
                                    const videoCount = discipline.categories?.reduce((sum: number, category: CategoryWithRelations) => sum + (category.videos?.length || 0), 0) || 0
                                    const tierConfig = SUBSCRIPTION_TIERS.find(t => t.value === discipline.subscription_tier_required)

                                    return (
                                        <TableRow key={discipline.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-4 h-4 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: discipline.color }}
                                                    />
                                                    <div>
                                                        <div className="font-medium text-neutral-0">{discipline.name}</div>
                                                        <div className="text-sm text-neutral-400">{discipline.slug}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm text-neutral-300 max-w-xs truncate">
                                                    {discipline.description || 'No description'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={tierConfig?.color as 'default' | 'secondary' | 'success' | 'warning' | 'error'}>
                                                    {tierConfig?.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <DocumentDuplicateIcon className="h-4 w-4 text-neutral-400" />
                                                    <span className="text-neutral-0">{categoryCount}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <VideoCameraIcon className="h-4 w-4 text-neutral-400" />
                                                    <span className="text-neutral-0">{videoCount}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={discipline.is_active ? 'success' : 'secondary'}>
                                                    {discipline.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell align="right">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEdit(discipline)}
                                                        className="h-8 w-8 p-0 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                                    >
                                                        <PencilIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                                        <span className="sr-only">Edit discipline</span>
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDelete(discipline)}
                                                        className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                                                    >
                                                        <TrashIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                                                        <span className="sr-only">Delete discipline</span>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    setCreateDialogOpen(false)
                    setEditDialogOpen(false)
                    setSelectedDiscipline(null)
                    resetForm()
                }
            }}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedDiscipline ? 'Edit Discipline' : 'Create Discipline'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDiscipline
                                ? 'Update the discipline information and settings.'
                                : 'Create a new discipline to organize training content.'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                Name <span className="text-error-400">*</span>
                            </label>
                            <Input
                                placeholder="e.g., Law Enforcement"
                                value={formData.name}
                                onChange={(e) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        name: e.target.value,
                                        slug: !selectedDiscipline ? generateSlugFromName(e.target.value) : prev.slug
                                    }))
                                }}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                Slug <span className="text-error-400">*</span>
                            </label>
                            <Input
                                placeholder="e.g., law-enforcement"
                                value={formData.slug}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, slug: e.target.value }))
                                }}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                Description
                            </label>
                            <textarea
                                placeholder="Brief description of this discipline..."
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-0 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                rows={3}
                                value={formData.description}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, description: e.target.value }))
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                    Color <span className="text-error-400">*</span>
                                </label>
                                <Input
                                    type="color"
                                    value={formData.color}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, color: e.target.value }))
                                    }}
                                    className="h-12"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                    Required Subscription Tier <span className="text-error-400">*</span>
                                </label>
                                <select
                                    value={formData.subscriptionTierRequired}
                                    onChange={(e) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            subscriptionTierRequired: e.target.value as SubscriptionTier
                                        }))
                                    }}
                                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                    {SUBSCRIPTION_TIERS.map((tier) => (
                                        <option key={tier.value} value={tier.value}>
                                            {tier.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, isActive: e.target.checked }))
                                }}
                                className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-800"
                            />
                            <label className="text-sm font-medium text-neutral-0">
                                Active (visible to users)
                            </label>
                        </div>

                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCreateDialogOpen(false)
                                setEditDialogOpen(false)
                                setSelectedDiscipline(null)
                                resetForm()
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onSubmit}
                            disabled={createMutation.isPending || updateMutation.isPending || !formData.name || !formData.slug}
                        >
                            {createMutation.isPending || updateMutation.isPending ? (
                                <LoadingSpinner size="sm" />
                            ) : null}
                            {selectedDiscipline ? 'Update' : 'Create'} Discipline
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Discipline"
                description={`Are you sure you want to delete "${selectedDiscipline?.name}"? This action cannot be undone and will affect all associated categories and videos.`}
                confirmText="Delete"
                confirmVariant="destructive"
                loading={deleteMutation.isPending}
                onConfirm={() => {
                    if (selectedDiscipline) {
                        deleteMutation.mutate(selectedDiscipline.id)
                    }
                }}
                onCancel={() => {
                    setDeleteDialogOpen(false)
                    setSelectedDiscipline(null)
                }}
            />
        </div>
    )
} 