# Evolution Combatives - Admin Dashboard

A comprehensive admin dashboard for managing tactical training content, built with TanStack Start, TypeScript, and Supabase, deployed on Cloudflare Workers. This standalone application provides content administrators with powerful tools to manage video libraries, user subscriptions, and training analytics for law enforcement and tactical professionals.

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
- **Subscription Tiers**: Beginner, Intermediate, and Advanced
- **Stripe Integration**: Complete payment processing and subscription management
- **Access Control**: Role-based permissions (Super Admin, Content Admin, Support Admin)

### Analytics & Reporting
- **Dashboard Overview**: Key metrics and performance indicators
- **User Engagement**: Watch time, completion rates, and progress tracking
- **Revenue Analytics**: Subscription revenue and growth metrics
- **Content Performance**: Video views, popularity, and user feedback

### Technical Features
- **Modern Tech Stack**: TanStack Start (Router + Query), React 19, TypeScript, Tailwind CSS v4
- **Database**: Supabase with PostgreSQL
- **Real-time Updates**: Live data synchronization
- **Responsive Design**: Mobile-friendly admin interface
- **Performance Optimized**: TanStack Query for efficient data fetching

## 🛠️ Tech Stack

- **Frontend**: TanStack Start (file-based routing, SSR on Cloudflare Workers), React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Video Storage**: Cloudflare Stream
- **Payments**: Stripe
- **State Management**: TanStack Query
- **Analytics**: PostHog
- **Deployment**: Cloudflare Workers via @cloudflare/vite-plugin + wrangler (production/staging/preview envs in wrangler.jsonc; GitHub Actions ci/deploy/preview workflows)

## 📦 Installation

### Prerequisites
- Node.js 22.22.2+ (or 24.15.0+, or 26+); see `package.json` `engines.node` 
- pnpm 11.7.0 (see `package.json` `packageManager`)
- Supabase account
- Cloudflare Stream account
- Stripe account

### Environment Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd evolution-combatives-admin-standalone
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Configure environment variables**

Two files, both gitignored (secrets live in 1Password via secretkit — see
`secrets.manifest.json`):

```bash
cp .env.example .env.local        # client-side VITE_* vars (Vite build/dev)
cp .dev.vars.example .dev.vars    # server-side Worker vars for local dev
```

Fill in both files using `.env.example` for client values and
`.dev.vars.example` for Worker values. In deployed environments, Worker
configuration comes from `wrangler.jsonc` vars and per-Worker secrets.

4. **Set up database**
```bash
# Apply the Supabase migrations
supabase db push   # migrations live in supabase/migrations/
```

5. **Start development server**
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
- **Beginner**: Basic content access
- **Intermediate**: Advanced techniques and Q&A access
- **Advanced**: Full platform access including law enforcement content

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

### Permissions System
```typescript
export const ADMIN_PERMISSIONS = {
    super_admin: ['manage_users', 'manage_content', 'manage_subscriptions', 'manage_admins', 'view_analytics', 'system_settings'],
    content_admin: ['manage_content', 'view_analytics', 'moderate_questions'],
    support_admin: ['manage_users', 'manage_subscriptions', 'moderate_questions']
}
```

## 🚀 Deployment

### Cloudflare Workers Deployment

This PR prepares the Worker but does not move production traffic. Merging to
`main` deploys the production Worker on its `workers.dev` address; the live
domains stay on their current host until the separate cutover.

#### Jesse's production cutover checklist

1. Confirm the production Cloudflare account in the deployment environment's
   `CLOUDFLARE_ACCOUNT_ID` secret and Worker name
   (`evolution-combatives-admin`) in `wrangler.jsonc`. Set every placeholder
   key in the production GitHub secrets to its live value:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `VITE_APP_URL`,
   `APP_URL`, `ADMIN_URL`, PostHog settings, Stream account and
   customer subdomain, **live** `STRIPE_PUBLISHABLE_KEY`, and all three **live**
   `STRIPE_*_PRICE_ID` values. The deployment build resolves these values and
   fails if one is missing. The deploy workflow uses the corresponding `VITE_`
   secrets for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_URL`, and `ADMIN_URL`
   when those four server aliases are absent. Set matching staging values in
   the preview GitHub secrets. The public
   app and admin URLs should point to `https://evolutioncombatives.com`.
   For manual `deploy:production` and `deploy:staging` commands, set
   `DEPLOY_VARS_JSON` to a JSON object with the selected environment's public
   variable values and set `CLOUDFLARE_ACCOUNT_ID` before running the command.
2. Populate the production Worker secrets from 1Password using
   `pnpm exec wrangler secret put <NAME>` for each name: `SUPABASE_SERVICE_ROLE_KEY`,
   **live** `STRIPE_SECRET_KEY`, **live** `STRIPE_WEBHOOK_SECRET`,
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_STREAM_SIGNING_KEY`,
   `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, and
   `CLOUDFLARE_STREAM_WEBHOOK_SECRET`. Keep these out of `vars` and source
   control. Confirm the live Stripe keys and price IDs belong to the same
   Stripe account.
3. Deploy and verify the Worker on its `workers.dev` address before switching
   traffic. Confirm sign-in, checkout creation with a live price, and the
   `/api/health` endpoint. Apply required Supabase migrations separately.
4. In a separate cutover change, attach `evolutioncombatives.com` and
   `www.evolutioncombatives.com` as Worker custom domains and point both DNS
   names to the Worker in Cloudflare. Verify HTTPS, page loads, and the API on
   both hostnames before ending the old host's traffic.
5. In the **live** Stripe dashboard, move the webhook endpoint from the
   disabled Vercel deployment to
   `https://evolutioncombatives.com/api/webhooks/stripe` on the Worker. Set its
   new signing secret as the Worker's `STRIPE_WEBHOOK_SECRET`, then send a test
   event and confirm delivery and subscription updates. Disable the old
   endpoint after the Worker endpoint succeeds.

### Local production build preview
```bash
pnpm build
pnpm preview
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

The mobile app opens `/subscribe` with `userId`, `email`, and `tier` query
parameters. The browser asks users to sign in when needed and checks that the
signed-in account matches the mobile account before starting checkout.

## 🧪 Development

### Available Scripts
```bash
pnpm dev          # Start Vite dev server (Workers runtime via @cloudflare/vite-plugin)
pnpm build        # Build for production
pnpm preview      # Preview the production build locally
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm typecheck    # Run TypeScript type checking
```

### Code Quality
- **TypeScript**: Full type safety
- **ESLint**: Code linting (eslint 9 flat config + typescript-eslint)

### Testing Strategy
- Component testing with React Testing Library
- API endpoint testing
- Database integration testing
- End-to-end testing with Playwright

## 📚 API Documentation

### Content API
- `GET /api/content/videos` - List videos with filtering
- `POST /api/content/videos` - Create new video
- `GET /api/content/videos/[id]` - Get a video

### Subscription API
- `POST /api/subscriptions/create-checkout` - Create checkout for an authenticated browser session with a CSRF token
- `POST /api/mobile/subscriptions/create-checkout` - Create checkout with mobile bearer authentication

Both checkout endpoints check for a non-terminal subscription and reject
checkout when one is found. Both reject checkout if the subscription list or
count cannot be verified, or if a conflicting payment still needs review.
An identical retry reuses a Stripe Checkout session only while Stripe reports
it open. Completed sessions are not returned, and expired sessions are retired
before a new attempt. A different tier, price, or callback URL cannot start
another session while the prior checkout attempt remains unresolved.

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
