/**
 * Evolution Combatives - Unified Database Types
 * Comprehensive type definitions for both mobile app and admin dashboard
 * 
 * @description Database schema types generated from Supabase with business logic
 * @author Evolution Combatives
 */

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string;
                    full_name: string | null;
                    badge_number: string | null;
                    department: string | null;
                    rank: string | null;
                    avatar_url: string | null;
                    admin_role: 'super_admin' | 'content_admin' | 'support_admin' | null;
                    is_active: boolean;
                    last_login_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    full_name?: string | null;
                    badge_number?: string | null;
                    department?: string | null;
                    rank?: string | null;
                    avatar_url?: string | null;
                    admin_role?: 'super_admin' | 'content_admin' | 'support_admin' | null;
                    is_active?: boolean;
                    last_login_at?: string | null;
                };
                Update: {
                    id?: string;
                    email?: string;
                    full_name?: string | null;
                    badge_number?: string | null;
                    department?: string | null;
                    rank?: string | null;
                    avatar_url?: string | null;
                    admin_role?: 'super_admin' | 'content_admin' | 'support_admin' | null;
                    is_active?: boolean;
                    last_login_at?: string | null;
                    updated_at?: string;
                };
            };
            subscriptions: {
                Row: {
                    id: string;
                    user_id: string;
                    tier: 'none' | 'tier1' | 'tier2' | 'tier3';
                    status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
                    stripe_subscription_id: string | null;
                    stripe_customer_id: string | null;
                    current_period_start: string;
                    current_period_end: string;
                    cancel_at_period_end: boolean;
                    canceled_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    tier: 'none' | 'tier1' | 'tier2' | 'tier3';
                    status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
                    stripe_subscription_id?: string | null;
                    stripe_customer_id?: string | null;
                    current_period_start: string;
                    current_period_end: string;
                    cancel_at_period_end?: boolean;
                    canceled_at?: string | null;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    tier?: 'none' | 'tier1' | 'tier2' | 'tier3';
                    status?: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
                    stripe_subscription_id?: string | null;
                    stripe_customer_id?: string | null;
                    current_period_start?: string;
                    current_period_end?: string;
                    cancel_at_period_end?: boolean;
                    canceled_at?: string | null;
                    updated_at?: string;
                };
            };
            disciplines: {
                Row: {
                    id: string;
                    name: string;
                    slug: string;
                    description: string | null;
                    color: string;
                    icon: string | null;
                    subscription_tier_required: 'none' | 'tier1' | 'tier2' | 'tier3';
                    sort_order: number;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    slug: string;
                    description?: string | null;
                    color: string;
                    icon?: string | null;
                    subscription_tier_required: 'none' | 'tier1' | 'tier2' | 'tier3';
                    sort_order?: number;
                    is_active?: boolean;
                };
                Update: {
                    id?: string;
                    name?: string;
                    slug?: string;
                    description?: string | null;
                    color?: string;
                    icon?: string | null;
                    subscription_tier_required?: 'none' | 'tier1' | 'tier2' | 'tier3';
                    sort_order?: number;
                    is_active?: boolean;
                    updated_at?: string;
                };
            };
            categories: {
                Row: {
                    id: string;
                    discipline_id: string;
                    name: string;
                    slug: string;
                    description: string | null;
                    color: string;
                    icon: string | null;
                    subscription_tier_required: 'none' | 'tier1' | 'tier2' | 'tier3';
                    sort_order: number;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    discipline_id: string;
                    name: string;
                    slug: string;
                    description?: string | null;
                    color: string;
                    icon?: string | null;
                    subscription_tier_required: 'none' | 'tier1' | 'tier2' | 'tier3';
                    sort_order?: number;
                    is_active?: boolean;
                };
                Update: {
                    id?: string;
                    discipline_id?: string;
                    name?: string;
                    slug?: string;
                    description?: string | null;
                    color?: string;
                    icon?: string | null;
                    subscription_tier_required?: 'none' | 'tier1' | 'tier2' | 'tier3';
                    sort_order?: number;
                    is_active?: boolean;
                    updated_at?: string;
                };
            };
            instructors: {
                Row: {
                    id: string;
                    full_name: string;
                    bio: string | null;
                    avatar_url: string | null;
                    specialties: string[] | null;
                    years_experience: number | null;
                    credentials: string[] | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    full_name: string;
                    bio?: string | null;
                    avatar_url?: string | null;
                    specialties?: string[] | null;
                    years_experience?: number | null;
                    credentials?: string[] | null;
                    is_active?: boolean;
                };
                Update: {
                    id?: string;
                    full_name?: string;
                    bio?: string | null;
                    avatar_url?: string | null;
                    specialties?: string[] | null;
                    years_experience?: number | null;
                    credentials?: string[] | null;
                    is_active?: boolean;
                    updated_at?: string;
                };
            };
            videos: {
                Row: {
                    id: string;
                    title: string;
                    description: string | null;
                    slug: string;
                    category_id: string;
                    instructor_id: string | null;
                    cloudflare_video_id: string;
                    duration_seconds: number;
                    thumbnail_url: string | null;
                    tier_required: 'none' | 'tier1' | 'tier2' | 'tier3';
                    tags: string[] | null;
                    processing_status: 'uploading' | 'processing' | 'ready' | 'error';
                    is_published: boolean;
                    view_count: number;
                    sort_order: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    description?: string | null;
                    slug: string;
                    category_id: string;
                    instructor_id?: string | null;
                    cloudflare_video_id: string;
                    duration_seconds: number;
                    thumbnail_url?: string | null;
                    tier_required?: 'none' | 'tier1' | 'tier2' | 'tier3';
                    tags?: string[] | null;
                    processing_status?: 'uploading' | 'processing' | 'ready' | 'error';
                    is_published?: boolean;
                    view_count?: number;
                    sort_order?: number;
                };
                Update: {
                    id?: string;
                    title?: string;
                    description?: string | null;
                    slug?: string;
                    category_id?: string;
                    instructor_id?: string;
                    cloudflare_video_id?: string;
                    duration_seconds?: number;
                    thumbnail_url?: string | null;
                    tier_required?: 'none' | 'tier1' | 'tier2' | 'tier3';
                    tags?: string[] | null;
                    processing_status?: 'uploading' | 'processing' | 'ready' | 'error';
                    is_published?: boolean;
                    view_count?: number;
                    sort_order?: number;
                    updated_at?: string;
                };
            };
            user_progress: {
                Row: {
                    id: string;
                    user_id: string;
                    video_id: string;
                    progress_seconds: number;
                    progress_percentage: number;
                    completed: boolean;
                    last_watched_at: string;
                    completion_date: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    video_id: string;
                    progress_seconds: number;
                    progress_percentage: number;
                    completed?: boolean;
                    last_watched_at: string;
                    completion_date?: string | null;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    video_id?: string;
                    progress_seconds?: number;
                    progress_percentage?: number;
                    completed?: boolean;
                    last_watched_at?: string;
                    completion_date?: string | null;
                    updated_at?: string;
                };
            };
            questions: {
                Row: {
                    id: string;
                    user_id: string;
                    video_id: string | null;
                    title: string;
                    content: string;
                    status: 'pending' | 'answered' | 'closed';
                    is_public: boolean;
                    upvotes: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    video_id?: string | null;
                    title: string;
                    content: string;
                    status?: 'pending' | 'answered' | 'closed';
                    is_public?: boolean;
                    upvotes?: number;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    video_id?: string | null;
                    title?: string;
                    content?: string;
                    status?: 'pending' | 'answered' | 'closed';
                    is_public?: boolean;
                    upvotes?: number;
                    updated_at?: string;
                };
            };
            answers: {
                Row: {
                    id: string;
                    question_id: string;
                    user_id: string;
                    content: string;
                    is_instructor_answer: boolean;
                    upvotes: number;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    question_id: string;
                    user_id: string;
                    content: string;
                    is_instructor_answer?: boolean;
                    upvotes?: number;
                };
                Update: {
                    id?: string;
                    question_id?: string;
                    user_id?: string;
                    content?: string;
                    is_instructor_answer?: boolean;
                    upvotes?: number;
                    updated_at?: string;
                };
            };
            notifications: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string;
                    content: string;
                    type: 'system' | 'video' | 'question' | 'subscription' | 'achievement';
                    is_read: boolean;
                    action_url: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    title: string;
                    content: string;
                    type: 'system' | 'video' | 'question' | 'subscription' | 'achievement';
                    is_read?: boolean;
                    action_url?: string | null;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    title?: string;
                    content?: string;
                    type?: 'system' | 'video' | 'question' | 'subscription' | 'achievement';
                    is_read?: boolean;
                    action_url?: string | null;
                };
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            subscription_tier: 'tier1' | 'tier2' | 'tier3';
            admin_role: 'super_admin' | 'content_admin' | 'support_admin';
            subscription_status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
            video_difficulty: 'none' | 'tier1' | 'tier2' | 'tier3';
            processing_status: 'uploading' | 'processing' | 'ready' | 'error';
            question_status: 'pending' | 'answered' | 'closed';
            notification_type: 'system' | 'video' | 'question' | 'subscription' | 'achievement';
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
}

