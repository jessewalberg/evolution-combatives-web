/// <reference types="vite/client" />
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { createQueryClient } from './lib/query-client'
import { DefaultCatchBoundary } from './components/router/DefaultCatchBoundary'
import { NotFound } from './components/router/NotFound'

export function getRouter() {
    const queryClient = createQueryClient()

    const router = createRouter({
        routeTree,
        context: {
            queryClient,
        },
        defaultPreload: 'intent',
        defaultErrorComponent: DefaultCatchBoundary,
        defaultNotFoundComponent: () => <NotFound />,
        scrollRestoration: true,
    })

    setupRouterSsrQueryIntegration({ router, queryClient })

    return router
}

declare module '@tanstack/react-router' {
    interface Register {
        router: ReturnType<typeof getRouter>
    }
}
