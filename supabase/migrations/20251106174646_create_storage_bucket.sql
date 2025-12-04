/*
  # Create WhatsApp Media Storage Bucket

  1. Changes
    - Create storage bucket for WhatsApp media files
    - Add policies to allow public read access
    - Add policies to allow authenticated uploads and deletes

  2. Security
    - Public read access for all files
    - Anyone can upload files
    - Anyone can delete files
*/

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY allow_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-media');

-- Allow anyone to upload
CREATE POLICY allow_public_upload
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow anyone to delete
CREATE POLICY allow_public_delete
  ON storage.objects FOR DELETE
  USING (bucket_id = 'whatsapp-media');