/**
 * Evolution Combatives Input Examples
 * Demonstration of the professional input component system
 */

import React from 'react'
import { Input, InputGroup, InputError, SearchInput, PasswordInput } from './ui/input'

export default function InputExample() {
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [search, setSearch] = React.useState('')
    const [hasError, setHasError] = React.useState(false)

    return (
        <div className="max-w-2xl mx-auto p-8 space-y-8 bg-neutral-900 text-neutral-0">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-neutral-0">
                    Evolution Combatives Input System
                </h1>
                <p className="text-neutral-300">
                    Professional input components for tactical training administration
                </p>
            </div>

            {/* Basic Inputs */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-0">Basic Inputs</h2>

                <Input
                    label="Email Address"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <Input
                    label="Full Name"
                    placeholder="Enter your full name"
                    helperText="This will be displayed on your profile"
                />

                <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    disabled
                />
            </div>

            {/* Input Variants */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-0">Input States</h2>

                <Input
                    label="Default State"
                    placeholder="Default input styling"
                />

                <Input
                    label="Error State"
                    placeholder="Input with validation error"
                    error="This field is required"
                />

                <Input
                    label="Success State"
                    placeholder="Validated input"
                    variant="success"
                />

                <Input
                    label="Disabled State"
                    placeholder="Cannot be edited"
                    disabled
                />
            </div>

            {/* Input Sizes */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-0">Input Sizes</h2>

                <Input
                    label="Small Size"
                    placeholder="Small input"
                    size="sm"
                />

                <Input
                    label="Default Size"
                    placeholder="Default input"
                    size="default"
                />

                <Input
                    label="Large Size"
                    placeholder="Large input"
                    size="lg"
                />
            </div>

            {/* Inputs with Icons */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-0">Inputs with Icons</h2>

                <Input
                    label="Email with Icon"
                    type="email"
                    placeholder="user@example.com"
                    leftIcon={
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                    }
                />

                <Input
                    label="URL with Icon"
                    type="url"
                    placeholder="https://example.com"
                    leftIcon={
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    }
                />
            </div>

            {/* Specialized Inputs */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-0">Specialized Inputs</h2>

                <SearchInput
                    label="Search Videos"
                    placeholder="Search for training videos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClear={() => setSearch('')}
                    showClearButton
                />

                <PasswordInput
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <PasswordInput
                    label="Password (No Toggle)"
                    placeholder="Enter your password"
                    showToggle={false}
                />
            </div>

            {/* Input Group Example */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-0">Input Groups</h2>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-0">
                        Server Configuration
                    </label>
                    <InputGroup className="grid grid-cols-2 gap-2">
                        <Input placeholder="Host" />
                        <Input placeholder="Port" type="number" />
                    </InputGroup>
                </div>
            </div>

            {/* Error Handling */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-neutral-0">Error Handling</h2>

                <div className="space-y-2">
                    <Input
                        label="Validation Example"
                        placeholder="Type 'error' to see validation"
                        onChange={(e) => setHasError(e.target.value === 'error')}
                        error={hasError ? 'This triggers an error state' : undefined}
                    />

                    <InputError>
                        This is a standalone error message component
                    </InputError>
                </div>
            </div>
        </div>
    )
} 