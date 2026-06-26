# RBAC Implementation Plan

## Gap Analysis

The existing infrastructure is solid — the role enum, `user_roles` table, security-definer helpers (`has_role`, `is_super_admin`, `get_user_org`, `is_org_admin`), and the `auth-context.tsx` with `hasRole()` are all in place. The gaps are:

**Database**: The RLS policies on `boards`, `board_columns`, and `tasks` currently allow any authenticated org member to INSERT, UPDATE, and DELETE. A `user`-role member can create and delete boards today. This directly violates the requirement.

**Frontend**: The "Создать доску" button on `boards.index.tsx` and the dashboard `index.tsx` is shown unconditionally. The `board.$boardId.tsx` page gates board deletion via `canManageBoard` but column add/delete buttons are always visible. There is no org-admin panel for managing members within an org (only the super_admin `/team` page exists).

**Backend**: `admin.functions.ts` only has super_admin-gated functions. There are no server-side functions for org-scoped admin operations (invite member, remove member, create board with server-side auth check). All board/task CRUD currently goes through the Supabase client directly without server-side role validation.

---

## Phase 1: Database — Split RLS Policies by Role

**New migration**: `supabase/migrations/<timestamp>_role_gated_rls.sql`

### 1.1 Boards table

Drop the three write policies that currently apply to all org members. Replace with admin-only write policies that check `is_org_admin()` or `is_super_admin()`.

```sql
-- Remove overly permissive write policies
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
```

The existing SELECT policy (`boards: org members read`) stays unchanged — all org members can read boards.

### 1.2 Board columns table

Drop the single combined policy and replace with split read/write policies.

```sql
DROP POLICY IF EXISTS "columns: by board access" ON public.board_columns;

-- Read: any org member who can see the board
CREATE POLICY "columns: read by board" ON public.board_columns
  FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.boards b
      WHERE b.id = board_id
        AND (b.org_id = public.get_user_org(auth.uid()) OR public.is_super_admin(auth.uid()))
    )
  );

-- Write (insert/update/delete): admin of the board's org or super_admin
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
        AND b.org_id = public.get_user_org(auth.uid())
    )
  );
```

### 1.3 Tasks table

Keep the existing combined policy but tighten the WITH CHECK to allow any org member to write (since all roles can create/edit tasks). The current policy already does this correctly — no change needed here.

**However**, add an admin-only DELETE policy to restrict task deletion if desired. Based on requirements, all users can create, move, and assign tasks, so the existing policy is fine for tasks.

### 1.4 New helper function: `is_org_member`

Add a helper that confirms a user belongs to an org (useful for future policies):

```sql
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = _user_id AND org_id = _org_id
  )
$$;
```

---

## Phase 2: Backend — Server-Side Role Guards for Board Operations

All board operations currently go through the Supabase client directly from the browser. While RLS provides a safety net, adding server-side guards gives defense-in-depth and better error messages.

### 2.1 New file: `src/lib/board-admin.functions.ts`

Server functions that wrap board CRUD with explicit role checks:

```typescript
// createBoardFn — requires admin or super_admin
// deleteBoardFn — requires admin or super_admin
// createColumnFn — requires admin or super_admin
// deleteColumnFn — requires admin or super_admin
// renameColumnFn — requires admin or super_admin
```

Each function follows the existing pattern in `admin.functions.ts`:
1. Use `requireSupabaseAuth` middleware
2. Call `is_super_admin()` RPC or `is_org_admin()` RPC to verify permission
3. Perform the operation via `supabaseAdmin`

### 2.2 New file: `src/lib/org-admin.functions.ts`

