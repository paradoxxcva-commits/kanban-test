-- Per-user ad visibility toggle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_ads boolean NOT NULL DEFAULT true;
