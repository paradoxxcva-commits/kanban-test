-- ============ TASK COMMENTS ============
-- Comments with optional file attachments for tasks

CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachment_url text,
  attachment_name text,
  attachment_size int,
  attachment_mime text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body IS NOT NULL OR attachment_url IS NOT NULL)
);

CREATE INDEX task_comments_task_idx ON public.task_comments(task_id);
CREATE INDEX task_comments_created_idx ON public.task_comments(task_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can read comments on tasks in their org's boards
CREATE POLICY "task_comments: read by board" ON public.task_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.tasks t
      JOIN public.boards b ON b.id = t.board_id
      WHERE t.id = task_id
        AND (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
  );

-- INSERT: author must be current user AND org member
CREATE POLICY "task_comments: insert own" ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS(
      SELECT 1 FROM public.tasks t
      JOIN public.boards b ON b.id = t.board_id
      WHERE t.id = task_id
        AND (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
  );

-- DELETE: only own comments
CREATE POLICY "task_comments: delete own" ON public.task_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid());
