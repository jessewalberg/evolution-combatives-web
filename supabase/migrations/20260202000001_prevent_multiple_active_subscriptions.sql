-- Prevent multiple active/trialing subscriptions per user
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_active_unique
ON subscriptions (user_id)
WHERE status IN ('active', 'trialing');
