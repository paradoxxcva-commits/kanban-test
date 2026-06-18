
create policy "chat-attachments: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat-attachments: read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat-attachments: read as recipient" on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and exists(
      select 1 from public.messages m
      where m.recipient_id = auth.uid()
        and m.attachment_url like '%' || name || '%'
    )
  );
create policy "chat-attachments: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
