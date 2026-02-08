/**
 * Evolution Combatives - Instructors Management Page
 *
 * @description Manage instructor profiles used by videos across admin and mobile apps.
 */

'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useAuth } from '../../../../src/hooks/useAuth'
import { clientContentService } from '../../../../src/services/content-client'
import { queryKeys } from '../../../../src/lib/query-client'
import type { Instructor, InstructorInsert, InstructorUpdate } from '../../../../src/lib/shared/types/database'

import { Button } from '../../../../src/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../../src/components/ui/card'
import { Input } from '../../../../src/components/ui/input'
import { Badge } from '../../../../src/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../src/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ConfirmationDialog } from '../../../../src/components/ui/dialog'

import {
    MagnifyingGlassIcon,
    PlusIcon,
    PencilIcon,
    TrashIcon,
    UserGroupIcon,
    AcademicCapIcon,
} from '@heroicons/react/24/outline'

function LoadingSpinner({ size = 'default' }: { size?: 'sm' | 'default' }) {
    const className = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
    return (
        <div className="animate-spin">
            <svg className={className} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4zm2 5.3A8 8 0 014 12H0c0 3 1.1 5.8 3 7.9l3-2.6z"
                />
            </svg>
        </div>
    )
}

const arrayToCsv = (value?: string[] | null) => (value || []).join(', ')
const csvToArray = (value: string) =>
    value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)

