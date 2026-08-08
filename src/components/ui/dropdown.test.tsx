import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  ContentActionsDropdown,
  VideoActionsDropdown,
  UserActionsDropdown,
  SettingsDropdown,
} from './dropdown'

vi.mock('next/image', async () => {
  const { createNextImageMock } = await import('@/test/mocks/next-image')
  return createNextImageMock()
})

describe('DropdownMenu', () => {
  it('opens on trigger click and shows items', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Options</DropdownMenuLabel>
          <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actions' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('Options')).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>One</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('does not activate disabled items', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled onClick={onClick}>
            Disabled
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    const item = await screen.findByRole('menuitem', { name: 'Disabled' })
    expect(item).toBeDisabled()
    await user.click(item)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders item description and shortcut', async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem description="Edit the record" shortcut="⌘E">
            Edit
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(await screen.findByText('Edit the record')).toBeInTheDocument()
    expect(screen.getByText('⌘E')).toBeInTheDocument()
  })
})

describe('ContentActionsDropdown', () => {
  it('invokes edit and delete handlers', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<ContentActionsDropdown onEdit={onEdit} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Content actions' }))
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }))
    expect(onEdit).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Content actions' }))
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }))
    expect(onDelete).toHaveBeenCalled()
  })
})

describe('VideoActionsDropdown', () => {
  it('invokes preview and delete handlers', async () => {
    const user = userEvent.setup()
    const onPreview = vi.fn()
    const onDelete = vi.fn()
    render(
      <VideoActionsDropdown onPreview={onPreview} onDelete={onDelete} />
    )
    await user.click(screen.getByRole('button'))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Preview Video' })
    )
    expect(onPreview).toHaveBeenCalled()
  })
})

describe('UserActionsDropdown', () => {
  it('shows user name and fires logout', async () => {
    const user = userEvent.setup()
    const onLogout = vi.fn()
    render(
      <UserActionsDropdown
        user={{ name: 'Admin User', email: 'a@test.com', role: 'Super Admin' }}
        onLogout={onLogout}
      />
    )
    expect(screen.getByText('Admin User')).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByRole('menuitem', { name: /Sign Out/ }))
    expect(onLogout).toHaveBeenCalled()
  })
})

describe('SettingsDropdown', () => {
  it('opens and fires general settings', async () => {
    const user = userEvent.setup()
    const onGeneralSettings = vi.fn()
    render(<SettingsDropdown onGeneralSettings={onGeneralSettings} />)
    await user.click(screen.getByRole('button', { name: /Settings/ }))
    await user.click(await screen.findByRole('menuitem', { name: /General/ }))
    expect(onGeneralSettings).toHaveBeenCalled()
  })
})
