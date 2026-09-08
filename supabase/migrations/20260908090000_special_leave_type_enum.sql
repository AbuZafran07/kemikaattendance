-- New leave_type enum value for special/life-event leave (Pernikahan, Kematian, dll).
-- Kept in its own migration: Postgres doesn't allow ADD VALUE and using that value
-- in the same transaction as another statement.
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'izin_khusus';
