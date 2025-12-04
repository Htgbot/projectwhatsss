import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'garena.htggameryt@gmail.com',
      password: 'H@Jwa1234',
      email_confirm: true,
      user_metadata: {
        display_name: 'Super Admin',
        role: 'super_admin',
      },
    });

    if (authError) {
      throw authError;
    }

    console.log('User created with ID:', authData.user.id);

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ role: 'super_admin' })
      .eq('id', authData.user.id);

    if (updateError) {
      console.error('Error updating profile role:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Super admin created successfully',
        user_id: authData.user.id,
        email: authData.user.email,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error creating super admin:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});