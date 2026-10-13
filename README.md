# Evolution Combatives - Admin Dashboard

A comprehensive admin dashboard for managing tactical training content, built with TanStack Start, TypeScript, and Supabase, deployed on Cloudflare Workers. This standalone application provides content administrators with powerful tools to manage video libraries, user subscriptions, and training analytics for law enforcement and tactical professionals.

## 🎯 Overview

Evolution Combatives Admin Dashboard is a professional-grade content management system designed specifically for tactical training platforms. It enables administrators to:

- **Content Management**: Upload, organize, and manage training videos with Cloudflare Stream integration
- **User Administration**: Manage user accounts, subscriptions, and access permissions
- **Analytics & Insights**: Track engagement metrics, subscription analytics, and content performance
- **Q&A Management**: Moderate community questions and provide expert answers
- **Multi-tier Access Control**: Support for three paid subscription tiers

## 🚀 Features

### Content Management
- **Video Library Management**: Upload, categorize, and organize training videos
- **Discipline & Category Organization**: Structured content hierarchy (Law Enforcement, Jiu Jitsu, Wrestling, Striking)
- **Instructor Profiles**: Manage instructor information and credentials
- **Cloudflare Stream Integration**: Professional video hosting and streaming
- **Processing Status Tracking**: Real-time video processing monitoring

### User & Subscription Management
- **User Administration**: Comprehensive user account management
- **Subscription Tiers**: Three paid access levels
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
- pnpm 9+ (see `package.json` for the pinned package manager version)
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

```env
# .env.local — client (inlined at build)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_APP_URL=http://localhost:3000
VITE_MOBILE_APP_SCHEME=evolutioncombatives

# PostHog Analytics
VITE_POSTHOG_KEY=phc_your_posthog_project_api_key_here
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

`.dev.vars` carries the server-side values (SUPABASE_SERVICE_ROLE_KEY,
STRIPE_*, CLOUDFLARE_* Stream credentials) — see `.dev.vars.example` for the
full list. In deployed environments these are wrangler.jsonc `vars` plus
`wrangler secret put` secrets per Worker.

4. **Set up database**
```bash
# Apply migrations to a local or staging Supabase project; see docs/GO-LIVE.md for production cutover
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

The current tier and feature definitions live in `src/lib/shared/constants/subscriptionTiers.ts`. Stripe price IDs are configured per Worker environment.

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
- **Content Admin**: Content management and user read access
- **Support Admin**: User read access and Q&A moderation

### Permissions System

The Worker enforces role permissions defined in `src/lib/api-auth.ts`. See [the release runbook](docs/GO-LIVE.md) for signed video and Q&A still-image access.

## 🚀 Deployment

### Cloudflare Workers Deployment
1. Follow [docs/GO-LIVE.md](docs/GO-LIVE.md). Replace the three `PLACEHOLDER_STRIPE_*` price ids and set Worker secrets before the production deploy.
2. The deploy workflow deploys `main` to production; the preview workflow uploads a preview version for pull requests. See [docs/GO-LIVE.md](docs/GO-LIVE.md) for the release procedure.

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

- **Supabase Authentication**: Cookie-based admin sessions
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
pnpm dev          # Start Vite dev server (Workers runtime via @cloudflare/vite-plugin)
pnpm build        # Build for production
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm typecheck    # Run TypeScript type checking
pnpm test:e2e     # Run Playwright end-to-end tests
```

### Code Quality
- **TypeScript**: Full type safety
- **ESLint**: Code linting (eslint 9 flat config + typescript-eslint)

### Testing Strategy

Release verification is build, typecheck, lint, and Playwright end-to-end tests. Unit tests are not part of this project.

## 📚 API Documentation

### Content API
- `GET /api/content/videos` - List videos with filtering
- `POST /api/content/videos` - Create new video
- `PUT /api/content/videos/[id]` - Update video
- `DELETE /api/content/videos/[id]` - Delete video

### User Administration
User administration is available in the dashboard under `/users`.

### Video API
- `POST /api/video/signed-url` - Get a signed playback URL
- `POST /api/mobile/video/signed-url` - Get a signed playback URL for the mobile app
- Both endpoints return a Stream playback URL with the signed token in place of the video ID.
- `GET /api/video-processing/get-processing` - Check processing status
- `POST /api/video-processing/sync-all` - Sync with Cloudflare

### Development Guidelines
- Follow TypeScript best practices
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
