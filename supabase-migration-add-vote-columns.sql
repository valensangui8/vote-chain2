-- Migration: Add missing columns to votes and candidates tables
-- Run this in Supabase SQL Editor if you already have these tables

-- =======================
-- VOTES TABLE UPDATES
-- =======================

-- Add voter_privy_user_id column
ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_privy_user_id text;

-- Add tx_hash column
ALTER TABLE votes ADD COLUMN IF NOT EXISTS tx_hash text;

-- Add cascade delete to election_id foreign key (if not already set)
DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_election_id_fkey;
  
  -- Add new constraint with cascade
  ALTER TABLE votes ADD CONSTRAINT votes_election_id_fkey 
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Ignore if constraint already exists
END $$;

-- =======================
-- CANDIDATES TABLE UPDATES
-- =======================

-- Add vote_count column
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS vote_count integer DEFAULT 0;

-- Add cascade delete to election_id foreign key (if not already set)
DO $$
BEGIN
  -- Drop old constraint if exists
  ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_election_id_fkey;
  
  -- Add new constraint with cascade
  ALTER TABLE candidates ADD CONSTRAINT candidates_election_id_fkey 
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Ignore if constraint already exists
END $$;

-- =======================
-- VERIFY CHANGES
-- =======================

-- Check votes table columns
SELECT 'votes' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'votes'
UNION ALL
-- Check candidates table columns
SELECT 'candidates' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'candidates'
ORDER BY table_name, ordinal_position;

