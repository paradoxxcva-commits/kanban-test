-- ENUM типов уведомлений
CREATE TYPE public.notification_type AS ENUM (
  'message', 'task_assigned', 'task_due_soon', 'comment', 'reminder'
);

-- Таблица уведомлений
CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type        public.notification_type NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  entity_id   uuid,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, is_read, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: own read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications: own insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications: own update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications: own delete" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Таблица настроек уведомлений
CREATE TABLE public.notification_preferences (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  message_enabled   boolean NOT NULL DEFAULT true,
  task_enabled      boolean NOT NULL DEFAULT true,
  comment_enabled   boolean NOT NULL DEFAULT true,
  reminder_enabled  boolean NOT NULL DEFAULT true,
  browser_push      boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs: own read" ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_prefs: own upsert" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RPC: создание уведомления (SECURITY DEFINER, проверяет偏好)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _org_id uuid,
  _type public.notification_type,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id uuid;
  prefs record;
BEGIN
  SELECT * INTO prefs FROM public.notification_preferences WHERE user_id = _user_id;
  IF prefs IS NULL THEN
    prefs := ROW(_user_id, true, true, true, true, true, now())::public.notification_preferences;
  END IF;

  CASE _type
    WHEN 'message' THEN IF NOT prefs.message_enabled THEN RETURN NULL; END IF;
    WHEN 'task_assigned','task_due_soon' THEN IF NOT prefs.task_enabled THEN RETURN NULL; END IF;
    WHEN 'comment' THEN IF NOT prefs.comment_enabled THEN RETURN NULL; END IF;
    WHEN 'reminder' THEN IF NOT prefs.reminder_enabled THEN RETURN NULL; END IF;
  END CASE;

  INSERT INTO public.notifications(user_id, org_id, type, title, body, link, entity_id)
  VALUES (_user_id, _org_id, _type, _title, _body, _link, _entity_id)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, public.notification_type, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, public.notification_type, text, text, text, uuid) TO service_role;

-- RPC: непрочитанные уведомления
CREATE OR REPLACE FUNCTION public.get_unread_notifications(_limit int DEFAULT 50)
RETURNS SETOF public.notifications LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.notifications
  WHERE user_id = auth.uid() AND is_read = false
  ORDER BY created_at DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_notifications(int) TO authenticated;

-- RPC: пометить как прочитанное
CREATE OR REPLACE FUNCTION public.mark_notification_read(_notif_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.notifications SET is_read = true
  WHERE id = _notif_id AND user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

-- RPC: пометить все как прочитанные
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.notifications SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- RPC: получить/создать偏好
CREATE OR REPLACE FUNCTION public.get_or_create_notification_prefs()
RETURNS public.notification_preferences LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prefs public.notification_preferences;
BEGIN
  SELECT * INTO prefs FROM public.notification_preferences WHERE user_id = auth.uid();
  IF prefs IS NULL THEN
    INSERT INTO public.notification_preferences(user_id) VALUES (auth.uid()) RETURNING * INTO prefs;
  END IF;
  RETURN prefs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_notification_prefs() TO authenticated;

-- RPC: обновить偏好
CREATE OR REPLACE FUNCTION public.update_notification_prefs(
  _message_enabled boolean DEFAULT NULL,
  _task_enabled boolean DEFAULT NULL,
  _comment_enabled boolean DEFAULT NULL,
  _reminder_enabled boolean DEFAULT NULL,
  _browser_push boolean DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notification_preferences(user_id) VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.notification_preferences SET
    message_enabled = COALESCE(_message_enabled, message_enabled),
    task_enabled = COALESCE(_task_enabled, task_enabled),
    comment_enabled = COALESCE(_comment_enabled, comment_enabled),
    reminder_enabled = COALESCE(_reminder_enabled, reminder_enabled),
    browser_push = COALESCE(_browser_push, browser_push),
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_notification_prefs(boolean, boolean, boolean, boolean, boolean) TO authenticated;
