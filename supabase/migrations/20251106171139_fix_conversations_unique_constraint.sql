/*
  # Fix Conversations Unique Constraint

  1. Changes
    - Drop the old unique constraint on phone_number only
    - Add new unique constraint on (phone_number, from_number) combination
    - This allows multiple conversations with the same contact but different business numbers
*/

-- Drop the old unique constraint
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_phone_number_key;

-- Create a unique constraint on the combination of phone_number and from_number
CREATE UNIQUE INDEX IF NOT EXISTS conversations_phone_from_unique 
  ON conversations(phone_number, from_number) 
  WHERE from_number IS NOT NULL;