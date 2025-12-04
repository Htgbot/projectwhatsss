/*
  # Add Reaction Message Type

  1. Problem
    - Messages table check constraint doesn't allow 'reaction' as a message type
    - This prevents storing reaction messages sent to customers

  2. Solution
    - Drop existing check constraint
    - Recreate with 'reaction' included in allowed types

  3. Changes
    - Update messages_message_type_check constraint to include 'reaction'
*/

-- Drop the existing check constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Recreate with 'reaction' included
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check 
  CHECK (message_type = ANY (ARRAY[
    'text'::text, 
    'image'::text, 
    'video'::text, 
    'audio'::text, 
    'document'::text, 
    'template'::text, 
    'interactive'::text, 
    'location'::text, 
    'contact'::text, 
    'sticker'::text,
    'reaction'::text
  ]));
