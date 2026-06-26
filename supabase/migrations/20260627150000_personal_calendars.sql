-- ============ PERSONAL CALENDARS ============
-- Add user_id to calendars for personal calendars (null = org calendar)

ALTER TABLE public.calendars ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX calendars_user_idx ON public.calendars(user_id);

-- Drop old policies
DROP POLICY IF EXISTS "calendars: org members read" ON public.calendars;
DROP POLICY IF EXISTS "calendars: admin manage" ON public.calendars;

-- SELECT: org members read org calendars, users read their own personal calendars, super_admin reads all
CREATE POLICY "calendars: read" ON public.calendars
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
    OR public.is_super_admin(auth.uid())
  );

-- INSERT: admin+ can create org calendars, any user can create personal calendars in their org
CREATE POLICY "calendars: insert" ON public.calendars
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id IS NULL
      AND (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), org_id))
    )
    OR (
      user_id = auth.uid()
      AND org_id = public.get_user_org(auth.uid())
    )
    OR public.is_super_admin(auth.uid())
  );

-- UPDATE: admin+ can update org calendars, users can update their own personal calendars
CREATE POLICY "calendars: update" ON public.calendars
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), org_id))
    )
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), org_id))
    )
    OR public.is_super_admin(auth.uid())
  );

-- DELETE: admin+ can delete org calendars, users can delete their own personal calendars
CREATE POLICY "calendars: delete" ON public.calendars
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), org_id))
    )
    OR public.is_super_admin(auth.uid())
  );
