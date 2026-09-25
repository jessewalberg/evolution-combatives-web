# Evolution Combatives Web & Admin Dashboard

A Next.js 15 admin dashboard and trusted API boundary for the Evolution
Combatives mobile client. It manages content, subscriptions, protected
Cloudflare Stream playback, Stripe billing, and training analytics through
Supabase.

## 🎯 Overview

Evolution Combatives Admin Dashboard is a professional-grade content management system designed specifically for tactical training platforms. It enables administrators to:

- **Content Management**: Upload, organize, and manage training videos with Cloudflare Stream integration
- **User Administration**: Manage user accounts, subscriptions, and access permissions
- **Analytics & Insights**: Track engagement metrics, subscription analytics, and content performance
- **Q&A Management**: Moderate community questions and provide expert answers
- **Multi-tier Access Control**: Support for Beginner, Intermediate, and Advanced subscription tiers

## 🚀 Features

### Content Management
- **Video Library Management**: Upload, categorize, and organize training videos
- **Discipline & Category Organization**: Structured content hierarchy (Law Enforcement, Jiu Jitsu, Wrestling, Striking)
- **Instructor Profiles**: Manage instructor information and credentials
- **Cloudflare Stream Integration**: Professional video hosting and streaming
- **Processing Status Tracking**: Real-time video processing monitoring

### User & Subscription Management
- **User Administration**: Comprehensive user account management
- **Subscription Tiers**: Beginner ($19/mo), Intermediate ($29/mo), Advanced ($39/mo)
- **Stripe Integration**: Complete payment processing and subscription management
- **Access Control**: Role-based permissions (Super Admin, Content Admin, Support Admin, Combined Content/Support Admin)

### Analytics & Reporting
- **Dashboard Overview**: Key metrics and performance indicators
- **User Engagement**: Watch time, completion rates, and progress tracking
- **Revenue Analytics**: Subscription revenue and growth metrics
- **Content Performance**: Video views, popularity, and user feedback

### Technical Features
- **Modern Tech Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database**: Supabase with PostgreSQL
- **Real-time Updates**: Live data synchronization
- **Responsive Design**: Mobile-friendly admin interface
- **Performance Optimized**: TanStack Query for efficient data fetching

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Video Storage**: Cloudflare Stream
- **Payments**: Stripe
- **State Management**: TanStack Query, Zustand
- **Analytics**: PostHog
- **Deployment**: Vercel-ready

## 📦 Installation

### Prerequisites
- Node.js 22.22.2 (the repository default in `.nvmrc`; the additional supported
  ranges are declared in `package.json`)
- pnpm 9.15.0 (pinned by `packageManager`)
- Supabase account
- Cloudflare Stream account
- Stripe account

### Environment Setup

1. **Clone the repository**
```bash
git clone git@github.com:jessewalberg/evolution-combatives-web.git
cd evolution-combatives-web
```

2. **Activate the pinned runtime and package manager**
```bash
nvm use
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

3. **Install the locked dependency graph**
```bash
pnpm install --frozen-lockfile
```

4. **Configure environment variables**
```bash
cp .env.example .env.local
```

Use test/development credentials in `.env.local`. The complete template is
`.env.example`; the required names are:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_BEGINNER_PRICE_ID=price_your_beginner_price_id_here
STRIPE_INTERMEDIATE_PRICE_ID=price_your_intermediate_price_id_here
STRIPE_ADVANCED_PRICE_ID=price_your_advanced_price_id_here

# Cloudflare Stream Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_CUSTOMER_SUBDOMAIN=customer-your-stream-subdomain
CLOUDFLARE_STREAM_SIGNING_KEY_ID=your_stream_signing_key_id
CLOUDFLARE_STREAM_SIGNING_KEY=your_stream_signing_private_key
CLOUDFLARE_STREAM_WEBHOOK_SECRET=your_stream_webhook_secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3000
NEXT_PUBLIC_MOBILE_APP_SCHEME=evolutioncombatives
MOBILE_APP_SCHEMES=evolutioncombatives,evolutioncombatives-dev,evolutioncombatives-staging,evolutioncombatives-preview,evolutioncombatives-testflight

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_your_posthog_project_api_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Development Mode
NODE_ENV=development
```

`STRIPE_PUBLISHABLE_KEY` and the PostHog variables are documented in
`.env.example` for optional or deployment-specific features.
Confirm the three configured Stripe Price objects charge the documented
$19/$29/$39 monthly amounts before enabling checkout in an environment.
For authenticated E2E tests, create the gitignored `.env.test.local` described
in `e2e/README.md` and set `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` there.

5. **Set up database**

The timestamped files in `supabase/migrations` are the canonical migration
ledger for both the web and mobile applications. Link the CLI to a testing
project first, review the dry run, and only then promote the same migrations to
production:

```bash
supabase link --project-ref <testing-project-ref>
supabase db push --dry-run
supabase db push
```

