/**
 * Evolution Combatives Theme Example - Tailwind CSS 4 Integration
 * Demonstrates the complete design system in action
 * 
 * @description Example component showcasing tactical design patterns
 * @author Evolution Combatives
 */

import * as React from 'react'
import { tw, componentClasses } from '../theme'

export default function ThemeExample() {
    return (
        <div className={componentClasses.layout.page}>
            <div className={componentClasses.layout.container}>

                {/* Header Section */}
                <header className="py-12">
                    <h1 className={tw.heading.h1}>Evolution Combatives</h1>
                    <p className={`${tw.body.large} mt-4 ${tw.text.secondary}`}>
                        Professional tactical training design system powered by Tailwind CSS 4
                    </p>
                </header>

                {/* Typography Examples */}
                <section className="mb-12">
                    <h2 className={`${tw.heading.h2} mb-6`}>Typography System</h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className={tw.heading.h3}>Heading Styles</h3>
                            <h4 className={tw.heading.h4}>H4 Heading Example</h4>
                            <h5 className={tw.heading.h5}>H5 Heading Example</h5>
                            <h6 className={tw.heading.h6}>H6 Heading Example</h6>
                        </div>
                        <div>
                            <h3 className={`${tw.heading.h3} mb-2`}>Body Text</h3>
                            <p className={tw.body.large}>Large body text for important content and lead paragraphs.</p>
                            <p className={tw.body.base}>Base body text for general content and descriptions.</p>
                            <p className={tw.body.small}>Small body text for secondary information.</p>
                            <p className={tw.body.xs}>Extra small text for captions and metadata.</p>
                        </div>
                    </div>
                </section>

                {/* Color Examples */}
                <section className="mb-12">
                    <h2 className={`${tw.heading.h2} mb-6`}>Color System</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Brand Colors */}
                        <div className={componentClasses.card.default}>
                            <h3 className={`${tw.heading.h4} mb-4`}>Brand Colors</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary-600 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Primary</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary-500 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Primary Light</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary-800 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Primary Dark</span>
                                </div>
                            </div>
                        </div>

                        {/* Semantic Colors */}
                        <div className={componentClasses.card.default}>
                            <h3 className={`${tw.heading.h4} mb-4`}>Semantic Colors</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-success-500 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Success</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-warning-500 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Warning</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-error-500 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Error</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-info-500 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Info</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gold-500 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Gold</span>
                                </div>
                            </div>
                        </div>

                        {/* Background Colors */}
                        <div className={componentClasses.card.default}>
                            <h3 className={`${tw.heading.h4} mb-4`}>Background Colors</h3>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-neutral-900 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Primary</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-neutral-800 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Secondary</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-neutral-700 rounded border border-neutral-700"></div>
                                    <span className={tw.body.small}>Elevated</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Button Examples */}
                <section className="mb-12">
                    <h2 className={`${tw.heading.h2} mb-6`}>Button System</h2>
                    <div className="flex flex-wrap gap-4">
                        <button className={`${componentClasses.button.primary} px-4 py-2`}>
                            Primary Button
                        </button>
                        <button className={`${componentClasses.button.secondary} px-4 py-2`}>
                            Secondary Button
                        </button>
                        <button className={`${componentClasses.button.success} px-4 py-2`}>
                            Success Button
                        </button>
                        <button className={`${componentClasses.button.warning} px-4 py-2`}>
                            Warning Button
                        </button>
                        <button className={`${componentClasses.button.error} px-4 py-2`}>
                            Error Button
                        </button>
                    </div>
                </section>

                {/* Card Examples */}
                <section className="mb-12">
                    <h2 className={`${tw.heading.h2} mb-6`}>Card System</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className={componentClasses.card.default}>
                            <h3 className={`${tw.heading.h4} mb-2`}>Default Card</h3>
                            <p className={tw.body.base}>Standard card with elevation and border.</p>
                        </div>
                        <div className={`${componentClasses.card.default} shadow-lg`}>
                            <h3 className={`${tw.heading.h4} mb-2`}>Elevated Card</h3>
                            <p className={tw.body.base}>Higher elevation for important content.</p>
                        </div>
                        <div className={`${componentClasses.card.default} hover:shadow-xl transition-shadow`}>
                            <h3 className={`${tw.heading.h4} mb-2`}>Interactive Card</h3>
                            <p className={tw.body.base}>Hover effects for clickable cards.</p>
                        </div>
                    </div>
                </section>

                {/* Form Examples */}
                <section className="mb-12">
                    <h2 className={`${tw.heading.h2} mb-6`}>Form System</h2>
                    <div className={componentClasses.card.default}>
                        <form className="space-y-4">
                            <div>
                                <label className={`block ${tw.text.secondary} mb-2`}>Default Input</label>
                                <input
                                    type="text"
                                    placeholder="Enter text..."
                                    className={componentClasses.input.default}
                                />
                            </div>
                            <div>
                                <label className={`block ${tw.text.secondary} mb-2`}>Success Input</label>
                                <input
                                    type="text"
                                    placeholder="Valid input..."
                                    className={componentClasses.input.success}
                                />
                            </div>
                            <div>
                                <label className={`block ${tw.text.secondary} mb-2`}>Error Input</label>
                                <input
                                    type="text"
                                    placeholder="Invalid input..."
                                    className={componentClasses.input.error}
                                />
                            </div>
                        </form>
                    </div>
                </section>

                {/* Shadow Examples */}
                <section className="mb-12">
                    <h2 className={`${tw.heading.h2} mb-6`}>Shadow System</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((level) => (
                            <div
                                key={level}
                                className={`p-4 bg-neutral-800 rounded-lg ${tw.shadow[`elevation${level}` as keyof typeof tw.shadow]} text-center`}
                            >
                                <span className={tw.body.small}>Level {level}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Subscription Tier Examples */}
                <section className="mb-12">
                    <h2 className={`${tw.heading.h2} mb-6`}>Subscription Tiers</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className={`${componentClasses.card.default} text-center`}>
                            <div className="w-12 h-12 bg-success-500 rounded-full mx-auto mb-3"></div>
                            <h3 className={`${tw.heading.h5} mb-2`}>Beginner</h3>
                            <p className={tw.body.small}>$9/month</p>
                        </div>
                        <div className={`${componentClasses.card.default} text-center`}>
                            <div className="w-12 h-12 bg-primary-500 rounded-full mx-auto mb-3"></div>
                            <h3 className={`${tw.heading.h5} mb-2`}>Intermediate</h3>
                            <p className={tw.body.small}>$19/month</p>
                        </div>
                        <div className={`${componentClasses.card.default} text-center`}>
                            <div className="w-12 h-12 bg-gold-500 rounded-full mx-auto mb-3"></div>
                            <h3 className={`${tw.heading.h5} mb-2`}>Advanced</h3>
                            <p className={tw.body.small}>$49/month</p>
                        </div>
                        <div className={`${componentClasses.card.default} text-center`}>
                            <div className="w-12 h-12 bg-neutral-500 rounded-full mx-auto mb-3"></div>
                            <h3 className={`${tw.heading.h5} mb-2`}>None</h3>
                            <p className={tw.body.small}>No subscription</p>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="py-8 border-t border-neutral-700">
                    <p className={`${tw.body.small} ${tw.text.tertiary} text-center`}>
                        Evolution Combatives Design System - Professional tactical training interface
                    </p>
                </footer>

            </div>
        </div>
    )
} 