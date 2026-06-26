-- ============ CALENDARS ============
-- Multiple calendars per organization, managed by admin+

CREATE TABLE public.calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT 'brand',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calendars_org_idx ON public.calendars(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendars TO authenticated;
GRANT ALL ON public.calendars TO service_role;
ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read, admin+ can manage
CREATE POLICY "calendars: org members read" ON public.calendars
  FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "calendars: admin manage" ON public.calendars
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), org_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), org_id)
  );

-- ============ CALENDAR EVENTS ============
-- Events can be standalone or linked to a task

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calendar_events_calendar_idx ON public.calendar_events(calendar_id);
CREATE INDEX calendar_events_task_idx ON public.calendar_events(task_id);
CREATE INDEX calendar_events_time_idx ON public.calendar_events(start_time);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read events in their org's calendars
CREATE POLICY "calendar_events: org members read" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.calendars c
      WHERE c.id = calendar_id
        AND (c.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
  );

-- Admin+ can manage events in their org's calendars
CREATE POLICY "calendar_events: admin manage" ON public.calendar_events
  FOR ALL TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.calendars c
      WHERE c.id = calendar_id
        AND (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), c.org_id))
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.calendars c
      WHERE c.id = calendar_id
        AND (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), c.org_id))
    )
  );

-- Any authenticated user can CREATE events in org calendars (for "send task to calendar" feature)
CREATE POLICY "calendar_events: org members insert" ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.calendars c
      WHERE c.id = calendar_id
        AND (c.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
  );

-- Users can update/delete only their own events
CREATE POLICY "calendar_events: own events manage" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "calendar_events: own events delete" ON public.calendar_events
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
