
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://localhost:8000'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY0ODU5ODUyLCJleHAiOjQ5MTg0NTk4NTJ9.Zp_F1c3ty_o0eF-LiSkSNmXiOwjII2La9KqThHTYm18'

const supabase = createClient(supabaseUrl, supabaseKey)

async function setup() {
  const email = 'superadmin@test.com'
  const password = 'superadmin123'

  console.log(`Creating user ${email}...`)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: 'Super Admin'
      }
    }
  })

  if (error) {
    console.error('Error creating user:', error)
    return
  }

  console.log('User created:', data.user?.id)
  console.log('Please manually update the role to superadmin in the database.')
}

setup()
