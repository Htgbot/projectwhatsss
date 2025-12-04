/*
  # Add Media Support to Quick Replies

  1. Changes
    - Add `message_type` column to support 'text', 'image', 'video', 'document'
    - Add `media_url` column to store the URL of uploaded media
    - Add `caption` column to store optional caption for media
    - Update the message column to be nullable (for media-only quick replies)
    - Update constraints to handle both text and media quick replies

  2. Notes
    - Text quick replies will have message_type = 'text' and message populated
    - Media quick replies will have message_type = 'image'/'video'/'document', media_url populated, and optional caption
    - The shortcut remains required for all types
*/

-- Add new columns for media support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_replies' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE quick_replies ADD COLUMN message_type text DEFAULT 'text' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_replies' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE quick_replies ADD COLUMN media_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_replies' AND column_name = 'caption'
  ) THEN
    ALTER TABLE quick_replies ADD COLUMN caption text;
  END IF;
END $$;

-- Drop the old constraint on message
ALTER TABLE quick_replies DROP CONSTRAINT IF EXISTS quick_replies_message_check;

-- Make message nullable for media-only quick replies
ALTER TABLE quick_replies ALTER COLUMN message DROP NOT NULL;

-- Add new constraints
ALTER TABLE quick_replies ADD CONSTRAINT quick_replies_message_type_check 
  CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document'));

-- Ensure either message or media_url is provided
ALTER TABLE quick_replies ADD CONSTRAINT quick_replies_content_check
  CHECK (
    (message_type = 'text' AND message IS NOT NULL AND length(trim(message)) > 0) OR
    (message_type IN ('image', 'video', 'audio', 'document') AND media_url IS NOT NULL AND length(trim(media_url)) > 0)
  );

-- Add constraint for caption length
ALTER TABLE quick_replies ADD CONSTRAINT quick_replies_caption_check 
  CHECK (caption IS NULL OR length(caption) <= 1024);

-- Update existing records to have message_type = 'text' if not set
UPDATE quick_replies SET message_type = 'text' WHERE message_type IS NULL;
