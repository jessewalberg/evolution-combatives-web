import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  FormDialog,
} from './dialog'
import { Button } from './button'

describe('Dialog', () => {
  it('opens from trigger and shows title/description', async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Video</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Dialog' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Delete Video' })).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('closes via Escape key', async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Escapable</DialogTitle>
          <DialogDescription>Press escape to close</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes via the close button', async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Closeable</DialogTitle>
          <DialogDescription>Use the X button</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('supports controlled open state', async () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Controlled</DialogTitle>
          <DialogDescription>Controlled dialog</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Controlled</DialogTitle>
          <DialogDescription>Controlled dialog</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('can hide the close button', async () => {
    render(
      <Dialog open onOpenChange={vi.fn()}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>No close</DialogTitle>
          <DialogDescription>No X button</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })
})

describe('ConfirmationDialog', () => {
  it('calls onConfirm and supports cancel', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmationDialog
        open
        onOpenChange={onOpenChange}
        title="Delete Video"
        description="Are you sure?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables actions while loading', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmationDialog
        open
        onOpenChange={vi.fn()}
        title="Deleting"
        description="Please wait"
        loading
        onConfirm={onConfirm}
      />
    )
    const confirm = await screen.findByRole('button', { name: /Confirm/ })
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('FormDialog', () => {
  it('submits the form and cancels', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const onCancel = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <FormDialog
        open
        onOpenChange={onOpenChange}
        title="Create Category"
        description="Add a new category"
        submitText="Save"
        onSubmit={onSubmit}
        onCancel={onCancel}
      >
        <input aria-label="Name" name="name" defaultValue="Jiu Jitsu" />
      </FormDialog>
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('disables submit when submitDisabled or loading', () => {
    render(
      <FormDialog
        open
        onOpenChange={vi.fn()}
        title="Form"
        onSubmit={vi.fn()}
        submitDisabled
        loading
      >
        <span>fields</span>
      </FormDialog>
    )
    expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled()
  })
})
