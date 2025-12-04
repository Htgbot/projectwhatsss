/*
  # Add From Number Support

  1. Changes to Tables
    - Add `from_number` column to `conversations` table
      - Stores the WhatsApp Business number used for this conversation
    - Add `from_number` column to `messages` table
      - Stores which number sent/received the message
    
    - Create `business_numbers` table
      - `id` (uuid, primary key)
      - `phone_number` (text, unique) - WhatsApp Business phone number
      - `display_name` (text) - Friendly name for the number
      - `is_default` (boolean) - Whether this is the default number
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on business_numbers table
    - Add policies for authenticated users
*/

-- Create business_numbers table
CREATE TABLE IF NOT EXISTS business_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on business_numbers for authenticated users"
  ON business_numbers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add from_number to conversations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'from_number'
  ) THEN
    ALTER TABLE conversations ADD COLUMN from_number text;
  END IF;
END $$;

-- Add from_number to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'from_number'
  ) THEN
    ALTER TABLE messages ADD COLUMN from_number text;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_from_number ON conversations(from_number);
CREATE INDEX IF NOT EXISTS idx_messages_from_number ON messages(from_number);