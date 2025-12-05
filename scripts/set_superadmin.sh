#!/bin/bash

# Set Superadmin Script
# Usage: ./scripts/set_superadmin.sh <email>

EMAIL=$1

if [ -z "$EMAIL" ]; then
  echo "❌ Usage: ./scripts/set_superadmin.sh <email>"
  echo "   Example: ./scripts/set_superadmin.sh admin@example.com"
  exit 1
fi

echo "🔧 Promoting user '$EMAIL' to superadmin..."

docker compose exec -T db psql -U postgres -d postgres -c "
DO \$\$
DECLARE
    target_email TEXT := '$EMAIL';
    target_uid UUID;
BEGIN
    -- Find user ID from auth.users
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    
    IF target_uid IS NOT NULL THEN
        -- Upsert into user_profiles
        INSERT INTO public.user_profiles (id, email, role, status)
        VALUES (target_uid, target_email, 'superadmin', 'active')
        ON CONFLICT (id) DO UPDATE
        SET role = 'superadmin', status = 'active';
        
        RAISE NOTICE '✅ User % (ID: %) has been promoted to superadmin.', target_email, target_uid;
    ELSE
        RAISE NOTICE '❌ Error: User % not found in auth.users. Please sign up first.', target_email;
    END IF;
END \$\$;
"
