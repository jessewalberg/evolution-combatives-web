/**
 * Evolution Combatives - Categories Management Page
 * Professional category management interface for tactical training content
 * Designed for content administrators managing hierarchical content organization
 * 
 * @description Comprehensive categories management with CRUD operations, reordering, merging, and splitting
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
    UserGroupIcon,
    VideoCameraIcon,
    Bars3Icon,
    FolderIcon,
} from '@heroicons/react/24/outline'

// Services & Types
import { clientContentService } from '../../../../src/services/content-client'
import { queryKeys } from '../../../../src/lib/query-client'
import { useAuth } from '../../../../src/hooks/useAuth'
import type { CategoryWithRelations, DisciplineWithRelations, CategoryInsert, CategoryUpdate } from '../../../../src/lib/shared/types/database'


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
            <FolderIcon className="mx-auto h-12 w-12 text-neutral-400" />
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

// Sortable Category Row Component
function SortableCategoryRow({ category, discipline, onEdit, onDelete }: {
    category: CategoryWithRelations
    discipline: DisciplineWithRelations
    onEdit: (category: CategoryWithRelations) => void
    onDelete: (category: CategoryWithRelations) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    // TODO: Videos data needs to be fetched separately or included in API response
    const videoCount = 0 // Temporarily disabled: category.videos?.length || 0
    const completionRate = 0 // Temporarily disabled until we have video data

    return (
        <TableRow ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
            <TableCell>
                <div className="flex items-center gap-3">
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing p-1 hover:bg-neutral-700 rounded"
                    >
                        <Bars3Icon className="h-4 w-4 text-neutral-400" />
                    </div>
                    <div>
                        <div className="font-medium text-neutral-0">{category.name}</div>
                        <div className="text-sm text-neutral-400">{category.slug}</div>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: discipline.color }}
                    />
                    <span className="text-neutral-0">{discipline.name}</span>
                </div>
            </TableCell>
            <TableCell>
                <div className="text-sm text-neutral-300 max-w-xs truncate">
                    {category.description || 'No description'}
                </div>
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <VideoCameraIcon className="h-4 w-4 text-neutral-400" />
                    <span className="text-neutral-0">{videoCount}</span>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-2">
                    <div className="w-full bg-neutral-700 rounded-full h-2 max-w-[60px]">
                        <div
                            className="bg-primary-500 h-2 rounded-full"
                            style={{ width: `${completionRate}%` }}
                        />
                    </div>
                    <span className="text-sm text-neutral-300">{completionRate}%</span>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant={category.is_active ? 'success' : 'secondary'}>
                    {category.is_active ? 'Active' : 'Inactive'}
                </Badge>
            </TableCell>
            <TableCell align="right">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(category)}
                        className="h-8 w-8 p-0 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                        <PencilIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="sr-only">Edit category</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(category)}
                        className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-400 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                    >
                        <TrashIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="sr-only">Delete category</span>
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}

export default function CategoriesPage() {
    const { user, profile } = useAuth()
    const queryClient = useQueryClient()

    // State
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all')
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<CategoryWithRelations | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
        disciplineId: '',
        isActive: true,
        color: '#6B7280',
        subscription_tier_required: 'none' as 'none' | 'tier1' | 'tier2' | 'tier3'
    })

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    // Check permissions
    const canManageContent = profile?.admin_role === 'super_admin' || profile?.admin_role === 'content_admin'

    // Queries
    const disciplinesQuery = useQuery({
        queryKey: ['disciplines', 'list'],
        queryFn: () => clientContentService.fetchDisciplines(),
        enabled: !!user && !!profile?.admin_role,
    })

    const categoriesQuery = useQuery({
        queryKey: queryKeys.categoriesList(selectedDiscipline),
        queryFn: () => clientContentService.fetchCategories(),
        enabled: !!user && !!profile?.admin_role,
    })

    // Memoized filtered categories
    const filteredCategories = useMemo(() => {
        if (!categoriesQuery.data) return []

        if (selectedDiscipline === 'all') {
            return categoriesQuery.data
        }

        return categoriesQuery.data.filter(cat => cat.discipline_id === selectedDiscipline)
    }, [categoriesQuery.data, selectedDiscipline])

    // Calculate stats
    const disciplines = disciplinesQuery.data || []
    const allCategories = categoriesQuery.data || []
    const totalCategories = allCategories.length
    const activeCategories = allCategories.filter(c => c.is_active).length
    // TODO: Videos data needs to be fetched separately or included in API response
    const totalVideos = 0 // Temporarily disabled: allCategories.reduce((sum, c) => sum + (c.videos?.length || 0), 0)
    const avgCompletionRate = 0 // Temporarily disabled until we have video data

    // Get discipline options for form
    const disciplineOptions = disciplines.map(d => ({
        value: d.id,
        label: d.name,
        color: d.color
    }))

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: CategoryInsert) => clientContentService.createCategory(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories() })
            toast.success('Category created successfully')
            setCreateDialogOpen(false)
            resetForm()
        },
        onError: (error: Error) => {
            toast.error(`Failed to create category: ${error.message}`)
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CategoryUpdate }) =>
            clientContentService.updateCategory(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories() })
            toast.success('Category updated successfully')
            setEditDialogOpen(false)
            setSelectedCategory(null)
            resetForm()
        },
        onError: (error: Error) => {
            toast.error(`Failed to update category: ${error.message}`)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (categoryId: string) => clientContentService.deleteCategory(categoryId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories() })
            toast.success('Category deleted successfully')
            setDeleteDialogOpen(false)
            setSelectedCategory(null)
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete category: ${error.message}`)
        },
    })

    const reorderMutation = useMutation({
        mutationFn: (reorderData: Array<{ id: string; sort_order: number }>) =>
            clientContentService.reorderCategories(reorderData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.categories() })
            toast.success('Categories reordered successfully')
        },
        onError: (error: Error) => {
            toast.error(`Failed to reorder categories: ${error.message}`)
        },
    })


    // Handlers
    const resetForm = () => {
        setFormData({
            name: '',
            slug: '',
            description: '',
            disciplineId: '',
            isActive: true,
            color: '#6B7280',
            subscription_tier_required: 'none' as 'none' | 'tier1' | 'tier2' | 'tier3'
        })
    }

    const handleCreate = () => {
        if (!canManageContent) {
            toast.error('You do not have permission to create categories')
            return
        }
        resetForm()
        setCreateDialogOpen(true)
    }

    const handleEdit = (category: CategoryWithRelations) => {
        if (!canManageContent) {
            toast.error('You do not have permission to edit categories')
            return
        }
        setSelectedCategory(category)
        setFormData({
            name: category.name,
            slug: category.slug,
            description: category.description || '',
            disciplineId: category.discipline_id,
            isActive: category.is_active,
            color: category.color || '#6B7280',
            subscription_tier_required: category.subscription_tier_required || 'none'
        })
        setEditDialogOpen(true)
    }

    const handleDelete = (category: CategoryWithRelations) => {
        if (!canManageContent) {
            toast.error('You do not have permission to delete categories')
            return
        }
        setSelectedCategory(category)
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
            const categoryData: CategoryInsert = {
                name: formData.name,
                slug: formData.slug,
                description: formData.description,
                discipline_id: formData.disciplineId,
                color: formData.color,
                subscription_tier_required: formData.subscription_tier_required,
                is_active: formData.isActive,
                sort_order: selectedCategory ? selectedCategory.sort_order : (filteredCategories.length || 0) + 1,
            }

            if (selectedCategory) {
                updateMutation.mutate({ id: selectedCategory.id, data: categoryData })
            } else {
                createMutation.mutate(categoryData)
            }
        } catch (error) {
            toast.error('An unexpected error occurred')
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (!over || active.id === over.id) {
            return
        }

        const oldIndex = filteredCategories.findIndex(item => item.id === active.id)
        const newIndex = filteredCategories.findIndex(item => item.id === over.id)

        const newOrder = arrayMove(filteredCategories, oldIndex, newIndex)
        const reorderData = newOrder.map((item, index) => ({
            id: item.id,
            sort_order: index + 1
        }))

        reorderMutation.mutate(reorderData)
    }

    // Loading state
    if (categoriesQuery.isLoading || disciplinesQuery.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    // Error state
    if (categoriesQuery.error || disciplinesQuery.error) {
        return (
            <EmptyState
                title="Failed to load categories"
                description="There was an error loading the categories. Please try again."
                action={{
                    label: 'Retry',
                    onClick: () => {
                        categoriesQuery.refetch()
                        disciplinesQuery.refetch()
                    }
                }}
            />
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-0">Categories</h1>
                    <p className="text-neutral-400">
                        Manage training categories within disciplines
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                        value={selectedDiscipline}
                        onChange={(e) => setSelectedDiscipline(e.target.value)}
                        className="w-full sm:w-48 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                        <option value="all">All Disciplines</option>
                        {disciplines.map((discipline) => (
                            <option key={discipline.id} value={discipline.id}>
                                {discipline.name}
                            </option>
                        ))}
                    </select>
                    {canManageContent && (
                        <Button onClick={handleCreate} className="w-full sm:w-auto">
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Create Category
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary-500/10 rounded-lg">
                                <FolderIcon className="h-6 w-6 text-primary-400" />
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
                            <div className="p-3 bg-success-500/10 rounded-lg">
                                <UserGroupIcon className="h-6 w-6 text-success-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {activeCategories}
                                </p>
                                <p className="text-sm text-neutral-400">Active Categories</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-warning-500/10 rounded-lg">
                                <VideoCameraIcon className="h-6 w-6 text-warning-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {totalVideos}
                                </p>
                                <p className="text-sm text-neutral-400">Total Videos</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-info-500/10 rounded-lg">
                                <DocumentDuplicateIcon className="h-6 w-6 text-info-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-neutral-0">
                                    {avgCompletionRate}%
                                </p>
                                <p className="text-sm text-neutral-400">Avg Completion</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Categories Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Categories Management
                        {filteredCategories.length > 0 && (
                            <Badge variant="secondary">{filteredCategories.length} categories</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredCategories.length === 0 ? (
                        <EmptyState
                            title="No categories found"
                            description={
                                selectedDiscipline === 'all'
                                    ? "Get started by creating your first category to organize training content."
                                    : "No categories found for the selected discipline. Create one to get started."
                            }
                            action={canManageContent ? {
                                label: 'Create Category',
                                onClick: handleCreate
                            } : undefined}
                        />
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Discipline</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Videos</TableHead>
                                        <TableHead>Completion</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead align="right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <SortableContext
                                        items={filteredCategories.map(c => c.id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {filteredCategories.map((category) => {
                                            const discipline = disciplines.find(d => d.id === category.discipline_id)!
                                            return (
                                                <SortableCategoryRow
                                                    key={category.id}
                                                    category={category}
                                                    discipline={discipline}
                                                    onEdit={handleEdit}
                                                    onDelete={handleDelete}
                                                />
                                            )
                                        })}
                                    </SortableContext>
                                </TableBody>
                            </Table>
                        </DndContext>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
                if (!open) {
                    setCreateDialogOpen(false)
                    setEditDialogOpen(false)
                    setSelectedCategory(null)
                    resetForm()
                }
            }}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedCategory ? 'Edit Category' : 'Create Category'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedCategory
                                ? 'Update the category information and settings.'
                                : 'Create a new category to organize training content within a discipline.'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                Name <span className="text-error-400">*</span>
                            </label>
                            <Input
                                placeholder="e.g., Ground Control"
                                value={formData.name}
                                onChange={(e) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        name: e.target.value,
                                        slug: !selectedCategory ? generateSlugFromName(e.target.value) : prev.slug
                                    }))
                                }}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                Slug <span className="text-error-400">*</span>
                            </label>
                            <Input
                                placeholder="e.g., ground-control"
                                value={formData.slug}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, slug: e.target.value }))
                                }}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                Discipline <span className="text-error-400">*</span>
                            </label>
                            <select
                                value={formData.disciplineId}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, disciplineId: e.target.value }))
                                }}
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">Select discipline</option>
                                {disciplineOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-neutral-0 mb-2 block">
                                Description
                            </label>
                            <textarea
                                placeholder="Brief description of this category..."
                                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-neutral-0 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                rows={3}
                                value={formData.description}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, description: e.target.value }))
                                }}
                            />
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
                                setSelectedCategory(null)
                                resetForm()
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onSubmit}
                            disabled={createMutation.isPending || updateMutation.isPending || !formData.name || !formData.slug || !formData.disciplineId}
                        >
                            {createMutation.isPending || updateMutation.isPending ? (
                                <LoadingSpinner size="sm" />
                            ) : null}
                            {selectedCategory ? 'Update' : 'Create'} Category
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Category"
                description={`Are you sure you want to delete "${selectedCategory?.name}"? This action cannot be undone and will affect all associated videos.`}
                confirmText="Delete"
                confirmVariant="destructive"
                loading={deleteMutation.isPending}
                onConfirm={() => {
                    if (selectedCategory) {
                        deleteMutation.mutate(selectedCategory.id)
                    }
                }}
                onCancel={() => {
                    setDeleteDialogOpen(false)
                    setSelectedCategory(null)
                }}
            />

        </div>
    )
} 