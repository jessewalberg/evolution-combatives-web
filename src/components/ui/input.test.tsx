import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Input,
  InputError,
  SearchInput,
  PasswordInput,
} from './input'

describe('Input', () => {
  it('renders a textbox with placeholder', () => {
    render(<Input placeholder="Enter email" />)
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument()
  })

  it('associates label via htmlFor when id is provided', () => {
    render(<Input id="email" label="Email Address" />)
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
  })

  it('shows required indicator on label', () => {
    render(<Input id="name" label="Name" required />)
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('displays error message and hides helper text when error is set', () => {
    render(
      <Input
        label="Email"
        error="Please enter a valid email"
        helperText="We never share your email"
      />
    )
    expect(screen.getByText('Please enter a valid email')).toBeInTheDocument()
    expect(
      screen.queryByText('We never share your email')
    ).not.toBeInTheDocument()
  })

  it('displays helper text when no error', () => {
    render(<Input helperText="Optional hint" />)
    expect(screen.getByText('Optional hint')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is set', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Input disabled onChange={onChange} aria-label="Disabled field" />)
    const input = screen.getByLabelText('Disabled field')
    expect(input).toBeDisabled()
    await user.type(input, 'x')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts typed input', async () => {
    const user = userEvent.setup()
    render(<Input aria-label="Search" />)
    const input = screen.getByLabelText('Search')
    await user.type(input, 'tactics')
    expect(input).toHaveValue('tactics')
  })

  it('renders left and right icons', () => {
    render(
      <Input
        aria-label="With icons"
        leftIcon={<span data-testid="left">L</span>}
        rightIcon={<span data-testid="right">R</span>}
      />
    )
    expect(screen.getByTestId('left')).toBeInTheDocument()
    expect(screen.getByTestId('right')).toBeInTheDocument()
  })

  it.each(['sm', 'default', 'lg'] as const)('renders size=%s', (size) => {
    render(<Input size={size} aria-label={size} />)
    expect(screen.getByLabelText(size)).toBeInTheDocument()
  })
})

describe('InputError', () => {
  it('renders error children', () => {
    render(<InputError>Field is required</InputError>)
    expect(screen.getByText('Field is required')).toBeInTheDocument()
  })
})

describe('SearchInput', () => {
  it('renders as type=search', () => {
    render(<SearchInput aria-label="Search videos" />)
    expect(screen.getByLabelText('Search videos')).toHaveAttribute(
      'type',
      'search'
    )
  })

  it('shows clear button when value present and fires onClear', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <SearchInput
        aria-label="Search"
        showClearButton
        onClear={onClear}
      />
    )
    await user.type(screen.getByLabelText('Search'), 'abc')
    const clearButton = screen.getByRole('button')
    await user.click(clearButton)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('PasswordInput', () => {
  it('defaults to password type and toggles visibility', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="Password" />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button'))
    expect(input).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button'))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('hides toggle when showToggle is false', () => {
    render(<PasswordInput aria-label="Password" showToggle={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
