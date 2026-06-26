-- ============ RBAC: Role-Gated RLS Policies ============
-- This migration tightens RLS on boards and board_columns so that
-- only admin+ (org admin or super_admin) can create/modify/delete them.
-- Regular users can still READ boards but cannot create/delete them.

-- ============ New helper: is_org_member ============
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = _user_id AND org_id = _org_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;

-- ============ BOARDS: Drop overly permissive write policies ============
DROP POLICY IF EXISTS "boards: org members write" ON public.boards;
DROP POLICY IF EXISTS "boards: org members update" ON public.boards;
DROP POLICY IF EXISTS "boards: org members delete" ON public.boards;

-- INSERT: only org admin or super_admin can create boards
CREATE POLICY "boards: admin create" ON public.boards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), org_id)
  );

-- UPDATE: only org admin or super_admin
CREATE POLICY "boards: admin update" ON public.boards
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), org_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), org_id)
  );

-- DELETE: only org admin or super_admin
CREATE POLICY "boards: admin delete" ON public.boards
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_org_admin(auth.uid(), org_id)
  );

-- ============ BOARD COLUMNS: Split combined policy ============
DROP POLICY IF EXISTS "columns: by board access" ON public.board_columns;

-- SELECT: any org member who can see the parent board
CREATE POLICY "columns: read by board" ON public.board_columns
  FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.boards b
      WHERE b.id = board_id
        AND (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
  );

-- INSERT/UPDATE/DELETE: admin of the board's org or super_admin
CREATE POLICY "columns: admin write" ON public.board_columns
  FOR ALL TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.boards b
      WHERE b.id = board_id
        AND (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), b.org_id))
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.boards b
      WHERE b.id = board_id
        AND (public.is_super_admin(auth.uid()) OR public.is_org_admin(auth.uid(), b.org_id))
    )
  );
