-- Fix for random auto-users being created when a teacher logs in or public signup happens
-- This script removes the generic auth trigger that automatically inserts users into public tables.
-- Deenora handles institution and profile creation explicitly in the application code.

-- 1. Drop the trigger from auth.users (if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop the corresponding handler function (if it exists)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