Before applying `20260818000000_harden_profile_privileges_and_admin_policies.sql`,
audit existing non-null admin roles and paid profile tiers against your trusted
billing/admin records. The migration prevents future self-promotion, but it
cannot decide whether an already-stored privileged value is legitimate.
Regenerate shared database types from the linked project after migrations land.
Do not separately apply the historical migration copy in the mobile repository.

The mobile playback API now treats an active/trialing `subscriptions` row as
the entitlement source of truth. Before rollout, reconcile every legitimate
paid profile with its Stripe/App Store/Play subscription record; do not restore
the old client-controlled `profiles.subscription_tier` fallback.

6. **Start development server**
```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

## 🗄️ Database Schema

### Core Tables
- **profiles**: User accounts with admin roles and permissions
- **subscriptions**: Stripe subscription management
- **disciplines**: Training categories (Law Enforcement, Jiu Jitsu, etc.)
- **categories**: Sub-categories within disciplines
- **videos**: Training video metadata and processing status
- **instructors**: Instructor profiles and credentials
- **user_progress**: User engagement and completion tracking
- **questions/answers**: Q&A system for community support

### Subscription Tiers
- **Beginner** ($19/month): Basic content access
- **Intermediate** ($29/month): Advanced techniques and Q&A access
- **Advanced** ($39/month): Full platform access including law enforcement content

## 🎨 UI Components

The application uses a custom design system built with:
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives
- **Heroicons**: Professional iconography
- **Custom Components**: Stats cards, data tables, form controls

Key UI features:
- Dark/light mode support
- Responsive design
- Accessible form controls
- Professional data visualization

## 🔐 Authentication & Authorization

### Admin Roles
- **Super Admin**: Full system access
- **Content Admin**: Content management and analytics
- **Support Admin**: User management and Q&A moderation
- **Combined Content/Support Admin**: Content management plus user/support moderation

### Permissions System
```typescript
export const ADMIN_PERMISSIONS = {
    super_admin: ['admin.all'],
    content_admin: ['content.read', 'content.write', 'content.delete', 'users.read'],
    support_admin: ['users.read', 'support.read', 'support.write'],
    content_support_admin: ['content.read', 'content.write', 'content.delete', 'users.read', 'support.read', 'support.write']
}
```

## 🚀 Deployment

### Vercel Deployment
1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy with automatic CI/CD

### Manual Deployment
```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## 📊 Key Features Deep Dive

### Content Management Workflow
1. **Video Upload**: Drag-and-drop interface with progress tracking
2. **Processing**: Automatic Cloudflare Stream processing
3. **Categorization**: Assign to disciplines and categories
4. **Publication**: Review and publish to appropriate subscription tiers

### Analytics Dashboard
- Real-time user metrics
- Revenue tracking and growth analysis
- Content engagement statistics
- Subscription conversion rates

### User Management
- Comprehensive user profiles
- Subscription tier management
- Activity monitoring
- Support ticket resolution

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based auth
- **CSRF Protection**: Built-in CSRF token validation
- **Role-based Access Control**: Granular permission system
- **Input Validation**: Zod schema validation
- **API Security**: Rate limiting and request validation

## 📱 Mobile Integration

The admin dashboard integrates with the Evolution Combatives mobile app through:
- **Shared Database**: Unified content and user management
- **API Endpoints**: RESTful APIs for mobile app consumption
- **Real-time Sync**: Instant content updates across platforms

## 🧪 Development

### Available Scripts
```bash
pnpm dev          # Start development server with Turbopack
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm type-check   # Run TypeScript type checking
pnpm test         # Run the Vitest unit suite once
pnpm test:coverage # Run unit tests with coverage gates
pnpm test:e2e     # Run Chromium and WebKit E2E tests
```

Before opening a pull request, run the same local quality gates as CI:

```bash
pnpm lint
pnpm type-check
pnpm test:coverage
pnpm build
```

### Code Quality
- **TypeScript**: Full type safety
- **ESLint**: Code linting with Next.js rules
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality checks

### Testing Strategy
- Component testing with React Testing Library
- API endpoint testing
- Database integration testing
- End-to-end testing with Playwright

## 📚 API Documentation

### Content API
- `GET /api/content/videos` - List videos with filtering
- `POST /api/content/videos` - Create new video
- `PUT /api/content/videos/[id]` - Update video
- `DELETE /api/content/videos/[id]` - Delete video

### User Management API
- `GET /api/users` - List users with pagination
- `PUT /api/users/[id]` - Update user profile
- `POST /api/subscriptions/create-checkout` - Create Stripe checkout

### Video Processing API
- `POST /api/video/signed-url` - Get signed upload URL
- `GET /api/video-processing/get-processing` - Check processing status
- `POST /api/video-processing/sync-all` - Sync with Cloudflare

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Use conventional commit messages
- Maintain backwards compatibility
- Document API changes

## 📄 License

This project is proprietary software owned by Evolution Combatives. All rights reserved.

## 🆘 Support

For technical support or questions:
- Create an issue in the repository
- Contact the development team
- Review the documentation

---

**Built with ❤️ for tactical professionals and law enforcement training**
