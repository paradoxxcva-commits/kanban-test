-- Departments within organizations
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX departments_org_idx ON public.departments(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments: org members read" ON public.departments
  FOR SELECT TO authenticated
  USING (
    org_id = public.get_user_org(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "departments: admin manage" ON public.departments
  FOR ALL TO authenticated
  USING (
    public.is_org_admin(auth.uid(), org_id)
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), org_id)
    OR public.is_super_admin(auth.uid())
  );

-- User-department junction (many-to-many)
CREATE TABLE public.user_departments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, department_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_departments TO authenticated;
GRANT ALL ON public.user_departments TO service_role;
ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_departments: org members read" ON public.user_departments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND (d.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "user_departments: admin manage" ON public.user_departments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND (public.is_org_admin(auth.uid(), d.org_id) OR public.is_super_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND (public.is_org_admin(auth.uid(), d.org_id) OR public.is_super_admin(auth.uid()))
    )
  );

-- Board-department junction (which departments can see a board)
CREATE TABLE public.board_departments (
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (board_id, department_id)
);

GRANT SELECT, INSERT, DELETE ON public.board_departments TO authenticated;
GRANT ALL ON public.board_departments TO service_role;
ALTER TABLE public.board_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_departments: org members read" ON public.board_departments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_id
        AND (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
  );

CREATE POLICY "board_departments: admin manage" ON public.board_departments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_id
        AND (public.is_org_admin(auth.uid(), b.org_id) OR public.is_super_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = board_id
        AND (public.is_org_admin(auth.uid(), b.org_id) OR public.is_super_admin(auth.uid()))
    )
  );

-- Update boards RLS to support department-based access
DROP POLICY IF EXISTS "boards: org members read" ON public.boards;

CREATE POLICY "boards: org members read" ON public.boards
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      org_id = public.get_user_org(auth.uid())
      AND (
        -- Board has no department restrictions (visible to all org members)
        NOT EXISTS (SELECT 1 FROM public.board_departments WHERE board_id = id)
        -- User belongs to at least one of the board's departments
        OR EXISTS (
          SELECT 1 FROM public.board_departments bd
          JOIN public.user_departments ud ON ud.department_id = bd.department_id
          WHERE bd.board_id = id AND ud.user_id = auth.uid()
        )
        -- Org admin sees everything in their org
        OR public.is_org_admin(auth.uid(), org_id)
      )
    )
  );