export default function InstructorsPage() {
    const { user, profile } = useAuth()
    const queryClient = useQueryClient()

    const [search, setSearch] = useState('')
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null)

    const [formData, setFormData] = useState({
        fullName: '',
        bio: '',
        avatarUrl: '',
        yearsExperience: '',
        credentials: '',
        specialties: '',
        isActive: true,
    })

    const canManageContent = profile?.admin_role === 'super_admin'
        || profile?.admin_role === 'content_admin'
        || profile?.admin_role === 'content_support_admin'

    const instructorsQuery = useQuery({
        queryKey: queryKeys.instructorsList(),
        queryFn: () => clientContentService.fetchInstructors(true),
        enabled: !!user && !!profile?.admin_role,
    })

    const instructors = useMemo(() => instructorsQuery.data ?? [], [instructorsQuery.data])

    const filteredInstructors = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return instructors
        return instructors.filter((instructor) => {
            const fields = [
                instructor.full_name || '',
                instructor.bio || '',
                ...(instructor.credentials || []),
                ...(instructor.specialties || []),
            ].join(' ').toLowerCase()
            return fields.includes(term)
        })
    }, [instructors, search])

    const resetForm = () => {
        setFormData({
            fullName: '',
            bio: '',
            avatarUrl: '',
            yearsExperience: '',
            credentials: '',
            specialties: '',
            isActive: true,
        })
    }

    const openCreate = () => {
        setSelectedInstructor(null)
        resetForm()
        setCreateDialogOpen(true)
    }

    const openEdit = (instructor: Instructor) => {
        setSelectedInstructor(instructor)
        setFormData({
            fullName: instructor.full_name || '',
            bio: instructor.bio || '',
            avatarUrl: instructor.avatar_url || '',
            yearsExperience: instructor.years_experience?.toString() || '',
            credentials: arrayToCsv(instructor.credentials),
            specialties: arrayToCsv(instructor.specialties),
            isActive: !!instructor.is_active,
        })
        setEditDialogOpen(true)
    }

    const openDelete = (instructor: Instructor) => {
        setSelectedInstructor(instructor)
        setDeleteDialogOpen(true)
    }

    const invalidateInstructorData = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.instructors() })
        queryClient.invalidateQueries({ queryKey: queryKeys.videos() })
    }

    const createMutation = useMutation({
        mutationFn: (data: InstructorInsert) => clientContentService.createInstructor(data),
        onSuccess: () => {
            toast.success('Instructor created successfully')
            invalidateInstructorData()
            setCreateDialogOpen(false)
            resetForm()
        },
        onError: (error: Error) => {
            toast.error(`Failed to create instructor: ${error.message}`)
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: InstructorUpdate }) =>
            clientContentService.updateInstructor(id, data),
        onSuccess: () => {
            toast.success('Instructor updated successfully')
            invalidateInstructorData()
            setEditDialogOpen(false)
            setSelectedInstructor(null)
            resetForm()
        },
        onError: (error: Error) => {
            toast.error(`Failed to update instructor: ${error.message}`)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => clientContentService.deleteInstructor(id),
        onSuccess: () => {
            toast.success('Instructor deleted successfully')
            invalidateInstructorData()
            setDeleteDialogOpen(false)
            setSelectedInstructor(null)
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete instructor: ${error.message}`)
        },
    })

    const toPayload = (): InstructorInsert | InstructorUpdate => ({
        full_name: formData.fullName.trim(),
        bio: formData.bio.trim() || null,
        avatar_url: formData.avatarUrl.trim() || null,
        years_experience: formData.yearsExperience.trim() ? Number(formData.yearsExperience) : null,
        credentials: csvToArray(formData.credentials),
        specialties: csvToArray(formData.specialties),
        is_active: formData.isActive,
    })

    const onSubmit = () => {
        if (!formData.fullName.trim()) {
            toast.error('Full name is required')
            return
        }

        if (selectedInstructor) {
            updateMutation.mutate({
                id: selectedInstructor.id,
                data: toPayload() as InstructorUpdate,
            })
            return
        }

        createMutation.mutate(toPayload() as InstructorInsert)
    }

    const isLoading = instructorsQuery.isLoading || createMutation.isPending || updateMutation.isPending

    const activeCount = instructors.filter((instructor) => instructor.is_active).length

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-0">Instructors</h1>
                    <p className="text-neutral-400">
                        Manage instructor profiles and avatar images used across video content.
                    </p>
                </div>
                <Button onClick={openCreate} disabled={!canManageContent}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add Instructor
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-neutral-400">Total Instructors</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <span className="text-2xl font-semibold text-neutral-0">{instructors.length}</span>
                        <UserGroupIcon className="h-5 w-5 text-neutral-400" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-neutral-400">Active</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <span className="text-2xl font-semibold text-neutral-0">{activeCount}</span>
                        <Badge variant="success">Active</Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-neutral-400">Inactive</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <span className="text-2xl font-semibold text-neutral-0">{instructors.length - activeCount}</span>
                        <Badge variant="secondary">Inactive</Badge>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>Instructor Directory</CardTitle>
                    <div className="relative w-full sm:w-80">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                        <Input
                            placeholder="Search instructors..."
                            className="pl-10"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {instructorsQuery.isLoading ? (
                        <div className="flex justify-center py-10">
                            <LoadingSpinner />
                        </div>
                    ) : filteredInstructors.length === 0 ? (
                        <div className="py-12 text-center text-neutral-400">
                            <AcademicCapIcon className="mx-auto mb-3 h-10 w-10 text-neutral-500" />
                            No instructors found.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Instructor</TableHead>
                                    <TableHead>Experience</TableHead>
                                    <TableHead>Specialties</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead align="right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredInstructors.map((instructor) => (
                                    <TableRow key={instructor.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {instructor.avatar_url ? (
                                                    <Image
                                                        src={instructor.avatar_url}
                                                        alt={instructor.full_name}
                                                        width={40}
                                                        height={40}
                                                        className="h-10 w-10 rounded-full border border-neutral-700 object-cover"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-sm font-semibold text-neutral-200">
                                                        {(instructor.full_name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-medium text-neutral-0">{instructor.full_name}</div>
                                                    <div className="max-w-[320px] truncate text-sm text-neutral-400">
                                                        {instructor.bio || 'No bio provided'}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{instructor.years_experience ?? '-'}</TableCell>
                                        <TableCell>
                                            <div className="max-w-[260px] truncate text-sm text-neutral-300">
                                                {(instructor.specialties || []).join(', ') || '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={instructor.is_active ? 'success' : 'secondary'}>
                                                {instructor.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell align="right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openEdit(instructor)}
                                                    disabled={!canManageContent}
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openDelete(instructor)}
                                                    disabled={!canManageContent}
                                                >
                                                    <TrashIcon className="h-4 w-4 text-error-400" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={createDialogOpen || editDialogOpen}
                onOpenChange={(open) => {
                    if (open) return
                    setCreateDialogOpen(false)
                    setEditDialogOpen(false)
                    setSelectedInstructor(null)
                    resetForm()
                }}
            >
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>{selectedInstructor ? 'Edit Instructor' : 'Create Instructor'}</DialogTitle>
                        <DialogDescription>
                            {selectedInstructor
                                ? 'Update instructor profile details.'
                                : 'Create a new instructor profile for assigning to videos.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-0">
                                Full Name <span className="text-error-400">*</span>
                            </label>
                            <Input
                                value={formData.fullName}
                                placeholder="e.g., Coach John Smith"
                                onChange={(event) => setFormData((prev) => ({ ...prev, fullName: event.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-0">Avatar Image URL</label>
                            <Input
                                value={formData.avatarUrl}
                                placeholder="https://..."
                                onChange={(event) => setFormData((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-0">Bio</label>
                            <textarea
                                rows={3}
                                className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-0 placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={formData.bio}
                                placeholder="Short instructor bio..."
                                onChange={(event) => setFormData((prev) => ({ ...prev, bio: event.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-neutral-0">Years of Experience</label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={formData.yearsExperience}
                                    placeholder="e.g., 12"
                                    onChange={(event) => setFormData((prev) => ({ ...prev, yearsExperience: event.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-neutral-0">Credentials (comma-separated)</label>
                                <Input
                                    value={formData.credentials}
                                    placeholder="Black Belt, SWAT Trainer"
                                    onChange={(event) => setFormData((prev) => ({ ...prev, credentials: event.target.value }))}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-0">Specialties (comma-separated)</label>
                            <Input
                                value={formData.specialties}
                                placeholder="Ground Defense, Weapon Retention"
                                onChange={(event) => setFormData((prev) => ({ ...prev, specialties: event.target.value }))}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
                                className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-800"
                            />
                            <label className="text-sm font-medium text-neutral-0">Active (available for video assignment)</label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCreateDialogOpen(false)
                                setEditDialogOpen(false)
                                setSelectedInstructor(null)
                                resetForm()
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={onSubmit} disabled={isLoading || !formData.fullName.trim()}>
                            {isLoading ? <LoadingSpinner size="sm" /> : null}
                            {selectedInstructor ? 'Update' : 'Create'} Instructor
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Instructor"
                description={`Delete "${selectedInstructor?.full_name}"? Linked instructor assignments will be removed and legacy single-instructor references on videos will be cleared.`}
                confirmText="Delete"
                confirmVariant="destructive"
                loading={deleteMutation.isPending}
                onConfirm={() => {
                    if (selectedInstructor) {
                        deleteMutation.mutate(selectedInstructor.id)
                    }
                }}
                onCancel={() => {
                    setDeleteDialogOpen(false)
                    setSelectedInstructor(null)
                }}
            />
        </div>
    )
}
