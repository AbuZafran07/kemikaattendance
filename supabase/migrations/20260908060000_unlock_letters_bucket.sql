-- Storage bucket for account_unlock_letters PDF documents.
-- Policies for this bucket were already created in migration 20260908052037,
-- but the bucket row itself was never inserted.
INSERT INTO storage.buckets (id, name, public)
VALUES ('unlock-letters', 'unlock-letters', false)
ON CONFLICT (id) DO NOTHING;
