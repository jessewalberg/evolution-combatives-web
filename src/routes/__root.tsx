/// <reference types="vite/client" />
import * as React from 'react'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/src/providers/ThemeProvider'
import { DefaultCatchBoundary } from '@/src/components/router/DefaultCatchBoundary'
import { NotFound } from '@/src/components/router/NotFound'
import appCss from '@/src/styles/app.css?url'
import '@/src/lib/analytics-client'

export interface RouterAppContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
    head: () => ({
        meta: [
            { charSet: 'utf-8' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            { title: 'Evolution Combatives Admin' },
            {
                name: 'description',
                content: 'Admin dashboard for the Evolution Combatives tactical training platform.',
            },
        ],
        links: [{ rel: 'stylesheet', href: appCss }],
    }),
    errorComponent: DefaultCatchBoundary,
    notFoundComponent: () => <NotFound />,
    shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
    const { queryClient } = Route.useRouteContext()

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body className="font-sans" suppressHydrationWarning>
                <ThemeProvider defaultTheme="dark">
                    <QueryClientProvider client={queryClient}>
                        {children}
                        <Toaster position="top-right" expand={true} richColors closeButton theme="system" />
                        <ReactQueryDevtools initialIsOpen={false} />
                    </QueryClientProvider>
                </ThemeProvider>
                <TanStackRouterDevtools position="bottom-right" />
                <Scripts />
            </body>
        </html>
    )
}
