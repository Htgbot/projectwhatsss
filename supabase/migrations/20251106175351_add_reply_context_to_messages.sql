/*
  # Add Reply Context to Messages

  1. Changes
    - Add reply_to_message_id column to store which message this is replying to
    - Add context column to store reply context (quoted message preview)
    
  2. Purpose
    - Enable WhatsApp-style message replies/quotes
    - Store relationship between messages
    - Display quoted message context in UI
*/

-- Add reply context columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'reply_to_message_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN reply_to_message_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'context'
  ) THEN
    ALTER TABLE messages ADD COLUMN context jsonb;
  END IF;
END $$;