import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, FormProvider } from 'react-hook-form'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormSection,
  FormActions,
  FormGrid,
} from './form'

type TestValues = { email: string; name: string }

function EmailForm({
  onSubmit,
}: {
  onSubmit: (values: TestValues) => void
}) {
  const form = useForm<TestValues>({
    defaultValues: { email: '', name: '' },
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField
          control={form.control}
          name="email"
          rules={{
            required: 'Email is required',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Enter a valid email',
            },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Email</FormLabel>
              <FormControl>
                <input {...field} aria-label="Email" />
              </FormControl>
              <FormDescription>We never share your email</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          rules={{ required: 'Name is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel optional>Name</FormLabel>
              <FormControl>
                <input {...field} aria-label="Name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  )
}

describe('Form field validation', () => {
  it('shows validation errors associated via aria-describedby', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<EmailForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const ids = describedBy!.split(' ')
    expect(ids.some((id) => document.getElementById(id)?.textContent?.includes('Email is required'))).toBe(true)
  })

  it('submits valid values', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<EmailForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), 'admin@test.com')
    await user.type(screen.getByLabelText('Name'), 'Admin')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { email: 'admin@test.com', name: 'Admin' },
        expect.anything()
      )
    })
  })

  it('shows pattern validation message for invalid email', async () => {
    const user = userEvent.setup()
    render(<EmailForm onSubmit={vi.fn()} />)
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Name'), 'Admin')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
  })

  it('renders FormDescription and optional label marker', () => {
    render(<EmailForm onSubmit={vi.fn()} />)
    expect(screen.getByText('We never share your email')).toBeInTheDocument()
    expect(screen.getByText('(Optional)')).toBeInTheDocument()
  })
})

describe('Form layout helpers', () => {
  it('FormSection renders title and description', () => {
    render(
      <FormSection title="Account" description="Basic profile fields">
        <div>fields</div>
      </FormSection>
    )
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByText('Basic profile fields')).toBeInTheDocument()
  })

  it('FormActions renders children with layout', () => {
    render(
      <FormActions layout="between">
        <button type="button">Cancel</button>
        <button type="submit">Save</button>
      </FormActions>
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('FormGrid renders children', () => {
    render(
      <FormGrid columns={2}>
        <div>Col A</div>
        <div>Col B</div>
      </FormGrid>
    )
    expect(screen.getByText('Col A')).toBeInTheDocument()
    expect(screen.getByText('Col B')).toBeInTheDocument()
  })

  it('Form applies loading semantics when loading', () => {
    function LoadingForm() {
      const form = useForm()
      return (
        <Form {...form} loading data-testid="form-root">
          <span>content</span>
        </Form>
      )
    }
    render(<LoadingForm />)
    const form = screen.getByTestId('form-root')
    expect(form).toHaveAttribute('aria-busy', 'true')
  })
})
