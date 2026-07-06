-- Push subscriptions for browser push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions: own only" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Add calendar reminder minutes preference
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS calendar_reminder_minutes int NOT NULL DEFAULT 15;
