-- Supabase Storage Buckets and Policies Setup
-- Note: 'storage.objects' already has RLS enabled by default in Supabase.
-- Run this in your Supabase Dashboard -> SQL Editor

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('madrasah-assets', 'madrasah-assets', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif']),
  ('voice-templates', 'voice-templates', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Cleanup existing policies to avoid duplicate errors
DROP POLICY IF EXISTS "Public Access madrasah-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert madrasah-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Update madrasah-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete madrasah-assets" ON storage.objects;

DROP POLICY IF EXISTS "Public Access voice-templates" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert voice-templates" ON storage.objects;
DROP POLICY IF EXISTS "Public Update voice-templates" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete voice-templates" ON storage.objects;

-- 3. Policies for 'madrasah-assets' (Logo, Images, Documents)
CREATE POLICY "Public Access madrasah-assets" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'madrasah-assets');

CREATE POLICY "Public Insert madrasah-assets" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'madrasah-assets');

CREATE POLICY "Public Update madrasah-assets" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'madrasah-assets');

CREATE POLICY "Public Delete madrasah-assets" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'madrasah-assets');

-- 4. Policies for 'voice-templates' (Voice recordings, Audio files)
CREATE POLICY "Public Access voice-templates" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'voice-templates');

CREATE POLICY "Public Insert voice-templates" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'voice-templates');

CREATE POLICY "Public Update voice-templates" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'voice-templates');

CREATE POLICY "Public Delete voice-templates" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'voice-templates');
