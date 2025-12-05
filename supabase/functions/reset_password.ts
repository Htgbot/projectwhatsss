import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const email = 'superadmin@test.com';
const password = 'password123';

console.log(`Resetting password for ${email}...`);

const { data: { users }, error } = await supabase.auth.admin.listUsers();

if (error) {
  console.error('Error listing users:', error);
  Deno.exit(1);
}

const user = users?.find(u => u.email === email);

if (user) {
  console.log(`Found user ${user.id}`);
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: password }
  );
  if (updateError) {
    console.error('Error updating password:', updateError);
    Deno.exit(1);
  }
  console.log('Password updated successfully');
} else {
  console.log('User not found');
  Deno.exit(1);
}
