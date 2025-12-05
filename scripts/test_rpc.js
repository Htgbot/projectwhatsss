import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://localhost:8000' // Kong
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY0ODU5ODUyLCJleHAiOjQ5MTg0NTk4NTJ9.Zp_F1c3ty_o0eF-LiSkSNmXiOwjII2La9KqThHTYm18'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  // 1. Sign In
  console.log('Signing in as Superadmin...')
  const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'superadmin@test.com',
    password: 'superadmin123'
  })

  if (signInError) {
    console.error('Sign In Error:', signInError)
    return
  }

  console.log('Signed in successfully.')

  // 2. Call RPC
  console.log('Calling create_company_and_admin...')
  const { data, error } = await supabase.rpc('create_company_and_admin', {
    p_company_name: 'Test Company Inc',
    p_admin_email: 'admin@testcompany.com',
    p_admin_password: 'adminpassword123',
    p_admin_name: 'Test Admin'
  })

  if (error) {
    console.error('RPC Error:', error)
  } else {
    console.log('RPC Success! Result:', data)
  }
}

test()
