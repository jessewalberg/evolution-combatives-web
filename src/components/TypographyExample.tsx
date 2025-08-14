/**
 * Evolution Combatives Typography Examples
 * Demonstration of the professional typography component system
 */

import React from 'react'
import {
    H1,
    H2,
    H3,
    H4,
    Text,
    Label,
    Caption,
    Code,
    Link,
    Muted,
    ErrorText,
    SuccessText,
    Lead,
    Overline
} from './ui/typography'

export default function TypographyExample() {
    return (
        <div className="max-w-4xl mx-auto p-8 space-y-12 bg-neutral-900 text-neutral-0 min-h-screen">
            <div className="space-y-4">
                <H1 color="primary">Evolution Combatives Typography System</H1>
                <Lead color="secondary">
                    Professional typography components for tactical training administration
                </Lead>
            </div>

            {/* Heading Components */}
            <section className="space-y-6">
                <H2 color="brand">Heading Components</H2>

                <div className="space-y-4">
                    <div>
                        <H1>H1 - Main Page Headings</H1>
                        <Caption color="muted">36px, bold, tight line height</Caption>
                    </div>

                    <div>
                        <H2>H2 - Section Headings</H2>
                        <Caption color="muted">30px, semibold, tight line height</Caption>
                    </div>

                    <div>
                        <H3>H3 - Subsection Headings</H3>
                        <Caption color="muted">24px, semibold, snug line height</Caption>
                    </div>

                    <div>
                        <H4>H4 - Minor Headings</H4>
                        <Caption color="muted">20px, medium, snug line height</Caption>
                    </div>
                </div>
            </section>

            {/* Color Variants */}
            <section className="space-y-6">
                <H2 color="brand">Color Variants</H2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <H3 color="primary">Primary Colors</H3>
                        <div className="space-y-2">
                            <Text color="primary">Primary text (neutral-0)</Text>
                            <Text color="secondary">Secondary text (neutral-300)</Text>
                            <Text color="tertiary">Tertiary text (neutral-400)</Text>
                            <Text color="muted">Muted text (neutral-500)</Text>
                            <Text color="disabled">Disabled text (neutral-600)</Text>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <H3 color="brand">Semantic Colors</H3>
                        <div className="space-y-2">
                            <Text color="brand">Brand text (primary-600)</Text>
                            <Text color="success">Success text (success-500)</Text>
                            <Text color="warning">Warning text (warning-500)</Text>
                            <Text color="error">Error text (error-500)</Text>
                            <Text color="info">Info text (info-500)</Text>
                        </div>
                    </div>
                </div>
            </section>

            {/* Font Weights */}
            <section className="space-y-6">
                <H2 color="brand">Font Weights</H2>

                <div className="space-y-2">
                    <Text weight="normal">Normal weight text</Text>
                    <Text weight="medium">Medium weight text</Text>
                    <Text weight="semibold">Semibold weight text</Text>
                    <Text weight="bold">Bold weight text</Text>
                </div>
            </section>

            {/* Text Variants */}
            <section className="space-y-6">
                <H2 color="brand">Text Sizes</H2>

                <div className="space-y-4">
                    <div>
                        <Text variant="large">Large text variant (18px)</Text>
                        <Caption color="muted">Used for prominent body text and introductions</Caption>
                    </div>

                    <div>
                        <Text variant="base">Base text variant (16px)</Text>
                        <Caption color="muted">Standard body text for most content</Caption>
                    </div>

                    <div>
                        <Text variant="small">Small text variant (14px)</Text>
                        <Caption color="muted">Secondary information and metadata</Caption>
                    </div>

                    <div>
                        <Text variant="xs">Extra small text variant (12px)</Text>
                        <Caption color="muted">Captions, timestamps, and fine print</Caption>
                    </div>
                </div>
            </section>

            {/* Form Elements */}
            <section className="space-y-6">
                <H2 color="brand">Form Typography</H2>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Standard Label</Label>
                        <Text variant="small" color="secondary">Helper text for form fields</Text>
                    </div>

                    <div className="space-y-2">
                        <Label required>Required Field Label</Label>
                        <Text variant="small" color="secondary">Notice the red asterisk for required fields</Text>
                    </div>

                    <div className="space-y-2">
                        <Label color="muted">Muted Label</Label>
                        <Text variant="small" color="secondary">For less prominent form fields</Text>
                    </div>
                </div>
            </section>

            {/* Specialized Components */}
            <section className="space-y-6">
                <H2 color="brand">Specialized Components</H2>

                <div className="space-y-6">
                    {/* Links */}
                    <div className="space-y-3">
                        <H3>Links and Navigation</H3>
                        <div className="space-y-2">
                            <div>
                                <Link href="#" color="brand">Standard link with underline</Link>
                            </div>
                            <div>
                                <Link href="#" color="brand" underline={false}>Link without underline</Link>
                            </div>
                            <div>
                                <Link href="#" color="primary">Primary colored link</Link>
                            </div>
                        </div>
                    </div>

                    {/* Status Messages */}
                    <div className="space-y-3">
                        <H3>Status Messages</H3>
                        <div className="space-y-3">
                            <ErrorText>This is an error message with icon</ErrorText>
                            <ErrorText showIcon={false}>Error message without icon</ErrorText>
                            <SuccessText>Operation completed successfully</SuccessText>
                            <SuccessText showIcon={false}>Success message without icon</SuccessText>
                        </div>
                    </div>

                    {/* Code and Technical */}
                    <div className="space-y-3">
                        <H3>Code and Technical Content</H3>
                        <div className="space-y-3">
                            <Text>
                                Inline code: <Code>npm install</Code> or <Code>const result = api.getData()</Code>
                            </Text>

                            <div>
                                <Caption color="muted" className="mb-2 block">Code block example:</Caption>
                                <Code inline={false}>
                                    {`// Tactical training API endpoint
const uploadVideo = async (file: File) => {
  const formData = new FormData()
  formData.append('video', file)
  
  const response = await fetch('/api/videos', {
    method: 'POST',
    body: formData
  })
  
  return response.json()
}`}
                                </Code>
                            </div>
                        </div>
                    </div>

                    {/* Metadata and Labels */}
                    <div className="space-y-3">
                        <H3>Metadata and Labels</H3>
                        <div className="space-y-3">
                            <div>
                                <Overline>Category</Overline>
                                <Text variant="large" className="mt-1">Tactical Training Videos</Text>
                                <Caption color="secondary">Updated 2 hours ago</Caption>
                            </div>

                            <div>
                                <Overline color="brand">Status</Overline>
                                <Text variant="base" color="success" weight="medium" className="mt-1">Active</Text>
                                <Muted>All systems operational</Muted>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Real-world Examples */}
            <section className="space-y-6">
                <H2 color="brand">Real-world Examples</H2>

                <div className="space-y-8">
                    {/* Dashboard Card Content */}
                    <div className="p-6 bg-neutral-800 rounded-lg border border-neutral-700">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Overline color="brand">Analytics</Overline>
                                    <H3 className="mt-1">Video Performance</H3>
                                    <Caption color="secondary">Last 30 days</Caption>
                                </div>
                                <Text variant="large" color="success" weight="bold">+12.5%</Text>
                            </div>

                            <div className="space-y-2">
                                <Text variant="small" color="secondary">
                                    Total views increased significantly this month.
                                    <Link href="#" className="ml-1">View detailed report</Link>
                                </Text>

                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-neutral-400">Updated:</span>
                                    <Code>2024-01-15 14:30 UTC</Code>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Example */}
                    <div className="p-6 bg-neutral-800 rounded-lg border border-neutral-700">
                        <div className="space-y-4">
                            <H3>Upload Training Video</H3>
                            <Text color="secondary">
                                Add new tactical training content to the platform
                            </Text>

                            <div className="space-y-4">
                                <div>
                                    <Label required>Video Title</Label>
                                    <Text variant="small" color="secondary" className="mt-1">
                                        Choose a descriptive title for your training video
                                    </Text>
                                </div>

                                <div>
                                    <Label>Description</Label>
                                    <Text variant="small" color="secondary" className="mt-1">
                                        Optional detailed description of the training content
                                    </Text>
                                </div>

                                <SuccessText>Video uploaded successfully and is being processed</SuccessText>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
} 