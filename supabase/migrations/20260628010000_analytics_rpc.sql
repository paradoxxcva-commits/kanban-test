-- RPC: распределение задач по приоритетам
CREATE OR REPLACE FUNCTION public.tasks_by_priority(_days int DEFAULT 30)
RETURNS TABLE(priority text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(t.priority, 'normal') as priority, count(*)
  FROM public.tasks t
  JOIN public.boards b ON b.id = t.board_id
  WHERE (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    AND t.created_at >= now() - (_days || ' days')::interval
  GROUP BY priority
  ORDER BY CASE priority
    WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4
  END;
$$;
GRANT EXECUTE ON FUNCTION public.tasks_by_priority(int) TO authenticated;

-- RPC: нагрузка по исполнителям
CREATE OR REPLACE FUNCTION public.tasks_by_assignee(_days int DEFAULT 30)
RETURNS TABLE(assignee_id uuid, assignee_name text, total bigint, completed bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    t.assignee_id,
    COALESCE(p.full_name, p.email, 'Не назначен') as assignee_name,
    count(*) as total,
    count(*) FILTER (WHERE t.completed_at IS NOT NULL) as completed
  FROM public.tasks t
  JOIN public.boards b ON b.id = t.board_id
  LEFT JOIN public.profiles p ON p.id = t.assignee_id
  WHERE (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    AND t.created_at >= now() - (_days || ' days')::interval
  GROUP BY t.assignee_id, p.full_name, p.email
  HAVING count(*) > 0
  ORDER BY total DESC
  LIMIT 10;
$$;
GRANT EXECUTE ON FUNCTION public.tasks_by_assignee(int) TO authenticated;

-- RPC: просроченные задачи
CREATE OR REPLACE FUNCTION public.overdue_tasks_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.tasks t
  JOIN public.boards b ON b.id = t.board_id
  WHERE (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    AND t.due_date < now()
    AND t.completed_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.overdue_tasks_count() TO authenticated;

-- RPC: скорость закрытия (completion rate по дням)
CREATE OR REPLACE FUNCTION public.completion_rate_over_time(_days int DEFAULT 90)
RETURNS TABLE(bucket date, opened bigint, closed bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH days AS (
    SELECT generate_series(
      (now() - (_days || ' days')::interval)::date,
      now()::date,
      '1 day'::interval
    )::date as d
  ),
  opened AS (
    SELECT created_at::date as d, count(*) as c
    FROM public.tasks t
    JOIN public.boards b ON b.id = t.board_id
    WHERE (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
      AND t.created_at >= now() - (_days || ' days')::interval
    GROUP BY created_at::date
  ),
  closed AS (
    SELECT completed_at::date as d, count(*) as c
    FROM public.tasks t
    JOIN public.boards b ON b.id = t.board_id
    WHERE (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
      AND t.completed_at IS NOT NULL
      AND t.completed_at >= now() - (_days || ' days')::interval
    GROUP BY completed_at::date
  )
  SELECT days.d,
    COALESCE(opened.c, 0),
    COALESCE(closed.c, 0)
  FROM days
  LEFT JOIN opened ON opened.d = days.d
  LEFT JOIN closed ON closed.d = days.d
  ORDER BY days.d;
$$;
GRANT EXECUTE ON FUNCTION public.completion_rate_over_time(int) TO authenticated;

-- RPC: статистика по конкретной доске
CREATE OR REPLACE FUNCTION public.board_stats(_board_id uuid)
RETURNS TABLE(
  total bigint,
  completed bigint,
  overdue bigint,
  by_priority json,
  by_column json
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH t AS (
    SELECT * FROM public.tasks WHERE board_id = _board_id
  ),
  stats AS (
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE completed_at IS NOT NULL) as completed,
      count(*) FILTER (WHERE due_date < now() AND completed_at IS NULL) as overdue
    FROM t
  ),
  prio AS (
    SELECT json_object_agg(COALESCE(priority,'normal'), cnt) as by_priority
    FROM (SELECT COALESCE(priority,'normal') as priority, count(*) as cnt FROM t GROUP BY priority) sub
  ),
  cols AS (
    SELECT json_object_agg(bc.name, cnt) as by_column
    FROM public.board_columns bc
    LEFT JOIN t ON t.column_id = bc.id
    LEFT JOIN (
      SELECT column_id, count(*) as cnt FROM t GROUP BY column_id
    ) tc ON tc.column_id = bc.id
    WHERE bc.board_id = _board_id
  )
  SELECT s.total, s.completed, s.overdue, p.by_priority, c.by_column
  FROM stats s, prio p, cols c;
END;
$$;
GRANT EXECUTE ON FUNCTION public.board_stats(uuid) TO authenticated;
