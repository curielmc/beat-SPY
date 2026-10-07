-- Signup runs before the student has a session, but classes/groups RLS requires
-- auth.uid(). Expose only what the signup form needs, keyed by the class code.

CREATE OR REPLACE FUNCTION public.class_by_code(lookup_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'code', c.code,
    'class_name', c.class_name,
    'group_mode', c.group_mode,
    'teacher', jsonb_build_object('full_name', p.full_name)
  )
  FROM classes c
  LEFT JOIN profiles p ON p.id = c.teacher_id
  WHERE c.code = upper(lookup_code)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.class_groups_by_code(lookup_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'name', g.name,
    -- first names only: this is readable before login
    'memberships', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('profiles', jsonb_build_object('full_name', split_part(p.full_name, ' ', 1)))), '[]'::jsonb)
      FROM class_memberships m JOIN profiles p ON p.id = m.user_id
      WHERE m.group_id = g.id
    )
  ) ORDER BY g.name), '[]'::jsonb)
  FROM groups g JOIN classes c ON c.id = g.class_id
  WHERE c.code = upper(lookup_code);
$$;

REVOKE ALL ON FUNCTION public.class_by_code(text) FROM public;
REVOKE ALL ON FUNCTION public.class_groups_by_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.class_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.class_groups_by_code(text) TO anon, authenticated;
