DROP POLICY IF EXISTS "chat-attachments: delete own" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments: read as recipient" ON storage.objects;
CREATE POLICY "chat-attachments: read as recipient"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.recipient_id = auth.uid()
      AND m.attachment_url = storage.objects.name
  )
);