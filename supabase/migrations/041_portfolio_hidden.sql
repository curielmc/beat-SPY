-- Allow teachers to hide funds from the student leaderboard
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT false;
