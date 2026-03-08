-- Fix Admin Role for martin@myecfo.com
-- Paste this into the Supabase SQL Editor to elevate your account.

UPDATE profiles
SET role = 'admin'
WHERE email = 'martin@myecfo.com';

-- Verify the change
SELECT id, email, role FROM profiles WHERE email = 'martin@myecfo.com';
