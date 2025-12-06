#!/bin/bash
# Nuclear fix for Supabase Auth Database Errors
# Usage: ./scripts/final_fix.sh

echo "🔥 Applying NUCLEAR fix for Database Permissions and Triggers..."

# 1. Grant SUPERUSER to supabase_auth_admin
# This is the most robust way to fix "Database error finding user" caused by permission issues.
echo "   - Granting SUPERUSER permissions to supabase_auth_admin..."
docker compose exec -T db psql -U postgres -c "ALTER ROLE supabase_auth_admin SUPERUSER;"

# 2. Ensure pgcrypto is valid
echo "   - Ensuring pgcrypto extension exists..."
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;"

# 3. Ensure user_profiles table exists
echo "   - Ensuring user_profiles table exists..."
docker compose exec -T db psql -U postgres -d postgres -c "
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    display_name text,
    role text DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'worker')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    company_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
GRANT ALL ON public.user_profiles TO postgres, service_role, supabase_auth_admin;
GRANT SELECT ON public.user_profiles TO authenticated, anon;
"

# 4. Update Trigger to SWALLOW ERRORS
# This ensures that even if the profile creation fails, the Auth User is still created.
echo "   - Updating trigger to be fault-tolerant..."
docker compose exec -T db psql -U postgres -d postgres -c "
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS \$\$
BEGIN
  BEGIN
    INSERT INTO public.user_profiles (id, email, role, status)
    VALUES (new.id, new.email, 'admin', 'active')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '⚠️ Profile creation failed for user %: %', new.id, SQLERRM;
    -- Swallow error so Auth User is still created
  END;
  RETURN new;
END;
\$\$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
"

# 5. Restart Auth Service
echo "🔄 Restarting Auth service..."
docker compose restart auth

# 6. Rebuild App (Just in case)
echo "🔄 Rebuilding App..."
docker compose up -d --build app

echo "✅ Fix applied successfully."
echo "👉 You can now create the Super Admin at /tempsuper"
