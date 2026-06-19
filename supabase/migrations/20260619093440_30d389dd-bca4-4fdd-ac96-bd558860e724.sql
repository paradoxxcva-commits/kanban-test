
DROP POLICY IF EXISTS "chat-attachments update own" ON storage.objects;
CREATE POLICY "chat-attachments update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "chat-attachments delete own" ON storage.objects;
CREATE POLICY "chat-attachments delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
