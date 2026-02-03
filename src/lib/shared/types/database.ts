/**
 * Evolution Combatives - Database Types
 * 
 * GENERATED FROM SUPABASE - Do not manually edit the Database interface.
 * To regenerate: npm run db:types
 * 
 * Custom business logic types are added below the generated types.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            admin_activity: {
                Row: {
                    action: string
                    admin_id: string
                    created_at: string
                    details: Json | null
                    id: string
                }
                Insert: {
                    action: string
                    admin_id: string
                    created_at?: string
                    details?: Json | null
                    id?: string
                }
                Update: {
                    action?: string
                    admin_id?: string
                    created_at?: string
                    details?: Json | null
                    id?: string
                }
                Relationships: []
            }
            answers: {
                Row: {
                    admin_id: string
                    answer: string
                    created_at: string
                    id: string
                    question_id: string
                }
                Insert: {
                    admin_id: string
                    answer: string
                    created_at?: string
                    id?: string
                    question_id: string
                }
                Update: {
                    admin_id?: string
                    answer?: string
                    created_at?: string
                    id?: string
                    question_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "answers_question_id_fkey"
                        columns: ["question_id"]
                        isOneToOne: false
                        referencedRelation: "questions"
                        referencedColumns: ["id"]
                    },
                ]
            }
            bookmarks: {
                Row: {
                    created_at: string
                    id: string
                    notes: string | null
                    user_id: string
                    video_id: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    notes?: string | null
                    user_id: string
                    video_id: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    notes?: string | null
                    user_id?: string
                    video_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "bookmarks_video_id_fkey"
                        columns: ["video_id"]
                        isOneToOne: false
                        referencedRelation: "videos"
                        referencedColumns: ["id"]
                    },
                ]
            }
            categories: {
                Row: {
                    color: string | null
                    created_at: string
                    description: string | null
                    discipline_id: string
                    icon: string | null
                    id: string
                    is_active: boolean | null
                    name: string
                    slug: string
                    sort_order: number | null
                    subscription_tier_required: string | null
                    updated_at: string | null
                }
                Insert: {
                    color?: string | null
                    created_at?: string
                    description?: string | null
                    discipline_id: string
                    icon?: string | null
                    id?: string
                    is_active?: boolean | null
                    name: string
                    slug: string
                    sort_order?: number | null
                    subscription_tier_required?: string | null
                    updated_at?: string | null
                }
                Update: {
                    color?: string | null
                    created_at?: string
                    description?: string | null
                    discipline_id?: string
                    icon?: string | null
                    id?: string
                    is_active?: boolean | null
                    name?: string
                    slug?: string
                    sort_order?: number | null
                    subscription_tier_required?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "categories_discipline_id_fkey"
                        columns: ["discipline_id"]
                        isOneToOne: false
                        referencedRelation: "disciplines"
                        referencedColumns: ["id"]
                    },
                ]
            }
            disciplines: {
                Row: {
                    color: string | null
                    created_at: string
                    description: string | null
                    icon: string | null
                    id: string
                    image_url: string | null
                    is_active: boolean | null
                    name: string
                    slug: string
                    sort_order: number | null
                    subscription_tier_required: string | null
                    updated_at: string | null
                }
                Insert: {
                    color?: string | null
                    created_at?: string
                    description?: string | null
                    icon?: string | null
                    id?: string
                    image_url?: string | null
                    is_active?: boolean | null
                    name: string
                    slug: string
                    sort_order?: number | null
                    subscription_tier_required?: string | null
                    updated_at?: string | null
                }
                Update: {
                    color?: string | null
                    created_at?: string
                    description?: string | null
                    icon?: string | null
                    id?: string
                    image_url?: string | null
                    is_active?: boolean | null
                    name?: string
                    slug?: string
                    sort_order?: number | null
                    subscription_tier_required?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            instructors: {
                Row: {
                    avatar_url: string | null
                    bio: string | null
                    created_at: string | null
                    credentials: string[] | null
                    fts: unknown
                    full_name: string
                    id: string
                    is_active: boolean | null
                    specialties: string[] | null
                    updated_at: string | null
                    years_experience: number | null
                }
                Insert: {
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string | null
                    credentials?: string[] | null
                    fts?: unknown
                    full_name: string
                    id?: string
                    is_active?: boolean | null
                    specialties?: string[] | null
                    updated_at?: string | null
                    years_experience?: number | null
                }
                Update: {
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string | null
                    credentials?: string[] | null
                    fts?: unknown
                    full_name?: string
                    id?: string
                    is_active?: boolean | null
                    specialties?: string[] | null
                    updated_at?: string | null
                    years_experience?: number | null
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    admin_role: string | null
                    avatar_url: string | null
                    bio: string | null
                    created_at: string
                    email: string
                    full_name: string | null
                    id: string
                    last_active: string | null
                    last_activity_at: string | null
                    last_login_at: string | null
                    phone: string | null
                    subscription_tier: string | null
                    updated_at: string
                }
                Insert: {
                    admin_role?: string | null
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string
                    email: string
                    full_name?: string | null
                    id: string
                    last_active?: string | null
                    last_activity_at?: string | null
                    last_login_at?: string | null
                    phone?: string | null
                    subscription_tier?: string | null
                    updated_at?: string
                }
                Update: {
                    admin_role?: string | null
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string
                    email?: string
                    full_name?: string | null
                    id?: string
                    last_active?: string | null
                    last_activity_at?: string | null
                    last_login_at?: string | null
                    phone?: string | null
                    subscription_tier?: string | null
                    updated_at?: string
                }
                Relationships: []
            }
            questions: {
                Row: {
                    answered: boolean | null
                    created_at: string
                    id: string
                    question: string
                    user_id: string
                    video_id: string | null
                }
                Insert: {
                    answered?: boolean | null
                    created_at?: string
                    id?: string
                    question: string
                    user_id: string
                    video_id?: string | null
                }
                Update: {
                    answered?: boolean | null
                    created_at?: string
                    id?: string
                    question?: string
                    user_id?: string
                    video_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "questions_video_id_fkey"
                        columns: ["video_id"]
                        isOneToOne: false
                        referencedRelation: "videos"
                        referencedColumns: ["id"]
                    },
                ]
            }
            subscriptions: {
                Row: {
                    created_at: string
                    current_period_end: string | null
                    external_subscription_id: string
                    id: string
                    platform: string
                    status: string
                    tier: string
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    current_period_end?: string | null
                    external_subscription_id: string
                    id?: string
                    platform: string
                    status: string
                    tier: string
                    user_id: string
                }
                Update: {
                    created_at?: string
                    current_period_end?: string | null
                    external_subscription_id?: string
                    id?: string
                    platform?: string
                    status?: string
                    tier?: string
                    user_id?: string
                }
                Relationships: []
            }
            user_progress: {
                Row: {
                    bookmarked: boolean | null
                    completed: boolean | null
                    completion_date: string | null
                    id: string
                    last_watched_at: string | null
                    progress_percentage: number | null
                    progress_seconds: number | null
                    user_id: string
                    video_id: string
                }
                Insert: {
                    bookmarked?: boolean | null
                    completed?: boolean | null
                    completion_date?: string | null
                    id?: string
                    last_watched_at?: string | null
                    progress_percentage?: number | null
                    progress_seconds?: number | null
                    user_id: string
                    video_id: string
                }
                Update: {
                    bookmarked?: boolean | null
                    completed?: boolean | null
                    completion_date?: string | null
                    id?: string
                    last_watched_at?: string | null
                    progress_percentage?: number | null
                    progress_seconds?: number | null
                    user_id?: string
                    video_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_progress_video_id_fkey"
                        columns: ["video_id"]
                        isOneToOne: false
                        referencedRelation: "videos"
                        referencedColumns: ["id"]
                    },
                ]
            }
            video_access_logs: {
                Row: {
                    accessed_at: string
                    id: string
                    ip_address: unknown
                    subscription_tier: string
                    user_agent: string | null
                    user_id: string
                    video_id: string
                }
                Insert: {
                    accessed_at?: string
                    id?: string
                    ip_address?: unknown
                    subscription_tier: string
                    user_agent?: string | null
                    user_id: string
                    video_id: string
                }
                Update: {
                    accessed_at?: string
                    id?: string
                    ip_address?: unknown
                    subscription_tier?: string
                    user_agent?: string | null
                    user_id?: string
                    video_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "video_access_logs_video_id_fkey"
                        columns: ["video_id"]
                        isOneToOne: false
                        referencedRelation: "videos"
                        referencedColumns: ["id"]
                    },
                ]
            }
            videos: {
                Row: {
                    category_id: string
                    cloudflare_video_id: string
                    created_at: string
                    description: string | null
                    duration_seconds: number | null
                    file_size: number | null
                    fts: unknown
                    id: string
                    instructor_id: string | null
                    is_published: boolean | null
                    processing_status: string | null
                    slug: string | null
                    sort_order: number | null
                    tags: string[] | null
                    thumbnail_url: string | null
                    tier_required: string | null
                    title: string
                    updated_at: string | null
                    view_count: number | null
                }
                Insert: {
                    category_id: string
                    cloudflare_video_id: string
                    created_at?: string
                    description?: string | null
                    duration_seconds?: number | null
                    file_size?: number | null
                    fts?: unknown
                    id?: string
                    instructor_id?: string | null
                    is_published?: boolean | null
                    processing_status?: string | null
                    slug?: string | null
                    sort_order?: number | null
                    tags?: string[] | null
                    thumbnail_url?: string | null
                    tier_required?: string | null
                    title: string
                    updated_at?: string | null
                    view_count?: number | null
                }
                Update: {
                    category_id?: string
                    cloudflare_video_id?: string
                    created_at?: string
                    description?: string | null
                    duration_seconds?: number | null
                    file_size?: number | null
                    fts?: unknown
                    id?: string
                    instructor_id?: string | null
                    is_published?: boolean | null
                    processing_status?: string | null
                    slug?: string | null
                    sort_order?: number | null
                    tags?: string[] | null
                    thumbnail_url?: string | null
                    tier_required?: string | null
                    title?: string
                    updated_at?: string | null
                    view_count?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "videos_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_video_instructor_name: {
                Args: { p_instructor_id: string }
                Returns: string
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

// ============================================================================
// Utility Types (from Supabase)
// ============================================================================

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
}
    ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
}
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
}
    ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

// ============================================================================
// Business Logic Types (Custom)
// ============================================================================

// Core business types
export type SubscriptionTier = 'none' | 'tier1' | 'tier2' | 'tier3';
export type VideoDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type AdminRole = 'super_admin' | 'content_admin' | 'support_admin';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid';
export type ProcessingStatus = 'uploading' | 'processing' | 'ready' | 'error';

// Table row types for common use
export type Profile = Tables<'profiles'>;
export type Subscription = Tables<'subscriptions'>;
export type Discipline = Tables<'disciplines'>;
export type Category = Tables<'categories'>;
export type Instructor = Tables<'instructors'>;
export type Video = Tables<'videos'>;
export type UserProgress = Tables<'user_progress'>;
export type Bookmark = Tables<'bookmarks'>;
export type Question = Tables<'questions'>;
export type Answer = Tables<'answers'>;

// Insert types
export type ProfileInsert = TablesInsert<'profiles'>;
export type SubscriptionInsert = TablesInsert<'subscriptions'>;
export type DisciplineInsert = TablesInsert<'disciplines'>;
export type CategoryInsert = TablesInsert<'categories'>;
export type InstructorInsert = TablesInsert<'instructors'>;
export type VideoInsert = TablesInsert<'videos'>;
export type UserProgressInsert = TablesInsert<'user_progress'>;
export type BookmarkInsert = TablesInsert<'bookmarks'>;

// Update types
export type ProfileUpdate = TablesUpdate<'profiles'>;
export type SubscriptionUpdate = TablesUpdate<'subscriptions'>;
export type DisciplineUpdate = TablesUpdate<'disciplines'>;
export type CategoryUpdate = TablesUpdate<'categories'>;
export type InstructorUpdate = TablesUpdate<'instructors'>;
export type VideoUpdate = TablesUpdate<'videos'>;
export type UserProgressUpdate = TablesUpdate<'user_progress'>;
export type BookmarkUpdate = TablesUpdate<'bookmarks'>;

// Enhanced types with relationships
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

export type ProfileWithSubscription = Profile & {
    subscription?: Subscription;
};

// Subscription tier hierarchy for access control
export const SUBSCRIPTION_TIER_HIERARCHY: Record<SubscriptionTier, number> = {
    none: 0,
    tier1: 1,
    tier2: 2,
    tier3: 3,
};

export const TIER_RANK = SUBSCRIPTION_TIER_HIERARCHY;

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
