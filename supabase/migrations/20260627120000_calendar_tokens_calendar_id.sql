-- Добавить calendar_id в calendar_tokens для привязки к конкретному календарю
ALTER TABLE public.calendar_tokens ADD COLUMN calendar_id uuid REFERENCES public.calendars(id) ON DELETE SET NULL;

-- Уникальный токен на календарь (один токен = один календарь)
-- Оставляем уникальность на (user_id, calendar_id) чтобы каждый календарь имел свою ссылку
CREATE UNIQUE INDEX calendar_tokens_user_calendar_idx ON public.calendar_tokens(user_id, calendar_id) WHERE calendar_id IS NOT NULL;

-- Обновить policy: пользователь видит токены своих календарей
DROP POLICY IF EXISTS "calendar_tokens: own read" ON public.calendar_tokens;
CREATE POLICY "calendar_tokens: own read" ON public.calendar_tokens
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR calendar_id IN (
      SELECT id FROM public.calendars WHERE user_id = auth.uid()
    )
  );
