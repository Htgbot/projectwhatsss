import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSuperAdmin() {
  try {
    // Create user with auth.admin
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'garena.htggameryt@gmail.com',
      password: 'H@Jwa1234',
      options: {
        data: {
          display_name: 'Super Admin',
          role: 'super_admin',
        },
        emailRedirectTo: undefined,
      },
    });

    if (authError) {
      if (authError.code === 'user_already_exists') {
        console.log('User already exists, updating role...');
        // Get user ID by email
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
        const user = userData?.users.find(u => u.email === 'garena.htggameryt@gmail.com');
        
        if (user) {
          authData.user = user;
        } else {
           console.error('Could not find existing user');
           return;
        }
      } else {
        console.error('Error creating user:', authError);
        return;
      }
    }

    console.log('User created:', authData.user?.id);

    // Update user profile to super_admin
    if (authData.user) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ role: 'super_admin' })
        .eq('id', authData.user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
      } else {
        console.log('Super admin created successfully!');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

createSuperAdmin();
