/*
  # Add Foreign Key Indexes for Performance

  1. Problem
    - Several foreign key columns lack covering indexes
    - This causes suboptimal query performance for JOIN operations
    - Foreign keys without indexes can cause table locks during deletions

  2. Solution
    - Add indexes on all unindexed foreign key columns
    - These indexes will improve:
      - JOIN performance when querying related tables
      - DELETE operations on referenced tables
      - Foreign key constraint validation

  3. New Indexes
    - business_numbers(user_id) - for user's business numbers lookups
    - conversations(business_number_id) - for conversations by business number
    - user_number_access(granted_by) - for tracking who granted access
    - user_number_access(number_id) - for finding users with access to a number
    
  Note: user_number_access(user_id) already has a covering index via the 
        unique constraint on (user_id, number_id)

  4. Manual Action Required
    - Leaked Password Protection must be enabled in Supabase Dashboard
    - Go to: Authentication → Settings → Security and Protection
    - Enable: "Leaked Password Protection"
    - This checks passwords against HaveIBeenPwned.org database
*/

-- =====================================================
-- Add Indexes for Foreign Keys
-- =====================================================

-- Index for business_numbers.user_id foreign key
-- Improves performance when querying business numbers by user
CREATE INDEX IF NOT EXISTS idx_business_numbers_user_id 
  ON business_numbers(user_id);

-- Index for conversations.business_number_id foreign key
-- Improves performance when querying conversations by business number
CREATE INDEX IF NOT EXISTS idx_conversations_business_number_id 
  ON conversations(business_number_id);

-- Index for user_number_access.granted_by foreign key
-- Improves performance when tracking who granted access
CREATE INDEX IF NOT EXISTS idx_user_number_access_granted_by 
  ON user_number_access(granted_by);

-- Index for user_number_access.number_id foreign key
-- Improves performance when finding users with access to a specific number
CREATE INDEX IF NOT EXISTS idx_user_number_access_number_id 
  ON user_number_access(number_id);

-- Note: user_number_access.user_id already has coverage through the 
-- unique constraint index on (user_id, number_id)

-- =====================================================
-- Add Comments for Documentation
-- =====================================================

COMMENT ON INDEX idx_business_numbers_user_id IS 
  'Optimizes queries filtering business numbers by user and improves DELETE performance on user_profiles';

COMMENT ON INDEX idx_conversations_business_number_id IS 
  'Optimizes queries joining conversations with business numbers and improves DELETE performance on business_numbers';

COMMENT ON INDEX idx_user_number_access_granted_by IS 
  'Optimizes queries tracking who granted access and improves DELETE performance on user_profiles';

COMMENT ON INDEX idx_user_number_access_number_id IS 
  'Optimizes queries finding users with access to a number and improves DELETE performance on business_numbers';
