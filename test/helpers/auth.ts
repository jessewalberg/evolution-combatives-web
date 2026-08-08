import { NextResponse } from 'next/server'
import type { Mock } from 'vitest'

export interface AuthSuccessUser {
  userId?: string
  role?: string
  email?: string
}

/**
 * Configure a mocked `validateApiAuthWithSession` (or `validateApiAuth`) to
 * resolve successfully. Pass the `vi.mocked(...)` mock for the function
 * under test - this helper does not import or mock it itself, since
 * `vi.mock` calls must live in the test file for hoisting to work.
 */
export function authSuccess(mockAuth: Mock, user: AuthSuccessUser = {}): void {
  mockAuth.mockResolvedValue({
    user: {
      userId: user.userId ?? 'u1',
      role: user.role ?? 'content_admin',
      email: user.email ?? 'admin@test.com',
    },
  })
}

/**
 * Configure a mocked `validateApiAuthWithSession` (or `validateApiAuth`) to
 * resolve with an auth failure response of the given status.
 */
export function authFail(mockAuth: Mock, status: 401 | 403): void {
  mockAuth.mockResolvedValue({
    error: NextResponse.json({ success: false, error: 'denied' }, { status }),
  })
}
