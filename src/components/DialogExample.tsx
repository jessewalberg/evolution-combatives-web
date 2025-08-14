/**
 * Evolution Combatives Dialog Examples
 * Comprehensive demonstration of dialog component system
 * 
 * @description Examples showing all dialog variants and usage patterns
 * @author Evolution Combatives
 */

'use client'

import * as React from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
    ConfirmationDialog,
    FormDialog
} from './ui/dialog'
import {
    TrashIcon,
    PlusIcon,
    PencilIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline'

/**
 * Dialog Examples Component
 * Demonstrates all dialog variants and usage patterns
 */
export default function DialogExample() {
    // State for various dialog examples
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
    const [showCreateDialog, setShowCreateDialog] = React.useState(false)
    const [showEditDialog, setShowEditDialog] = React.useState(false)
    const [showWarningDialog, setShowWarningDialog] = React.useState(false)
    const [showInfoDialog, setShowInfoDialog] = React.useState(false)

    // Loading states
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [isCreating, setIsCreating] = React.useState(false)
    const [isEditing, setIsEditing] = React.useState(false)

    // Form data
    const [formData, setFormData] = React.useState({
        name: '',
        email: '',
        description: ''
    })

    // Handlers
    const handleDelete = async () => {
        setIsDeleting(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000))
        setIsDeleting(false)
        setShowDeleteDialog(false)
        alert('Video deleted successfully!')
    }

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsCreating(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000))
        setIsCreating(false)
        setShowCreateDialog(false)
        alert('Category created successfully!')
        setFormData({ name: '', email: '', description: '' })
    }

    const handleEdit = async (event: React.FormEvent) => {
        event.preventDefault()
        setIsEditing(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000))
        setIsEditing(false)
        setShowEditDialog(false)
        alert('User updated successfully!')
    }

    return (
        <div className="p-8 space-y-8 bg-neutral-900 min-h-screen">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-neutral-0 mb-2">
                        Dialog Component Examples
                    </h1>
                    <p className="text-neutral-400 text-lg">
                        Professional modal dialogs for Evolution Combatives admin interface
                    </p>
                </div>

                {/* Dialog Sizes */}
                <section className="mb-12">
                    <h2 className="text-2xl font-semibold text-neutral-0 mb-6">
                        Dialog Sizes & Features
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Small Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    Small Dialog (400px)
                                </Button>
                            </DialogTrigger>
                            <DialogContent size="sm">
                                <DialogHeader>
                                    <DialogTitle>Small Dialog</DialogTitle>
                                    <DialogDescription>
                                        This is a small dialog with 400px max width.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <p className="text-sm text-neutral-300">
                                        Perfect for simple confirmations and alerts.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Default Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    Default Dialog (500px)
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Default Dialog</DialogTitle>
                                    <DialogDescription>
                                        This is the default dialog size with 500px max width.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <p className="text-sm text-neutral-300">
                                        Great for forms and detailed content.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Large Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    Large Dialog (600px)
                                </Button>
                            </DialogTrigger>
                            <DialogContent size="lg">
                                <DialogHeader>
                                    <DialogTitle>Large Dialog</DialogTitle>
                                    <DialogDescription>
                                        This is a large dialog with 600px max width.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <p className="text-sm text-neutral-300">
                                        Ideal for complex forms and detailed views.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Extra Large Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    XL Dialog (800px)
                                </Button>
                            </DialogTrigger>
                            <DialogContent size="xl">
                                <DialogHeader>
                                    <DialogTitle>Extra Large Dialog</DialogTitle>
                                    <DialogDescription>
                                        This is an extra large dialog with 800px max width.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <p className="text-sm text-neutral-300">
                                        Perfect for data tables and comprehensive forms.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Full Size Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    Full Dialog (95vw)
                                </Button>
                            </DialogTrigger>
                            <DialogContent size="full">
                                <DialogHeader>
                                    <DialogTitle>Full Size Dialog</DialogTitle>
                                    <DialogDescription>
                                        This dialog takes up 95% of the viewport width.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <p className="text-sm text-neutral-300">
                                        Best for complex dashboards and data visualization.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Scrollable Dialog */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    Scrollable Dialog
                                </Button>
                            </DialogTrigger>
                            <DialogContent size="lg" scrollable>
                                <DialogHeader>
                                    <DialogTitle>Scrollable Dialog</DialogTitle>
                                    <DialogDescription>
                                        This dialog has scrollable content when it exceeds the viewport height.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4 space-y-4">
                                    {Array.from({ length: 20 }, (_, i) => (
                                        <div key={i} className="p-4 bg-neutral-700 rounded-md">
                                            <h4 className="font-medium text-neutral-0">Content Block {i + 1}</h4>
                                            <p className="text-sm text-neutral-300 mt-1">
                                                This is a content block to demonstrate scrolling behavior.
                                                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </section>

                {/* Pre-built Dialogs */}
                <section className="mb-12">
                    <h2 className="text-2xl font-semibold text-neutral-0 mb-6">
                        Pre-built Dialog Components
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Confirmation Dialog - Delete */}
                        <Button
                            variant="destructive"
                            onClick={() => setShowDeleteDialog(true)}
                            leftIcon={<TrashIcon className="h-4 w-4" />}
                            className="w-full"
                        >
                            Delete Video
                        </Button>

                        {/* Form Dialog - Create */}
                        <Button
                            variant="primary"
                            onClick={() => setShowCreateDialog(true)}
                            leftIcon={<PlusIcon className="h-4 w-4" />}
                            className="w-full"
                        >
                            Create Category
                        </Button>

                        {/* Form Dialog - Edit */}
                        <Button
                            variant="secondary"
                            onClick={() => setShowEditDialog(true)}
                            leftIcon={<PencilIcon className="h-4 w-4" />}
                            className="w-full"
                        >
                            Edit User
                        </Button>

                        {/* Warning Dialog */}
                        <Button
                            variant="warning"
                            onClick={() => setShowWarningDialog(true)}
                            leftIcon={<ExclamationTriangleIcon className="h-4 w-4" />}
                            className="w-full"
                        >
                            Show Warning
                        </Button>

                        {/* Info Dialog */}
                        <Button
                            variant="ghost"
                            onClick={() => setShowInfoDialog(true)}
                            leftIcon={<InformationCircleIcon className="h-4 w-4" />}
                            className="w-full"
                        >
                            Show Info
                        </Button>
                    </div>
                </section>

                {/* Dialog Features */}
                <section>
                    <h2 className="text-2xl font-semibold text-neutral-0 mb-6">
                        Dialog Features
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <h3 className="text-lg font-medium text-neutral-0">Key Features</h3>
                            <ul className="space-y-2 text-sm text-neutral-300">
                                <li>• Keyboard navigation (Tab, Escape)</li>
                                <li>• Focus management and trapping</li>
                                <li>• Backdrop blur overlay</li>
                                <li>• Smooth animations</li>
                                <li>• Mobile-responsive design</li>
                                <li>• Accessibility compliant</li>
                                <li>• Professional tactical styling</li>
                            </ul>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-lg font-medium text-neutral-0">Use Cases</h3>
                            <ul className="space-y-2 text-sm text-neutral-300">
                                <li>• Confirmation dialogs</li>
                                <li>• Form dialogs</li>
                                <li>• Content display</li>
                                <li>• Video upload progress</li>
                                <li>• User management</li>
                                <li>• Settings and preferences</li>
                                <li>• Data visualization</li>
                            </ul>
                        </div>
                    </div>
                </section>
            </div>

            {/* Pre-built Dialog Instances */}
            <ConfirmationDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Video"
                description="Are you sure you want to delete this video? This action cannot be undone and will remove the video from all user libraries."
                confirmText="Delete"
                confirmVariant="destructive"
                loading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteDialog(false)}
            />

            <FormDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                title="Create Category"
                description="Add a new category to organize your training content."
                size="lg"
                loading={isCreating}
                onSubmit={handleCreate}
                onCancel={() => setShowCreateDialog(false)}
            >
                <div className="space-y-4">
                    <Input
                        label="Category Name"
                        placeholder="e.g., Ground Fighting"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                    />
                    <Input
                        label="Description"
                        placeholder="Brief description of the category"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                </div>
            </FormDialog>

            <FormDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                title="Edit User"
                description="Update user information and permissions."
                size="lg"
                loading={isEditing}
                onSubmit={handleEdit}
                onCancel={() => setShowEditDialog(false)}
                scrollable
            >
                <div className="space-y-4">
                    <Input
                        label="Full Name"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                    />
                    <Input
                        label="Email Address"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                    />
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-0">Role</label>
                        <select className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-neutral-0 focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="user">Regular User</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-0">Subscription</label>
                        <select className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-neutral-0 focus:outline-none focus:ring-2 focus:ring-primary-500">
                            <option value="none">None</option>
                            <option value="beginner">Beginner ($9/month)</option>
                            <option value="intermediate">Intermediate ($19/month)</option>
                            <option value="advanced">Advanced ($49/month)</option>
                        </select>
                    </div>
                </div>
            </FormDialog>

            <ConfirmationDialog
                open={showWarningDialog}
                onOpenChange={setShowWarningDialog}
                title="Processing Warning"
                description="This video is still processing. Publishing now may result in poor quality. Are you sure you want to continue?"
                confirmText="Publish Anyway"
                confirmVariant="warning"
                onConfirm={() => {
                    setShowWarningDialog(false)
                    alert('Video published with warning!')
                }}
                onCancel={() => setShowWarningDialog(false)}
            />

            <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>
                            <div className="flex items-center gap-2">
                                <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                                System Information
                            </div>
                        </DialogTitle>
                        <DialogDescription>
                            Current system status and information
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium text-neutral-0">Video Storage</h4>
                                <p className="text-sm text-neutral-300">Cloudflare R2</p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-neutral-0">Streaming</h4>
                                <p className="text-sm text-neutral-300">Cloudflare Stream</p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-neutral-0">Database</h4>
                                <p className="text-sm text-neutral-300">Supabase PostgreSQL</p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="font-medium text-neutral-0">Authentication</h4>
                                <p className="text-sm text-neutral-300">Supabase Auth</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
} 