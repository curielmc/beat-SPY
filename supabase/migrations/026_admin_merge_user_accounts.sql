-- Admin account merge support.
-- Keeps one canonical profile/auth user and reassigns most user-owned data from
-- a duplicate source account into the target account.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merge_note text;

CREATE OR REPLACE FUNCTION merge_user_accounts(
  p_source_user_id uuid,
  p_target_user_id uuid,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source profiles%ROWTYPE;
  v_target profiles%ROWTYPE;
  v_membership class_memberships%ROWTYPE;
  v_target_membership class_memberships%ROWTYPE;
  v_progress_key text;
  v_merged_memberships integer := 0;
  v_reassigned_portfolios integer := 0;
  v_reassigned_trades integer := 0;
  v_reassigned_theses integer := 0;
  v_reassigned_baskets integer := 0;
  v_reassigned_comp_entries integer := 0;
  v_reassigned_messages integer := 0;
  v_reassigned_reads integer := 0;
  v_row_count integer := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_source_user_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Source and target user ids are required';
  END IF;

  IF p_source_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Source and target must be different users';
  END IF;

  SELECT * INTO v_source
  FROM profiles
  WHERE id = p_source_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source user not found';
  END IF;

  SELECT * INTO v_target
  FROM profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  IF v_source.is_disabled THEN
    RAISE EXCEPTION 'Source account is already disabled';
  END IF;

  IF v_target.is_disabled THEN
    RAISE EXCEPTION 'Target account is disabled';
  END IF;

  FOR v_membership IN
    SELECT *
    FROM class_memberships
    WHERE user_id = p_source_user_id
    ORDER BY joined_at
  LOOP
    SELECT *
    INTO v_target_membership
    FROM class_memberships
    WHERE user_id = p_target_user_id
      AND class_id = v_membership.class_id
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      IF v_target_membership.group_id IS NULL AND v_membership.group_id IS NOT NULL THEN
        UPDATE class_memberships
        SET group_id = v_membership.group_id
        WHERE id = v_target_membership.id;
      END IF;

      DELETE FROM class_memberships
      WHERE id = v_membership.id;
    ELSE
      UPDATE class_memberships
      SET user_id = p_target_user_id
      WHERE id = v_membership.id;
      v_merged_memberships := v_merged_memberships + 1;
    END IF;
  END LOOP;

  UPDATE portfolios
  SET owner_id = p_target_user_id
  WHERE owner_type IN ('user', 'competition')
    AND owner_id = p_source_user_id;
  GET DIAGNOSTICS v_reassigned_portfolios = ROW_COUNT;

  UPDATE trades
  SET user_id = p_target_user_id
  WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_reassigned_trades = ROW_COUNT;

  DELETE FROM investment_theses src
  USING investment_theses tgt
  WHERE src.user_id = p_source_user_id
    AND tgt.user_id = p_target_user_id
    AND src.side IS NOT NULL
    AND tgt.side IS NOT NULL
    AND COALESCE(src.ticker, '') = COALESCE(tgt.ticker, '')
    AND src.created_at::date = tgt.created_at::date
    AND src.id <> tgt.id;

  UPDATE investment_theses
  SET user_id = p_target_user_id
  WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_reassigned_theses = ROW_COUNT;

  UPDATE custom_baskets
  SET user_id = p_target_user_id
  WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_reassigned_baskets = ROW_COUNT;

  IF to_regclass('public.training_progress') IS NOT NULL THEN
    SELECT column_name
    INTO v_progress_key
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'training_progress'
      AND column_name IN ('training_step_id', 'training_module_id')
    ORDER BY CASE WHEN column_name = 'training_step_id' THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_progress_key IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO training_progress (user_id, %1$I, completed, completed_at, created_at)
         SELECT $1, %1$I, bool_or(completed), max(completed_at), min(created_at)
         FROM training_progress
         WHERE user_id IN ($1, $2)
         GROUP BY %1$I
         ON CONFLICT (user_id, %1$I)
         DO UPDATE SET
           completed = training_progress.completed OR excluded.completed,
           completed_at = GREATEST(training_progress.completed_at, excluded.completed_at),
           created_at = LEAST(training_progress.created_at, excluded.created_at)',
        v_progress_key
      )
      USING p_target_user_id, p_source_user_id;

      EXECUTE 'DELETE FROM training_progress WHERE user_id = $1'
      USING p_source_user_id;
    END IF;
  END IF;

  INSERT INTO message_reads (message_id, user_id, read_at)
  SELECT mr.message_id, p_target_user_id, MIN(mr.read_at)
  FROM message_reads mr
  WHERE mr.user_id IN (p_source_user_id, p_target_user_id)
  GROUP BY mr.message_id
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET read_at = LEAST(message_reads.read_at, EXCLUDED.read_at);

  DELETE FROM message_reads
  WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS v_reassigned_reads = ROW_COUNT;

  UPDATE messages
  SET sender_id = p_target_user_id
  WHERE sender_id = p_source_user_id;
  GET DIAGNOSTICS v_reassigned_messages = ROW_COUNT;

  UPDATE messages
  SET recipient_id = p_target_user_id
  WHERE recipient_type = 'user'
    AND recipient_id = p_source_user_id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_reassigned_messages := v_reassigned_messages + v_row_count;

  INSERT INTO follows (follower_id, followed_id, created_at)
  SELECT p_target_user_id, f.followed_id, MIN(f.created_at)
  FROM follows f
  WHERE f.follower_id = p_source_user_id
    AND f.followed_id NOT IN (p_source_user_id, p_target_user_id)
  GROUP BY f.followed_id
  ON CONFLICT (follower_id, followed_id) DO NOTHING;

  INSERT INTO follows (follower_id, followed_id, created_at)
  SELECT f.follower_id, p_target_user_id, MIN(f.created_at)
  FROM follows f
  WHERE f.followed_id = p_source_user_id
    AND f.follower_id NOT IN (p_source_user_id, p_target_user_id)
  GROUP BY f.follower_id
  ON CONFLICT (follower_id, followed_id) DO NOTHING;

  DELETE FROM follows
  WHERE follower_id = p_source_user_id
     OR followed_id = p_source_user_id;

  UPDATE profiles p
  SET follower_count = COALESCE((SELECT COUNT(*) FROM follows f WHERE f.followed_id = p.id), 0),
      following_count = COALESCE((SELECT COUNT(*) FROM follows f WHERE f.follower_id = p.id), 0)
  WHERE p.id IN (p_source_user_id, p_target_user_id);

  IF to_regclass('public.competition_entries') IS NOT NULL THEN
    DELETE FROM competition_entries src
    USING competition_entries tgt
    WHERE src.user_id = p_source_user_id
      AND tgt.user_id = p_target_user_id
      AND src.competition_id = tgt.competition_id
      AND src.id <> tgt.id;

    UPDATE competition_entries
    SET user_id = p_target_user_id
    WHERE user_id = p_source_user_id;
    GET DIAGNOSTICS v_reassigned_comp_entries = ROW_COUNT;
  END IF;

  IF to_regclass('public.competitions') IS NOT NULL THEN
    UPDATE competitions
    SET created_by = p_target_user_id
    WHERE created_by = p_source_user_id;
  END IF;

  IF to_regclass('public.teacher_invite_codes') IS NOT NULL THEN
    UPDATE teacher_invite_codes
    SET created_by = p_target_user_id
    WHERE created_by = p_source_user_id;

    UPDATE teacher_invite_codes
    SET used_by = p_target_user_id
    WHERE used_by = p_source_user_id;
  END IF;

  UPDATE classes
  SET teacher_id = p_target_user_id
  WHERE teacher_id = p_source_user_id;

  UPDATE profiles
  SET is_disabled = true,
      merged_into_id = p_target_user_id,
      merge_note = COALESCE(
        NULLIF(TRIM(p_note), ''),
        format('Merged into %s (%s) on %s', v_target.full_name, v_target.email, now()::date)
      )
  WHERE id = p_source_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'source_user_id', p_source_user_id,
    'target_user_id', p_target_user_id,
    'memberships_merged', v_merged_memberships,
    'portfolios_reassigned', v_reassigned_portfolios,
    'trades_reassigned', v_reassigned_trades,
    'theses_reassigned', v_reassigned_theses,
    'baskets_reassigned', v_reassigned_baskets,
    'competition_entries_reassigned', v_reassigned_comp_entries,
    'messages_reassigned', v_reassigned_messages,
    'message_reads_reassigned', v_reassigned_reads
  );
END;
$$;

REVOKE ALL ON FUNCTION merge_user_accounts(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_user_accounts(uuid, uuid, text) TO authenticated;