// Utility types for easier access
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Use database enum for subscription tiers to match the database schema
export type SubscriptionTier = 'none' | 'tier1' | 'tier2' | 'tier3';
export type AdminRole = 'super_admin' | 'content_admin' | 'support_admin';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
export type VideoDifficulty = 'none' | 'tier1' | 'tier2' | 'tier3';
export type ProcessingStatus = 'uploading' | 'processing' | 'ready' | 'error';
export type QuestionStatus = 'pending' | 'answered' | 'closed';
export type NotificationType = 'system' | 'video' | 'question' | 'subscription' | 'achievement';

// Table types for common use
export type Profile = Tables<'profiles'>;
export type Subscription = Tables<'subscriptions'>;
export type Discipline = Tables<'disciplines'>;
export type Category = Tables<'categories'>;
export type Instructor = Tables<'instructors'>;
export type Video = Tables<'videos'>;
export type UserProgress = Tables<'user_progress'>;
export type Question = Tables<'questions'>;
export type Answer = Tables<'answers'>;
export type Notification = Tables<'notifications'>;

// Insert types for database operations
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
export type DisciplineInsert = Database['public']['Tables']['disciplines']['Insert'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type InstructorInsert = Database['public']['Tables']['instructors']['Insert'];
export type VideoInsert = Database['public']['Tables']['videos']['Insert'];
export type UserProgressInsert = Database['public']['Tables']['user_progress']['Insert'];
export type QuestionInsert = Database['public']['Tables']['questions']['Insert'];
export type AnswerInsert = Database['public']['Tables']['answers']['Insert'];
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

// Update types for database operations
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];
export type DisciplineUpdate = Database['public']['Tables']['disciplines']['Update'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];
export type InstructorUpdate = Database['public']['Tables']['instructors']['Update'];
export type VideoUpdate = Database['public']['Tables']['videos']['Update'];
export type UserProgressUpdate = Database['public']['Tables']['user_progress']['Update'];
export type QuestionUpdate = Database['public']['Tables']['questions']['Update'];
export type AnswerUpdate = Database['public']['Tables']['answers']['Update'];
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update'];

