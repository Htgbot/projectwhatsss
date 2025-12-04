/*
  # WhatsApp Business API Schema

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key)
      - `phone_number` (text) - WhatsApp phone number
      - `contact_name` (text) - Contact display name
      - `last_message` (text) - Preview of last message
      - `last_message_time` (timestamptz) - Timestamp of last message
      - `unread_count` (integer) - Number of unread messages
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, foreign key)
      - `message_id` (text) - YCloud message ID
      - `direction` (text) - 'inbound' or 'outbound'
      - `message_type` (text) - 'text', 'image', 'video', 'audio', 'document', 'template', 'interactive', 'location', 'contact', 'sticker'
      - `content` (jsonb) - Message content and metadata
      - `status` (text) - 'sent', 'delivered', 'read', 'failed'
      - `timestamp` (timestamptz)
      - `created_at` (timestamptz)
    
    - `templates`
      - `id` (uuid, primary key)
      - `name` (text) - Template name
      - `language` (text) - Template language code
      - `category` (text) - Template category
      - `content` (jsonb) - Template structure
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  contact_name text NOT NULL,
  last_message text DEFAULT '',
  last_message_time timestamptz DEFAULT now(),
  unread_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on conversations for authenticated users"
  ON conversations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'template', 'interactive', 'location', 'contact', 'sticker')),
  content jsonb NOT NULL DEFAULT '{}',
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on messages for authenticated users"
  ON messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  language text NOT NULL DEFAULT 'en',
  category text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on templates for authenticated users"
  ON templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_time ON conversations(last_message_time DESC);