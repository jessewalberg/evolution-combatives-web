/**
 * Deterministic fixture data for the visual regression suite.
 * Fixed UUIDs and timestamps keep screenshots stable across runs.
 */

export const FIXTURE_TS = '2024-01-15T12:00:00.000Z'
export const FIXTURE_TS_MS = Date.parse(FIXTURE_TS)

export const FIXTURE_IDS = {
  adminUser: '00000000-0000-4000-8000-000000000001',
  regularUser: '00000000-0000-4000-8000-000000000002',
  discipline: '00000000-0000-4000-8000-000000000010',
  category: '00000000-0000-4000-8000-000000000011',
  video: '00000000-0000-4000-8000-000000000020',
  question: '00000000-0000-4000-8000-000000000030',
  subscription: '00000000-0000-4000-8000-000000000040',
  cloudflareId: 'cf-stream-video-0001',
} as const

/** Desktop / mobile viewports used by every visual spec. */
export const VISUAL_VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

export type VisualViewportName = (typeof VISUAL_VIEWPORTS)[number]['name']

export const adminProfileFixture = {
  id: FIXTURE_IDS.adminUser,
  email: 'admin@test.evolutioncombatives.com',
  full_name: 'Test Super Admin',
  admin_role: 'super_admin' as const,
  is_active: true,
  last_login_at: FIXTURE_TS,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: FIXTURE_TS,
  badge_number: null,
  department: null,
  rank: null,
  avatar_url: null,
  subscription_tier: null,
  last_active: FIXTURE_TS,
}

export const regularUserFixture = {
  id: FIXTURE_IDS.regularUser,
  email: 'officer@test.evolutioncombatives.com',
  full_name: 'Jane Officer',
  admin_role: null,
  is_active: true,
  last_login_at: FIXTURE_TS,
  created_at: '2024-01-10T00:00:00.000Z',
  updated_at: FIXTURE_TS,
  badge_number: 'B-1042',
  department: 'Metro PD',
  rank: 'Officer',
  avatar_url: null,
  subscription_tier: 'tier2',
  last_active: FIXTURE_TS,
}

export const disciplineFixture = {
  id: FIXTURE_IDS.discipline,
  name: 'Law Enforcement',
  slug: 'law-enforcement',
  description: 'LE training modules',
  color: '#2563EB',
  subscription_tier_required: 'none',
  sort_order: 1,
  is_active: true,
  created_at: FIXTURE_TS,
  updated_at: FIXTURE_TS,
  categories: [
    {
      id: FIXTURE_IDS.category,
      name: 'Ground Control',
      videos: [],
    },
  ],
}

export const categoryFixture = {
  id: FIXTURE_IDS.category,
  discipline_id: FIXTURE_IDS.discipline,
  name: 'Ground Control',
  slug: 'ground-control',
  description: 'Ground techniques',
  color: '#6B7280',
  subscription_tier_required: 'none',
  sort_order: 1,
  is_active: true,
  created_at: FIXTURE_TS,
  updated_at: FIXTURE_TS,
}

export const videoFixture = {
  id: FIXTURE_IDS.video,
  title: 'Defensive Tactics Module 1',
  description: 'Intro module for defensive tactics',
  slug: 'defensive-tactics-1',
  category_id: FIXTURE_IDS.category,
  cloudflare_video_id: FIXTURE_IDS.cloudflareId,
  duration_seconds: 600,
  thumbnail_url: null,
  tier_required: 'tier2' as const,
  tags: ['tactics', 'fundamentals'],
  processing_status: 'ready' as const,
  is_published: true,
  view_count: 120,
  sort_order: 1,
  created_at: FIXTURE_TS,
  updated_at: FIXTURE_TS,
  category: {
    id: FIXTURE_IDS.category,
    name: 'Ground Control',
    disciplines: {
      id: FIXTURE_IDS.discipline,
      name: 'Law Enforcement',
    },
  },
}

export const processingVideoFixture = {
  ...videoFixture,
  id: '00000000-0000-4000-8000-000000000021',
  title: 'Combat Fitness Week 1',
  slug: 'combat-fitness-week-1',
  processing_status: 'processing' as const,
  is_published: false,
  processing_progress: 45,
  processing_started_at: FIXTURE_TS,
  estimated_completion_at: '2024-01-15T12:30:00.000Z',
  processing_logs: [
    {
      id: '00000000-0000-4000-8000-000000000022',
      video_id: '00000000-0000-4000-8000-000000000021',
      timestamp: FIXTURE_TS,
      level: 'info',
      message: 'Transcoding started',
    },
  ],
}

export const dashboardMetricsFixture = {
  totalUsers: 150,
  totalUsersGrowth: 8.5,
  activeSubscriptions: 89,
  monthlyRevenue: 2147,
  revenueGrowth: 12.5,
  totalVideos: 42,
  videosThisMonth: 3,
  avgEngagementTime: 0,
  engagementGrowth: 8.3,
  processingVideos: 2,
  pendingQA: 5,
  systemAlerts: 2,
}

export const questionFixture = {
  id: FIXTURE_IDS.question,
  title: 'Firearm retention question',
  content: 'When should I transition to retention techniques?',
  question: 'When should I transition to retention techniques?',
  status: 'pending',
  priority: 'medium',
  category: 'Firearms',
  video_id: FIXTURE_IDS.video,
  video_timestamp: 120,
  upvotes: 3,
  user_id: FIXTURE_IDS.regularUser,
  created_at: FIXTURE_TS,
  updated_at: FIXTURE_TS,
  user: {
    id: FIXTURE_IDS.regularUser,
    full_name: 'Jane Officer',
    email: 'officer@test.evolutioncombatives.com',
    subscription_tier: 'tier2',
    created_at: '2024-01-10T00:00:00.000Z',
    last_sign_in_at: FIXTURE_TS,
  },
  video: {
    id: FIXTURE_IDS.video,
    title: 'Defensive Tactics Module 1',
    description: 'Intro module for defensive tactics',
    thumbnail_url: null,
    stream_url: null,
    duration: 600,
    category: {
      name: 'Ground Control',
      discipline: {
        name: 'Law Enforcement',
      },
    },
  },
  answers: [],
}

export const subscriptionFixture = {
  id: FIXTURE_IDS.subscription,
  user_id: FIXTURE_IDS.regularUser,
  tier: 'tier2',
  status: 'active',
  current_period_start: '2024-01-01T00:00:00.000Z',
  current_period_end: '2024-02-01T00:00:00.000Z',
  created_at: '2024-01-01T00:00:00.000Z',
  canceled_at: null,
}