// Enhanced types with relationships for application use
export type VideoWithRelations = Video & {
    category?: Category & {
        discipline?: Discipline;
    };
    instructor?: Instructor;
    user_progress?: UserProgress[];
};

export type CategoryWithRelations = Category & {
    discipline?: Discipline;
    videos?: Video[];
};

export type DisciplineWithRelations = Discipline & {
    categories?: Category[];
};

export type QuestionWithRelations = Question & {
    user?: Profile;
    video?: Video;
    answers?: (Answer & {
        user?: Profile;
    })[];
};

export type ProfileWithSubscription = Profile & {
    subscription?: Subscription;
};

export type UserWithProgress = Profile & {
    subscription?: Subscription;
    progress?: UserProgress[];
    questions?: Question[];
};

// Note: Subscription tier constants are defined in ../constants/subscriptionTiers.ts

// Admin role permissions
export const ADMIN_PERMISSIONS = {
    super_admin: [
        'manage_users',
        'manage_content',
        'manage_subscriptions',
        'manage_admins',
        'view_analytics',
        'system_settings',
    ],
    content_admin: [
        'manage_content',
        'view_analytics',
        'moderate_questions',
    ],
    support_admin: [
        'manage_users',
        'manage_subscriptions',
        'moderate_questions',
    ],
} as const;

// Content access rules based on subscription tiers
export const CONTENT_ACCESS_RULES = {
    beginner: ['basic_martial_arts', 'fundamentals'],
    intermediate: ['basic_martial_arts', 'fundamentals', 'advanced_techniques', 'instructor_qa'],
    advanced: ['basic_martial_arts', 'fundamentals', 'advanced_techniques', 'instructor_qa', 'law_enforcement', 'exclusive'],
} as const;

// Video processing status flow
export const VIDEO_PROCESSING_FLOW = {
    uploading: ['processing', 'error'],
    processing: ['ready', 'error'],
    ready: ['processing'], // Can reprocess if needed
    error: ['uploading', 'processing'], // Can retry
} as const;
