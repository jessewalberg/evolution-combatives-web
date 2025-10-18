

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "ev-stripe";


ALTER SCHEMA "ev-stripe" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "ev_stripe";


ALTER SCHEMA "ev_stripe" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "stripe";


ALTER SCHEMA "stripe" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "wrappers" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert profile data using actual columns that exist
  INSERT INTO public.profiles (
    id, 
    email,
    subscription_tier,
    admin_role,
    last_active
  )
  VALUES (
    NEW.id, 
    NEW.email,
    'none', -- Default subscription tier
    NULL,   -- Not an admin by default
    NOW()   -- Set last_active to now
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE FOREIGN DATA WRAPPER "evolution_combatives_dev" HANDLER "extensions"."stripe_fdw_handler" VALIDATOR "extensions"."stripe_fdw_validator";




CREATE SERVER "evolution_combatives_dev_server" FOREIGN DATA WRAPPER "evolution_combatives_dev" OPTIONS (
    "api_key_id" 'ab0c530b-5699-4c07-9917-a95d97723106',
    "api_url" 'https://api.stripe.com/v1',
    "supabase_target_schema" 'ev_stripe'
);


ALTER SERVER "evolution_combatives_dev_server" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."accounts" (
    "id" "text",
    "business_type" "text",
    "country" "text",
    "email" "text",
    "type" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'accounts',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."accounts" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."balance" (
    "balance_type" "text",
    "amount" bigint,
    "currency" "text",
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'balance',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."balance" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."balance_transactions" (
    "id" "text",
    "amount" bigint,
    "currency" "text",
    "description" "text",
    "fee" bigint,
    "net" bigint,
    "status" "text",
    "type" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'balance_transactions',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."balance_transactions" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."billing_meters" (
    "id" "text",
    "display_name" "text",
    "event_name" "text",
    "event_time_window" "text",
    "status" "text",
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'billing/meters',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."billing_meters" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."charges" (
    "id" "text",
    "amount" bigint,
    "currency" "text",
    "customer" "text",
    "description" "text",
    "invoice" "text",
    "payment_intent" "text",
    "status" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'charges',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."charges" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."checkout_sessions" (
    "id" "text",
    "customer" "text",
    "payment_intent" "text",
    "subscription" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'checkout/sessions',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."checkout_sessions" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."customers" (
    "id" "text",
    "email" "text",
    "name" "text",
    "description" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'customers',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."customers" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."disputes" (
    "id" "text",
    "amount" bigint,
    "currency" "text",
    "charge" "text",
    "payment_intent" "text",
    "reason" "text",
    "status" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'disputes',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."disputes" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."events" (
    "id" "text",
    "type" "text",
    "api_version" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'events',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."events" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."file_links" (
    "id" "text",
    "file" "text",
    "url" "text",
    "created" timestamp without time zone,
    "expired" boolean,
    "expires_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'file_links',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."file_links" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."files" (
    "id" "text",
    "filename" "text",
    "purpose" "text",
    "title" "text",
    "size" bigint,
    "type" "text",
    "url" "text",
    "created" timestamp without time zone,
    "expires_at" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'files',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."files" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."invoices" (
    "id" "text",
    "customer" "text",
    "subscription" "text",
    "status" "text",
    "total" bigint,
    "currency" "text",
    "period_start" timestamp without time zone,
    "period_end" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'invoices',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."invoices" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."mandates" (
    "id" "text",
    "payment_method" "text",
    "status" "text",
    "type" "text",
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'mandates',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."mandates" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."payment_intents" (
    "id" "text",
    "customer" "text",
    "amount" bigint,
    "currency" "text",
    "payment_method" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'payment_intents',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."payment_intents" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."payouts" (
    "id" "text",
    "amount" bigint,
    "currency" "text",
    "arrival_date" timestamp without time zone,
    "description" "text",
    "statement_descriptor" "text",
    "status" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'payouts',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."payouts" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."prices" (
    "id" "text",
    "active" boolean,
    "currency" "text",
    "product" "text",
    "unit_amount" bigint,
    "type" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'prices',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."prices" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."products" (
    "id" "text",
    "name" "text",
    "active" boolean,
    "default_price" "text",
    "description" "text",
    "created" timestamp without time zone,
    "updated" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'products',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."products" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."refunds" (
    "id" "text",
    "amount" bigint,
    "currency" "text",
    "charge" "text",
    "payment_intent" "text",
    "reason" "text",
    "status" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'refunds',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."refunds" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."setup_attempts" (
    "id" "text",
    "application" "text",
    "customer" "text",
    "on_behalf_of" "text",
    "payment_method" "text",
    "setup_intent" "text",
    "status" "text",
    "usage" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'setup_attempts',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."setup_attempts" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."setup_intents" (
    "id" "text",
    "client_secret" "text",
    "customer" "text",
    "description" "text",
    "payment_method" "text",
    "status" "text",
    "usage" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'setup_intents',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."setup_intents" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."subscriptions" (
    "id" "text",
    "customer" "text",
    "currency" "text",
    "current_period_start" timestamp without time zone,
    "current_period_end" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'subscriptions',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."subscriptions" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."tokens" (
    "id" "text",
    "type" "text",
    "client_ip" "text",
    "used" boolean,
    "livemode" boolean,
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'tokens',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."tokens" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."topups" (
    "id" "text",
    "amount" bigint,
    "currency" "text",
    "description" "text",
    "status" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'topups',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."topups" OWNER TO "postgres";


CREATE FOREIGN TABLE "ev_stripe"."transfers" (
    "id" "text",
    "amount" bigint,
    "currency" "text",
    "description" "text",
    "destination" "text",
    "created" timestamp without time zone,
    "attrs" "jsonb"
)
SERVER "evolution_combatives_dev_server"
OPTIONS (
    "object" 'transfers',
    "rowid_column" 'id'
);


ALTER FOREIGN TABLE "ev_stripe"."transfers" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_activity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."admin_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "answer" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "discipline_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disciplines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "subscription_tier_required" "text" DEFAULT 'none'::"text",
    "is_active" boolean DEFAULT true,
    "slug" "text" NOT NULL,
    "color" "text" DEFAULT '#3B82F6'::"text",
    "icon" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "disciplines_subscription_tier_required_check" CHECK (("subscription_tier_required" = ANY (ARRAY['none'::"text", 'tier1'::"text", 'tier2'::"text", 'tier3'::"text"])))
);


ALTER TABLE "public"."disciplines" OWNER TO "postgres";


COMMENT ON COLUMN "public"."disciplines"."subscription_tier_required" IS 'Subscription tier required to access this discipline content';



COMMENT ON COLUMN "public"."disciplines"."is_active" IS 'Whether this discipline is active and visible to users';



COMMENT ON COLUMN "public"."disciplines"."slug" IS 'URL-friendly slug for the discipline';



COMMENT ON COLUMN "public"."disciplines"."color" IS 'Hex color code for the discipline theme';



COMMENT ON COLUMN "public"."disciplines"."icon" IS 'Icon identifier for the discipline';



COMMENT ON COLUMN "public"."disciplines"."updated_at" IS 'Timestamp when the discipline was last updated';



CREATE TABLE IF NOT EXISTS "public"."instructors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "bio" "text",
    "avatar_url" "text",
    "specialties" "text"[],
    "years_experience" integer,
    "credentials" "text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."instructors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "subscription_tier" "text" DEFAULT 'none'::"text",
    "admin_role" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_active" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "full_name" "text",
    "last_login_at" timestamp with time zone,
    "last_activity_at" timestamp with time zone,
    CONSTRAINT "profiles_admin_role_check" CHECK (("admin_role" = ANY (ARRAY['super_admin'::"text", 'content_admin'::"text", 'support_admin'::"text"]))),
    CONSTRAINT "profiles_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['none'::"text", 'basic'::"text", 'professional'::"text", 'lifetime'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "video_id" "uuid",
    "question" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "answered" boolean DEFAULT false
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "external_subscription_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "subscriptions_platform_check" CHECK (("platform" = ANY (ARRAY['revenuecat'::"text", 'stripe'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "video_id" "uuid" NOT NULL,
    "watched_seconds" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "bookmarked" boolean DEFAULT false,
    "last_watched" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."user_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "video_id" "uuid" NOT NULL,
    "accessed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "subscription_tier" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text"
);


ALTER TABLE "public"."video_access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."videos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "cloudflare_video_id" "text" NOT NULL,
    "duration_seconds" integer DEFAULT 0,
    "thumbnail_url" "text",
    "tier_required" "text" DEFAULT 'none'::"text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "instructor_id" "uuid",
    "slug" "text",
    "processing_status" "text" DEFAULT 'uploading'::"text",
    "is_published" boolean DEFAULT false,
    "tags" "text"[],
    "view_count" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "videos_tier_required_check" CHECK (("tier_required" = ANY (ARRAY['none'::"text", 'tier1'::"text", 'tier2'::"text", 'tier3'::"text"])))
);


ALTER TABLE "public"."videos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_activity"
    ADD CONSTRAINT "admin_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disciplines"
    ADD CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."instructors"
    ADD CONSTRAINT "instructors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_platform_key" UNIQUE ("user_id", "platform");



ALTER TABLE ONLY "public"."user_progress"
    ADD CONSTRAINT "user_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_progress"
    ADD CONSTRAINT "user_progress_user_id_video_id_key" UNIQUE ("user_id", "video_id");



ALTER TABLE ONLY "public"."video_access_logs"
    ADD CONSTRAINT "video_access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_video_access_logs_accessed_at" ON "public"."video_access_logs" USING "btree" ("accessed_at");



CREATE INDEX "idx_video_access_logs_user_id" ON "public"."video_access_logs" USING "btree" ("user_id");



CREATE INDEX "idx_video_access_logs_video_id" ON "public"."video_access_logs" USING "btree" ("video_id");



CREATE INDEX "idx_videos_processing_status" ON "public"."videos" USING "btree" ("processing_status");



CREATE INDEX "idx_videos_slug" ON "public"."videos" USING "btree" ("slug");



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_profiles" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."admin_activity"
    ADD CONSTRAINT "admin_activity_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_progress"
    ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_progress"
    ADD CONSTRAINT "user_progress_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_access_logs"
    ADD CONSTRAINT "video_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_access_logs"
    ADD CONSTRAINT "video_access_logs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



CREATE POLICY "Admin access only" ON "public"."admin_activity" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."admin_role" IS NOT NULL)))));



CREATE POLICY "Admins can manage categories" ON "public"."categories" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."admin_role" IS NOT NULL)))));



CREATE POLICY "Admins can manage disciplines" ON "public"."disciplines" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."admin_role" IS NOT NULL)))));



CREATE POLICY "Admins can manage instructors" ON "public"."instructors" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."admin_role" IS NOT NULL)))));