Server functions for org-scoped admin operations (org admin managing their org's members):

```typescript
// listOrgMembers — returns profiles for the caller's org
// inviteOrgMember — creates user + assigns them to the org with 'user' role
// removeOrgMember — removes user from org (sets org_id to null)
// promoteToOrgAdmin — grants 'admin' role within org (super_admin only)
```

Key: `inviteOrgMember` must verify the caller has `admin` role in the target org. It should NOT allow granting `super_admin` — only `super_admin` can do that.

### 2.3 Modify existing: `src/lib/admin.functions.ts`

The `setUserRoles` function currently requires `super_admin`. This is correct per requirements. No changes needed.

The `createUser` function should add a guard: if the caller is an `admin` (not `super_admin`), restrict `orgId` to only their own org and prevent assigning `super_admin` role.

---

## Phase 3: Frontend — Role-Gated UI

### 3.1 `src/routes/_authenticated/boards.index.tsx`

Gate the "Создать доску" button:

```tsx
const { hasRole } = useAuth();
const canCreateBoard = hasRole("admin") || hasRole("super_admin");

// Only render the button when canCreateBoard is true
{canCreateBoard && (
  <Button onClick={() => setOpen(true)} className="gap-1.5">
    <Plus className="h-4 w-4" />
    Создать доску
  </Button>
)}
```

### 3.2 `src/routes/_authenticated/index.tsx` (Dashboard)

Gate the "Создать доску" quick-action link:

```tsx
const { hasRole } = useAuth();
const canCreateBoard = hasRole("admin") || hasRole("super_admin");

// Conditionally render the Link
```

### 3.3 `src/routes/_authenticated/boards.$boardId.tsx`

Currently `canManageBoard` already checks `hasRole("admin") || hasRole("super_admin")`. This is correct for board deletion.

Gate the "Колонка" (add column) button and the column menu (rename/delete) to admin+ only:

```tsx
const canManageBoard = hasRole("admin") || hasRole("super_admin") || data.board.created_by === profile?.id;

// Pass canManageBoard down to KanbanColumn
<KanbanColumn
  canManage={canManageBoard}
  // ...existing props
/>
```

### 3.4 `src/components/boards/kanban-column.tsx`

Accept a `canManage` prop. Conditionally show the "+" button for adding tasks (always visible for all roles) but hide the dropdown menu with rename/delete options for non-admins:

```tsx
export function KanbanColumn({ canManage = false, ... }) {
  // The "Add task" Plus button stays visible for everyone
  // The dropdown (rename/delete column) only shows when canManage is true
}
```

### 3.5 `src/components/boards/task-dialog.tsx`

No changes needed. All roles can create and edit tasks per requirements.

### 3.6 New page: `src/routes/_authenticated/org-admin.tsx`

An org-admin panel visible to users with the `admin` role in their org. Provides:

- List of org members (from `profiles` where `org_id` matches)
- Invite new member form
- Remove member from org
- Cannot manage roles (only super_admin can)

This reuses the `Modal` pattern from `team.tsx` but with restricted operations.

### 3.7 `src/components/layout/sidebar.tsx`

Add the org-admin nav item for users with `admin` role:

```tsx
if (hasRole("admin")) {
  adminNav.push({ to: "/org-admin", label: "Админ организации", icon: Users });
}
```

The "Команда" (team) and "Системный админ" (super-admin) items stay super_admin-only.

---

## Phase 4: Suspended User Handling

The `_authenticated.tsx` layout already redirects suspended users to `/suspended`. Verify this works correctly with the RBAC system — a suspended user should be blocked from all operations. The `is_active` and `paid_until` checks in `auth-context.tsx` handle this on the frontend. Server functions should also check suspension status before performing operations.

---

## Phase 5: Edge Cases and Migration

### 5.1 Existing data

- Users without any role in `user_roles` currently have no access restrictions beyond RLS. After tightening board RLS, they can still read boards but cannot create/delete them. This is correct.
- Existing board creators who are `user` role will lose the ability to delete boards they created. The `canManageBoard` check in the frontend currently allows creators to delete — decide whether to keep this or remove it. Recommendation: remove the `created_by === profile?.id` exception for deletion to keep policy clean.

### 5.2 Bootstrap flow

The `bootstrapFirstSuperAdmin` function in `admin.functions.ts` creates the first super_admin. After that, the super_admin uses `/team` to invite users. The org-admin invite flow should only allow creating `user` role members within the admin's org.

### 5.3 Testing checklist

1. **As super_admin**: Can do everything — create orgs, manage all users, create/delete boards anywhere, assign any role.
2. **As admin in org A**: Can create/delete boards in org A, add/rename/delete columns, view all org A boards. Cannot create boards in org B. Cannot assign super_admin role.
3. **As user in org A**: Can view boards, create/edit/move tasks, comment. Cannot create/delete boards, cannot add/rename/delete columns, cannot manage users.
4. **RLS enforcement**: Attempt direct Supabase client calls from browser console to verify RLS blocks unauthorized operations.
5. **Migration safety**: Run migration against staging database with existing data. Verify no data loss. Verify existing boards remain accessible.

---

## Implementation Order

| Step | What | Files | Test |
|---|---|---|---|
| 1 | Write and apply RLS migration | New migration SQL | Insert board as `user` role — should fail |
| 2 | Add `is_org_member` helper function | Same migration | Call RPC from authenticated context |
| 3 | Create `board-admin.functions.ts` | New file in `src/lib/` | Server functions return proper errors for unauthorized |
| 4 | Create `org-admin.functions.ts` | New file in `src/lib/` | Org admin can list/invite members |
| 5 | Gate boards.index.tsx button | Edit `src/routes/_authenticated/boards.index.tsx` | Button hidden for `user` role |
| 6 | Gate board detail page column controls | Edit `boards.$boardId.tsx` and `kanban-column.tsx` | Column menu hidden for `user` role |
| 7 | Create org-admin page | New file `src/routes/_authenticated/org-admin.tsx` | Org admin sees member list |
| 8 | Update sidebar | Edit `src/components/layout/sidebar.tsx` | Org admin sees nav item |
| 9 | Gate dashboard create button | Edit `src/routes/_authenticated/index.tsx` | Link hidden for `user` role |
| 10 | End-to-end testing | All pages | Full role matrix test |

---

## Key Files Reference

| File | Purpose |
|---|---|
| `supabase/migrations/20260618174809_*.sql` | Original schema with roles, helpers, RLS |
| `src/lib/auth-context.tsx` | `AppRole` type, `hasRole()`, profile loading |
| `src/lib/admin.functions.ts` | Super-admin server functions |
| `src/lib/boards-api.ts` | Board/task CRUD via Supabase client |
| `src/integrations/supabase/auth-middleware.ts` | Server-side auth middleware |
| `src/integrations/supabase/client.server.ts` | Service-role client bypassing RLS |
| `src/routes/_authenticated/super-admin.tsx` | Super admin panel |
| `src/routes/_authenticated/team.tsx` | User management (super_admin only) |
| `src/routes/_authenticated/boards.index.tsx` | Board list page |
| `src/routes/_authenticated/boards.$boardId.tsx` | Board detail with drag-and-drop |
| `src/components/boards/kanban-column.tsx` | Column component with add/rename/delete |
| `src/components/boards/task-dialog.tsx` | Task create/edit dialog |
| `src/components/boards/create-board-dialog.tsx` | Board creation dialog |
| `src/components/layout/sidebar.tsx` | Navigation sidebar |
| `src/routes/_authenticated.tsx` | Auth layout with suspension check |
