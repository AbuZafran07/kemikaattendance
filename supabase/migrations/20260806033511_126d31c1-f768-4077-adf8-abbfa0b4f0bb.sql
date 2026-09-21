update public.system_settings
set value = (value - 'files_state') || jsonb_build_object('files_state', '{}'::jsonb, 'files_done', false, 'files_uploaded', 0, 'files_failed', 0)
where key = 'gdrive_backup_config';