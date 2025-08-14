import { redirect } from 'next/navigation'

export default function HomePage() {
    // Redirect to dashboard as the main admin interface
    redirect('/dashboard')
} 