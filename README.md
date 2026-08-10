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
- **Subscription Tiers**: Beginner ($9/mo), Intermediate ($19/mo), Advanced ($49/mo)
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
- pnpm 7+
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
- **Beginner** ($9/month): Basic content access
- **Intermediate** ($19/month): Advanced techniques and Q&A access
- **Advanced** ($49/month): Full platform access including law enforcement content

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
1. Fill in the real values in `wrangler.jsonc` `vars` (currently TODO placeholders) and set Worker secrets with `wrangler secret put`
2. Deploy: `pnpm deploy:staging` or `pnpm deploy:production` (CI deploys main → production and PRs → preview versions automatically)
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
pnpm dev          # Start Vite dev server (Workers runtime via @cloudflare/vite-plugin)
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm type-check   # Run TypeScript type checking
```

### Code Quality
- **TypeScript**: Full type safety
- **ESLint**: Code linting (eslint 9 flat config + typescript-eslint)
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
