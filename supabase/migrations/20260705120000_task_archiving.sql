-- Task archiving: add archived_at column
ALTER TABLE public.tasks ADD COLUMN archived_at timestamptz;

CREATE INDEX idx_tasks_archived ON public.tasks(board_id) WHERE archived_at IS NOT NULL;
