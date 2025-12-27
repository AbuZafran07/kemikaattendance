-- Fix 1: Drop legacy permissive RLS policy on profiles table
DROP POLICY IF EXISTS "Profiles are viewable by everyone authenticated" ON public.profiles;

-- Fix 2: Make employee-photos storage bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'employee-photos';