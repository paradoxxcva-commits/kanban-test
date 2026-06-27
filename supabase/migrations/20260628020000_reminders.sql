-- Таблица напоминаний
CREATE TABLE public.task_reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remind_at     timestamptz NOT NULL,
  offset_hours  int NOT NULL DEFAULT 24,
  is_recurring  boolean NOT NULL DEFAULT false,
  recurrence    text,
  last_sent_at  timestamptz,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_reminders_active_idx ON public.task_reminders(remind_at) WHERE is_active = true;
CREATE INDEX task_reminders_task_idx ON public.task_reminders(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_reminders TO authenticated;
GRANT ALL ON public.task_reminders TO service_role;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_reminders: own read" ON public.task_reminders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "task_reminders: own insert" ON public.task_reminders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "task_reminders: own update" ON public.task_reminders
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "task_reminders: own delete" ON public.task_reminders
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RPC: создать напоминание
CREATE OR REPLACE FUNCTION public.create_task_reminder(
  _task_id uuid,
  _offset_hours int DEFAULT 24,
  _is_recurring boolean DEFAULT false,
  _recurrence text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  task_rec record;
  remind_at timestamptz;
  new_id uuid;
BEGIN
  SELECT id, due_date INTO task_rec FROM public.tasks WHERE id = _task_id;
  IF task_rec IS NULL THEN RAISE EXCEPTION 'Задача не найдена'; END IF;
  IF task_rec.due_date IS NULL THEN RAISE EXCEPTION 'У задачи нет срока'; END IF;

  remind_at := task_rec.due_date - (_offset_hours || ' hours')::interval;

  INSERT INTO public.task_reminders(task_id, user_id, remind_at, offset_hours, is_recurring, recurrence)
  VALUES (_task_id, auth.uid(), remind_at, _offset_hours, _is_recurring, _recurrence)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_task_reminder(uuid, int, boolean, text) TO authenticated;

-- RPC: получить напоминания задачи текущего пользователя
CREATE OR REPLACE FUNCTION public.get_task_reminders(_task_id uuid)
RETURNS SETOF public.task_reminders
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.task_reminders
  WHERE task_id = _task_id AND user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_task_reminders(uuid) TO authenticated;

-- RPC: удалить напоминание
CREATE OR REPLACE FUNCTION public.delete_task_reminder(_reminder_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.task_reminders WHERE id = _reminder_id AND user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.delete_task_reminder(uuid) TO authenticated;

-- pg_cron job: проверка напоминаний каждые 15 минут
SELECT cron.schedule(
  'check-task-reminders',
  '*/15 * * * *',
  $$
  DO $$
  DECLARE
    r record;
  BEGIN
    FOR r IN
      SELECT tr.*, t.title as task_title, t.due_date, t.board_id, p.org_id
      FROM public.task_reminders tr
      JOIN public.tasks t ON t.id = tr.task_id
      JOIN public.profiles p ON p.id = tr.user_id
      WHERE tr.is_active = true
        AND tr.remind_at <= now()
        AND (tr.last_sent_at IS NULL OR tr.last_sent_at < tr.remind_at)
    LOOP
      PERFORM public.create_notification(
        r.user_id,
        r.org_id,
        'reminder'::public.notification_type,
        'Напоминание: ' || r.task_title,
        'Срок выполнения: ' || to_char(r.due_date, 'DD.MM.YYYY HH24:MI'),
        '/boards/' || r.board_id,
        r.task_id
      );

      UPDATE public.task_reminders
      SET last_sent_at = now(),
          is_active = CASE
            WHEN is_recurring AND recurrence = 'weekly' THEN true
            WHEN is_recurring AND recurrence = 'monthly' THEN true
            ELSE false
          END,
          remind_at = CASE
            WHEN is_recurring AND recurrence = 'weekly' THEN remind_at + interval '7 days'
            WHEN is_recurring AND recurrence = 'monthly' THEN remind_at + interval '1 month'
            ELSE remind_at
          END
      WHERE id = r.id;
    END LOOP;
  END $$;
  $$
);
