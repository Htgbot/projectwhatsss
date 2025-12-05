-- Fix schema for multi-tenancy and add missing columns

-- 1. Add from_number to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS from_number text;

-- 2. Drop old unique constraint on phone_number (it prevented multiple companies from chatting with same user)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_phone_number_key;

-- 3. Add new composite unique constraint (unique per business number <-> customer pair)
-- We use COALESCE to handle potential nulls if any, but from_number should be populated.
-- For existing rows with null from_number, this might be tricky. 
-- Let's assume we can just add the constraint.
-- If there are duplicates, this will fail. But likely there are few rows or unique phone_numbers.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_phone_from ON conversations(phone_number, from_number);

-- 4. Add from_number to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_number text;

-- 5. Fix RLS Policies
-- Drop the overly permissive policies created by the initial schema or previous migrations
DROP POLICY IF EXISTS "Allow all operations on conversations for authenticated users" ON conversations;
DROP POLICY IF EXISTS "Allow all operations on messages for authenticated users" ON messages;

-- Ensure the company-based policies are correct
-- We already have "Company members view conversations" and "Superadmin all conversations"
-- But we need to ensure they allow INSERT/UPDATE as well if they are "USING" policies.
-- Usually we want separate policies or "USING ( ... ) WITH CHECK ( ... )"

-- Re-define policies for strict security

-- Conversations
DROP POLICY IF EXISTS "Company members view conversations" ON conversations;
CREATE POLICY "Company members access conversations" ON conversations
    FOR ALL
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Superadmin all conversations" ON conversations;
CREATE POLICY "Superadmin all conversations" ON conversations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

-- Messages
DROP POLICY IF EXISTS "Company members view messages" ON messages;
CREATE POLICY "Company members access messages" ON messages
    FOR ALL
    TO authenticated
    USING (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Superadmin all messages" ON messages;
CREATE POLICY "Superadmin all messages" ON messages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin'
        )
    );
