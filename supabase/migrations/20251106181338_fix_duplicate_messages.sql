/*
  # Fix Duplicate Messages Issue

  1. Problem
    - Messages with the same message_id are being inserted multiple times
    - This happens when webhooks are received multiple times or retried
    
  2. Solution
    - Remove duplicate messages (keep the oldest one)
    - Add unique constraint on message_id to prevent future duplicates
    - Add unique constraint handling in application code
    
  3. Changes
    - Delete duplicate messages
    - Create unique index on message_id
*/

-- Delete duplicate messages, keeping only the oldest one for each message_id
DELETE FROM messages
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY created_at ASC) as rn
    FROM messages
    WHERE message_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);

-- Create unique index on message_id to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS messages_message_id_unique 
ON messages(message_id) 
WHERE message_id IS NOT NULL;