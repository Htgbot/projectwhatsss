-- Enforce company-level isolation for conversations and messages

-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Update Conversations RLS
DROP POLICY IF EXISTS "Users can view accessible conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations" ON conversations;

CREATE POLICY "Users can view company conversations"
ON conversations FOR SELECT
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

CREATE POLICY "Users can update company conversations"
ON conversations FOR UPDATE
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

-- Messages RLS (Relies on conversation ownership)
DROP POLICY IF EXISTS "Users can view accessible messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages" ON messages;

CREATE POLICY "Users can view company messages"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (
      c.company_id = get_my_company_id() OR
      get_my_role() = 'superadmin'
    )
  )
);

-- Ensure business_numbers also respects company_id (it already has it)
DROP POLICY IF EXISTS "Users can view accessible numbers" ON business_numbers;

CREATE POLICY "Users can view company numbers"
ON business_numbers FOR SELECT
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

-- Ensure quick_replies respects company_id
DROP POLICY IF EXISTS "Users can view company quick replies" ON quick_replies;
-- Check if policy exists first or just drop if exists
-- quick_replies table was created recently, likely has basic RLS.
-- We'll enforce it strictly here.

CREATE POLICY "Users can view company quick replies"
ON quick_replies FOR SELECT
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);

CREATE POLICY "Users can manage company quick replies"
ON quick_replies FOR ALL
TO authenticated
USING (
  (company_id = get_my_company_id()) OR
  (get_my_role() = 'superadmin')
);
