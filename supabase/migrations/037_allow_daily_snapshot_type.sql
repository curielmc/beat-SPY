-- Allow 'daily' as a valid snapshot_type (was only 'reset', 'close')
ALTER TABLE portfolio_snapshots DROP CONSTRAINT portfolio_snapshots_snapshot_type_check;
ALTER TABLE portfolio_snapshots ADD CONSTRAINT portfolio_snapshots_snapshot_type_check
  CHECK (snapshot_type = ANY (ARRAY['reset', 'close', 'daily']));
