-- Add staged_bet column to players table if it doesn't exist
ALTER TABLE players ADD COLUMN IF NOT EXISTS staged_bet INTEGER DEFAULT 0;

-- Optional: Reset existing staged bets to 0 just in case
UPDATE players SET staged_bet = 0;
