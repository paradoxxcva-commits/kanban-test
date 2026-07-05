-- Update overdue_tasks_count to accept optional org_id filter
CREATE OR REPLACE FUNCTION public.overdue_tasks_count(_org_id uuid DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT count(*)
  FROM public.tasks t
  JOIN public.boards b ON b.id = t.board_id
  WHERE t.due_date < now()
    AND t.completed_at IS NULL
    AND t.archived_at IS NULL
    AND (_org_id IS NULL OR b.org_id = _org_id)
    AND (
      b.org_id = public.get_user_org(auth.uid())
      OR public.is_super_admin(auth.uid())
    );
$$;

-- Update tasks_completed_by_period to accept optional org_id filter
CREATE OR REPLACE FUNCTION public.tasks_completed_by_period(_days int, _org_id uuid DEFAULT NULL)
RETURNS TABLE(period text, created bigint, completed bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH bounds AS (
    SELECT
      (now() - (_days || ' days')::interval)::date AS start_date,
      now()::date AS end_date
  ),
  series AS (
    SELECT d::date AS day
    FROM bounds b, generate_series(b.start_date, b.end_date, '1 day'::interval) d
  )
  SELECT
    to_char(s.day, 'YYYY-MM-DD') AS period,
    coalesce(sum(CASE WHEN t.created_at::date = s.day THEN 1 END), 0) AS created,
    coalesce(sum(CASE WHEN t.completed_at::date = s.day THEN 1 END), 0) AS completed
  FROM series s
  LEFT JOIN public.tasks t ON
    (t.created_at::date = s.day OR t.completed_at::date = s.day)
    AND t.archived_at IS NULL
  LEFT JOIN public.boards b ON b.id = t.board_id
  WHERE (
    _org_id IS NULL AND (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    OR (b.org_id = _org_id)
  )
  GROUP BY s.day
  ORDER BY s.day;
$$;
