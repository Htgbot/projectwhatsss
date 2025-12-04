/*
  # Create Quick Replies Feature

  1. New Tables
    - `quick_replies`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `shortcut` (text) - The shortcut text (e.g., "hello", "thanks")
      - `message` (text) - The full message text to be sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `quick_replies` table
    - Add policies for users to manage their own quick replies:
      - Users can view their own quick replies
      - Users can insert their own quick replies
      - Users can update their own quick replies
      - Users can delete their own quick replies

  3. Indexes
    - Add index on user_id for faster lookups
    - Add unique constraint on (user_id, shortcut) to prevent duplicate shortcuts per user
*/

CREATE TABLE IF NOT EXISTS quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shortcut text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT quick_replies_shortcut_check CHECK (length(shortcut) > 0 AND length(shortcut) <= 50),
  CONSTRAINT quick_replies_message_check CHECK (length(message) > 0 AND length(message) <= 4096),
  CONSTRAINT quick_replies_user_shortcut_unique UNIQUE (user_id, shortcut)
);

-- Enable RLS
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

-- Policies for quick_replies
CREATE POLICY "Users can view own quick replies"
  ON quick_replies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quick replies"
  ON quick_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quick replies"
  ON quick_replies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own quick replies"
  ON quick_replies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_quick_replies_user_id ON quick_replies(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quick_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_quick_replies_updated_at_trigger ON quick_replies;
CREATE TRIGGER update_quick_replies_updated_at_trigger
  BEFORE UPDATE ON quick_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_quick_replies_updated_at();
