-- Make the bucket public so AI can access the images
UPDATE storage.buckets 
SET public = true 
WHERE id = 'offer-attachments';