-- Add is_done flag to calendar events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;
