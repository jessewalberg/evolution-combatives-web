/**
 * next/link compat shim over the TanStack Router Link. Keeps the `href`
 * prop shape so ported components only need their import line changed.
 */

import * as React from 'react'
import { Link as RouterLink } from '@tanstack/react-router'

type LinkProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'href'> & {
    href: string
    prefetch?: boolean
    replace?: boolean
    scroll?: boolean
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
    { href, prefetch: _prefetch, replace, scroll: _scroll, children, ...rest },
    ref,
) {
    return (
        <RouterLink to={href as never} replace={replace} ref={ref} {...rest}>
            {children}
        </RouterLink>
    )
})

export default Link
