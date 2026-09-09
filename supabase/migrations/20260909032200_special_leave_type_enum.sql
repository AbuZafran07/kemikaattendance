-- Izin Khusus (life-event leave) — Langkah 1: tambah value enum.
-- Dipisah dari migration yang memakainya karena Postgres tidak izinkan
-- ADD VALUE dan pemakaiannya di statement lain dalam satu transaksi.
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'izin_khusus';
