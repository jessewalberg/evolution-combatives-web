-- app/api/webhooks/stripe/route.ts and app/api/debug/sync-subscription/route.ts
-- write these columns to public.subscriptions on every Stripe subscription
-- event, but they were never migrated. Every real Stripe webhook delivery
-- has been failing (confirmed: 0 rows in production subscriptions, 0
-- profiles with a non-'none' subscription_tier). See #23 follow-up.

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS current_period_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- handleSubscriptionDeleted does .eq('stripe_subscription_id', ...).single(),
-- which throws if more than one row ever matches. NULLs (e.g. RevenueCat
-- rows) don't collide under a unique index.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
ON public.subscriptions USING btree (stripe_subscription_id);
