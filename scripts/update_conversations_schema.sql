-- Add company_id to conversations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'company_id') THEN
        ALTER TABLE conversations ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add company_id to messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'company_id') THEN
        ALTER TABLE messages ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
DROP POLICY IF EXISTS "Superadmin all conversations" ON conversations;
CREATE POLICY "Superadmin all conversations" ON conversations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

DROP POLICY IF EXISTS "Company members view conversations" ON conversations;
CREATE POLICY "Company members view conversations" ON conversations
    FOR ALL USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );

-- Policies for messages
DROP POLICY IF EXISTS "Superadmin all messages" ON messages;
CREATE POLICY "Superadmin all messages" ON messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'superadmin')
    );

DROP POLICY IF EXISTS "Company members view messages" ON messages;
CREATE POLICY "Company members view messages" ON messages
    FOR ALL USING (
        company_id IN (SELECT company_id FROM user_profiles WHERE id = auth.uid())
    );
