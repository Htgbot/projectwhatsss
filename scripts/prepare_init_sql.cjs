const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'supabase_full_backup.sql');
const outputPath = path.join(__dirname, '..', 'init_db.sql');

const superAdminSQL = `
--
-- Data for Name: auth.users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

DO $$
DECLARE
  user_id uuid := gen_random_uuid();
  encrypted_pw text;
BEGIN
  -- Generate Hash using pgcrypto with cost 10
  encrypted_pw := crypt('7j&EUScVCt1v#', gen_salt('bf', 10));

  -- Insert User into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, recovery_sent_at, last_sign_in_at, 
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, email_change, 
    email_change_token_new, recovery_token, is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated', 'info@htgsuper.com', encrypted_pw, 
    now(), now(), now(), 
    '{"provider": "email", "providers": ["email"]}', '{"display_name": "Super Admin"}', 
    now(), now(), '', '', '', '', true
  );
  
  -- Insert Identity
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    user_id, user_id, format('{"sub": "%s", "email": "info@htgsuper.com"}', user_id)::jsonb, 'email', now(), now(), now()
  );

  -- Insert Profile
  INSERT INTO public.user_profiles (id, email, role, status)
  VALUES (user_id, 'info@htgsuper.com', 'superadmin', 'active');

  RAISE NOTICE 'Superadmin created successfully';
END
$$;
`;

try {
  let content = fs.readFileSync(backupPath, 'utf8');

  // Remove COPY blocks (Data)
  // Pattern: COPY ... FROM stdin; ... \.
  // We use a non-greedy match across multiple lines
  content = content.replace(/^COPY[\s\S]*?^\\\.\s*$/gm, '');

  // Remove specific INSERTs if any (though COPY is standard for dumps)
  
  // Append the Superadmin creation
  const finalContent = content + '\n\n' + superAdminSQL;

  fs.writeFileSync(outputPath, finalContent);
  console.log('Successfully created init_db.sql with clean schema and superadmin user.');
} catch (err) {
  console.error('Error processing backup file:', err);
  process.exit(1);
}
