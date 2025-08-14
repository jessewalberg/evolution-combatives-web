# Evolution Combatives - Admin Dashboard

A comprehensive admin dashboard for managing tactical training content, built with Next.js 15, TypeScript, and Supabase. This standalone application provides content administrators with powerful tools to manage video libraries, user subscriptions, and training analytics for law enforcement and tactical professionals.

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
- Node.js 18+ 
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
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_BEGINNER_PRICE_ID=price_your_beginner_price_id_here
STRIPE_INTERMEDIATE_PRICE_ID=price_your_intermediate_price_id_here
STRIPE_ADVANCED_PRICE_ID=price_your_advanced_price_id_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3000
NEXT_PUBLIC_MOBILE_APP_SCHEME=evolutioncombatives

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_your_posthog_project_api_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Development Mode
NODE_ENV=development
```

4. **Set up database**
```bash
# Run the database migrations
psql -h your-supabase-host -U postgres -d your-database -f migrations/setup-content-corrected.sql
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
