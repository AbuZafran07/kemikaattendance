INSERT INTO public.system_settings (key, value, description)
VALUES (
  'gdrive_backup_config',
  '{"enabled": false, "last_backup_at": null, "last_backup_file": null, "last_backup_records": 0, "gdrive_file_id": null}'::jsonb,
  'Konfigurasi auto backup ke Google Drive'
)
ON CONFLICT (key) DO NOTHING;