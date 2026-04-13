-- Run this SQL in your Supabase SQL Editor to enable user creation from the Super Admin panel.
-- This script also ensures the pgcrypto extension is enabled.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_user_by_admin(
  p_email text,
  p_password text,
  p_user_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = p_email;
  
  IF new_user_id IS NOT NULL THEN
    RETURN new_user_id;
  END IF;

  -- Create the user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_super_admin,
    confirmed_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    p_user_data,
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    now()
  )
  RETURNING id INTO new_user_id;

  -- Create identity for the user
  -- provider_id is required and should be the user's email for email provider
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    new_user_id,
    format('{"sub": "%s", "email": "%s"}', new_user_id::text, p_email)::jsonb,
    'email',
    p_email, -- provider_id is the email for email provider
    now(),
    now(),
    now()
  );

  RETURN new_user_id;
END;
$$;