CREATE POLICY "Admins can manage videos" ON "public"."videos" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."admin_role" IS NOT NULL)))));



CREATE POLICY "Anyone can view categories" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Anyone can view disciplines" ON "public"."disciplines" FOR SELECT USING (true);



CREATE POLICY "Anyone can view instructors" ON "public"."instructors" FOR SELECT USING (true);



CREATE POLICY "Anyone can view published videos" ON "public"."videos" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Public read access" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Users can insert own progress" ON "public"."user_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own progress" ON "public"."user_progress" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own questions" ON "public"."questions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own logs" ON "public"."video_access_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own logs" ON "public"."video_access_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disciplines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."instructors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";





















GRANT ALL ON TABLE "public"."admin_activity" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity" TO "service_role";



GRANT ALL ON TABLE "public"."answers" TO "anon";
GRANT ALL ON TABLE "public"."answers" TO "authenticated";
GRANT ALL ON TABLE "public"."answers" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."disciplines" TO "anon";
GRANT ALL ON TABLE "public"."disciplines" TO "authenticated";
GRANT ALL ON TABLE "public"."disciplines" TO "service_role";



GRANT ALL ON TABLE "public"."instructors" TO "anon";
GRANT ALL ON TABLE "public"."instructors" TO "authenticated";
GRANT ALL ON TABLE "public"."instructors" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_progress" TO "service_role";



GRANT ALL ON TABLE "public"."video_access_logs" TO "anon";
GRANT ALL ON TABLE "public"."video_access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."video_access_logs" TO "service_role";



GRANT ALL ON TABLE "public"."videos" TO "anon";
GRANT ALL ON TABLE "public"."videos" TO "authenticated";
GRANT ALL ON TABLE "public"."videos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
