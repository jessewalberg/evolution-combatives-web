import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  Overline,
} from './typography'

describe('Heading components', () => {
  it('renders H1–H4 with correct heading levels', () => {
    render(
      <>
        <H1>Page Title</H1>
        <H2>Section</H2>
        <H3>Subsection</H3>
        <H4>Minor</H4>
      </>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Page Title' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Section' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Subsection' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: 'Minor' })).toBeInTheDocument()
  })

  it('applies color prop to H1', () => {
    render(<H1 color="error">Danger</H1>)
    expect(screen.getByRole('heading', { name: 'Danger' })).toBeInTheDocument()
  })
})

describe('Text components', () => {
  it.each(['large', 'base', 'small', 'xs'] as const)(
    'Text renders variant=%s',
    (variant) => {
      render(<Text variant={variant}>{variant} text</Text>)
      expect(screen.getByText(`${variant} text`)).toBeInTheDocument()
    }
  )

  it('Text can render as span via as prop', () => {
    const { container } = render(<Text as="span">Inline</Text>)
    expect(container.querySelector('span')).toHaveTextContent('Inline')
  })

  it('Label associates with control and shows required marker', () => {
    render(
      <>
        <Label htmlFor="field" required>
          Email
        </Label>
        <input id="field" />
      </>
    )
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
  })

  it('Caption renders uppercase when requested', () => {
    render(<Caption uppercase>Meta</Caption>)
    expect(screen.getByText('Meta')).toBeInTheDocument()
  })

  it('Code renders inline by default and block when inline=false', () => {
    const { rerender } = render(<Code>const x = 1</Code>)
    expect(screen.getByText('const x = 1').tagName.toLowerCase()).toBe('code')
    rerender(<Code inline={false}>block code</Code>)
    expect(screen.getByText('block code').tagName.toLowerCase()).toBe('pre')
  })
})

describe('specialized typography', () => {
  it('Link renders an accessible anchor', () => {
    render(
      <Link href="/docs" underline>
        Documentation
      </Link>
    )
    expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
      'href',
      '/docs'
    )
  })

  it('Muted, Lead, and Overline render text', () => {
    render(
      <>
        <Muted>Quiet</Muted>
        <Lead>Intro paragraph</Lead>
        <Overline>Category</Overline>
      </>
    )
    expect(screen.getByText('Quiet')).toBeInTheDocument()
    expect(screen.getByText('Intro paragraph')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
  })

  it('ErrorText and SuccessText show icons by default', () => {
    const { container } = render(
      <>
        <ErrorText>Invalid input</ErrorText>
        <SuccessText>Saved</SuccessText>
      </>
    )
    expect(screen.getByText('Invalid input')).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2)
  })

  it('ErrorText can hide icon', () => {
    const { container } = render(
      <ErrorText showIcon={false}>No icon</ErrorText>
    )
    expect(screen.getByText('No icon')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})
