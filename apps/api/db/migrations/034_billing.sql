-- Stripe billing fields on workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS plan              TEXT        NOT NULL DEFAULT 'free'
                                             CHECK (plan IN ('free','pro','enterprise')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT       UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT   UNIQUE,
  ADD COLUMN IF NOT EXISTS plan_expires_at   TIMESTAMPTZ;

COMMENT ON COLUMN workspaces.plan IS
  'Current subscription tier: free | pro | enterprise.';
COMMENT ON COLUMN workspaces.stripe_customer_id IS
  'Stripe Customer ID (cus_...) — one per tenant.';
COMMENT ON COLUMN workspaces.stripe_subscription_id IS
  'Active Stripe Subscription ID (sub_...).';
COMMENT ON COLUMN workspaces.plan_expires_at IS
  'When the current paid period ends (null = free or perpetual).';
