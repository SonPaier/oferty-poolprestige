-- Create storage bucket for offer attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'offer-attachments', 
  'offer-attachments', 
  false, 
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']
);

-- Allow anyone to upload files (since no auth)
CREATE POLICY "Anyone can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'offer-attachments');

-- Allow anyone to read attachments
CREATE POLICY "Anyone can read attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'offer-attachments');

-- Allow anyone to delete attachments
CREATE POLICY "Anyone can delete attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'offer-attachments');