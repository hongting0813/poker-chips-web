-- Add color column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#000000';
