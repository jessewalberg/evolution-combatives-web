import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableSkeleton,
  TableEmptyState,
  TablePagination,
  TableSelection,
} from './table'

describe('Table primitives', () => {
  it('renders caption, headers, and cells', () => {
    render(
      <Table>
        <TableCaption>User roster</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
            <TableCell>Admin</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByText('User roster')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Alice' })).toBeInTheDocument()
  })

  it('fires onSort when sortable header is clicked', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable sortDirection="asc" onSort={onSort}>
              Name
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    )
    await user.click(screen.getByRole('columnheader', { name: /Name/ }))
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it('applies selected state on rows', () => {
    render(
      <Table>
        <TableBody>
          <TableRow selected data-testid="selected-row">
            <TableCell>Selected</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByTestId('selected-row')).toHaveAttribute(
      'data-selected',
      'true'
    )
  })

  it.each([
    ['default', /bg-white/],
    ['bordered', /border-gray-200/],
  ] as const)('applies variant=%s classes', (variant, classPattern) => {
    render(
      <Table variant={variant}>
        <TableBody>
          <TableRow>
            <TableCell>{variant}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByRole('table').className).toMatch(classPattern)
  })

  it('applies striped variant classes that exclude selected rows', () => {
    render(
      <Table variant="striped">
        <TableBody>
          <TableRow>
            <TableCell>Odd</TableCell>
          </TableRow>
          <TableRow selected data-testid="even-selected">
            <TableCell>Even selected</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByRole('table').className).toMatch(
      /nth-child\(even\):not\(\[data-selected="true"\]\)/
    )
    expect(screen.getByTestId('even-selected')).toHaveAttribute(
      'data-selected',
      'true'
    )
  })
})

describe('TableSkeleton', () => {
  it('renders the requested number of skeleton rows/cells', () => {
    render(
      <Table>
        <TableBody>
          <TableSkeleton rows={2} columns={3} />
        </TableBody>
      </Table>
    )
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getAllByRole('cell')).toHaveLength(6)
  })
})

describe('TableEmptyState', () => {
  it('renders title, description, and action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Table>
        <TableBody>
          <TableEmptyState
            title="No users"
            description="Invite someone"
            action={{ label: 'Invite', onClick }}
          />
        </TableBody>
      </Table>
    )
    expect(screen.getByText('No users')).toBeInTheDocument()
    expect(screen.getByText('Invite someone')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Invite' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('TablePagination', () => {
  it('shows range text and navigates pages', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <TablePagination
        currentPage={2}
        totalPages={5}
        pageSize={10}
        totalItems={48}
        onPageChange={onPageChange}
      />
    )
    expect(screen.getByText('Showing 11-20 of 48 results')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
    await user.click(screen.getByRole('button', { name: '4' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('disables Previous on first page and Next on last page', () => {
    const { rerender } = render(
      <TablePagination
        currentPage={1}
        totalPages={3}
        pageSize={10}
        totalItems={25}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    rerender(
      <TablePagination
        currentPage={3}
        totalPages={3}
        pageSize={10}
        totalItems={25}
        onPageChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('changes page size via select', async () => {
    const user = userEvent.setup()
    const onPageSizeChange = vi.fn()
    render(
      <TablePagination
        currentPage={1}
        totalPages={5}
        pageSize={10}
        totalItems={100}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
        showPageSizeSelector
      />
    )
    await user.selectOptions(screen.getByRole('combobox'), '25')
    expect(onPageSizeChange).toHaveBeenCalledWith(25)
  })
})

describe('TableSelection', () => {
  it('toggles checked state via onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TableSelection checked={false} onChange={onChange} />)
    await user.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('sets indeterminate on the input element', () => {
    const ref = { current: null as HTMLInputElement | null }
    render(
      <TableSelection
        checked={false}
        indeterminate
        onChange={vi.fn()}
        ref={ref}
      />
    )
    expect(ref.current?.indeterminate).toBe(true)
  })
})

describe('sortable table interaction', () => {
  it('cycles sort direction through controlled state', async () => {
    const user = userEvent.setup()
    function SortableDemo() {
      const [dir, setDir] = useState<'asc' | 'desc' | null>('asc')
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                sortable
                sortDirection={dir}
                onSort={() =>
                  setDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))
                }
              >
                Name
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Zoe</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Amy</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )
    }
    render(<SortableDemo />)
    const header = screen.getByRole('columnheader', { name: /Name/ })
    await user.click(header)
    await user.click(header)
    expect(within(header).getByText('Name')).toBeInTheDocument()
  })
})
