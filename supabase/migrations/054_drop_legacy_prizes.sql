-- Migration 054: drop legacy `prizes` column on competitions
-- Data was migrated to prize_allocation in 053.
ALTER TABLE competitions DROP COLUMN prizes;
