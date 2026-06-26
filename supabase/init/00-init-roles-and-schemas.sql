DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'supersecretpassword';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN CREATEROLE CREATEDB;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS graphql_public;
CREATE SCHEMA IF NOT EXISTS _realtime;

GRANT anon TO postgres;
GRANT authenticated TO postgres;
GRANT service_role TO postgres;
GRANT supabase_auth_admin TO postgres;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA graphql_public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role, supabase_storage_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, postgres;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin, postgres;
GRANT ALL ON SCHEMA realtime TO postgres;
GRANT ALL ON SCHEMA _realtime TO postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin, authenticated, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin, authenticated, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA _realtime GRANT ALL ON TABLES TO postgres;

-- Storage table permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA storage TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA storage TO authenticated;

GRANT ALL ON SCHEMA public TO postgres;

-- Fix postgres search_path so GoTrue can find auth tables
ALTER ROLE postgres SET search_path TO auth, public, realtime;

-- Ensure auth.schema_migrations has inserted_at column
-- (needed because postgres search_path resolves schema_migrations to auth first,
-- and Supabase Realtime Ecto migrations need inserted_at)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'schema_migrations')
     AND NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'schema_migrations' AND column_name = 'inserted_at')
  THEN
    ALTER TABLE auth.schema_migrations ADD COLUMN inserted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
    ALTER TABLE auth.schema_migrations ALTER COLUMN version TYPE BIGINT USING version::BIGINT;
  END IF;
END
$$;

-- Grant EXECUTE on RLS helper functions to authenticated role
-- (RLS policies call is_super_admin(), has_role(), etc. as the authenticated user)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'is_super_admin') THEN
    GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'has_role') THEN
    GRANT EXECUTE ON FUNCTION has_role(uuid, app_role) TO authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'is_org_admin') THEN
    GRANT EXECUTE ON FUNCTION is_org_admin(uuid, uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'get_user_org') THEN
    GRANT EXECUTE ON FUNCTION get_user_org(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'is_org_member') THEN
    GRANT EXECUTE ON FUNCTION is_org_member(uuid, uuid) TO authenticated;
  END IF;
END
$$;
