-- Migration: Add Turn-based Betting System
-- Date: 2026-02-14

-- Add columns to rooms table for turn management
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS current_turn_seat_index INTEGER DEFAULT -1,
ADD COLUMN IF NOT EXISTS current_highest_bet INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS betting_round_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS game_status TEXT DEFAULT 'waiting',
ADD COLUMN IF NOT EXISTS dealer_index INTEGER DEFAULT -1;

-- Add columns to players table for player actions
ALTER TABLE players
ADD COLUMN IF NOT EXISTS player_action TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS has_acted_this_round BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS staged_bet INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#10b981';

-- Add comments for documentation
COMMENT ON COLUMN rooms.current_turn_seat_index IS '當前輪到的座位索引 (-1 表示未開始)';
COMMENT ON COLUMN rooms.current_highest_bet IS '本輪最高下注額';
COMMENT ON COLUMN rooms.betting_round_complete IS '本輪下注是否完成';
COMMENT ON COLUMN rooms.game_status IS '遊戲狀態: waiting, pre-flop, flop, turn, river, showdown';
COMMENT ON COLUMN rooms.dealer_index IS 'Dealer Button 所在座位';

COMMENT ON COLUMN players.player_action IS '玩家動作: check, bet, call, raise, fold';
COMMENT ON COLUMN players.has_acted_this_round IS '本輪是否已行動';
COMMENT ON COLUMN players.staged_bet IS '暫存下注金額';
COMMENT ON COLUMN players.avatar_color IS '頭像背景顏色';
