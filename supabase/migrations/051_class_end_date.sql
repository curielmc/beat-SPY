-- End date for a class (when the investing competition closes).
ALTER TABLE classes ADD COLUMN IF NOT EXISTS end_date date;
