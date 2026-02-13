import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// Type for a Player in the room
export interface Player {
    id: string;
    name: string;
    isHost: boolean;
    onlineAt: string;
    seatIndex: number; // 0-8
    avatar: string;
    balance: number;
    currentBet: number;
    stagedBet: number;
    color?: string;
    isDealer?: boolean; // Added for Dealer Button (D)
}

export type GameStatus = 'waiting' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface RoomState {
    id: string;
    status: GameStatus;
    pot: number;
    dealerIndex: number;
}

export interface BetPayload {
    type: 'stage' | 'bet';
    amount: number;
    playerId: string;
    timestamp: number;
    velocity?: number;
}

// ...


// Generate a random 6-character Room ID
const generateRoomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const usePokerRoom = () => {
    const [roomId, setRoomId] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [players, setPlayers] = useState<Player[]>([]);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [myPlayerId, setMyPlayerId] = useState<string>('');
    const [pot, setPot] = useState<number>(0);
    const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
    const [dealerIndex, setDealerIndex] = useState<number>(-1);

    const channelRef = useRef<RealtimeChannel | null>(null);

    // Local state for my player info before joining (used for initial insert)
    const myInfoRef = useRef<{ name: string; avatar: string; seatIndex: number; balance: number; currentBet: number }>({
        name: 'Player',
        avatar: '👤',
        seatIndex: -1,
        balance: 0,
        currentBet: 0,
    });

    const cleanup = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    // Generate or retrieve persistent ID
    useEffect(() => {
        let id = window.localStorage.getItem('poker_player_id');
        if (!id) {
            id = `player_${Math.random().toString(36).substr(2, 9)}`;
            window.localStorage.setItem('poker_player_id', id);
        }
        setMyPlayerId(id);
    }, []);

    // Callback for receiving bets (optional)
    const onBetRef = useRef<((payload: BetPayload) => void) | null>(null);

    // Register callback
    const setOnBet = (callback: (payload: BetPayload) => void) => {
        onBetRef.current = callback;
    };

    // ----------------------------------------------------------------
    // Database Logic for Realtime Sync
    // ----------------------------------------------------------------
    const connectToRoom = useCallback(async (roomIdToConnect: string) => {
        cleanup();
        setStatus('connecting');

        // 1. Initial Fetch
        const { data: existingPlayers, error } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomIdToConnect);

        if (error) {
            console.error('Error fetching players:', error);
            setStatus('error');
            return;
        }

        // Map DB rows to local Player type
        const mapPlayers = (rows: any[]): Player[] => {
            return rows.map(row => {
                const isMe = row.user_id === myPlayerId;
                if (isMe) {
                    setIsHost(row.is_host);
                    // Sync local ref for consistency (though UI usually reads from 'players')
                    myInfoRef.current = {
                        name: row.name,
                        avatar: row.avatar,
                        seatIndex: row.seat_index,
                        balance: row.balance,
                        currentBet: row.current_bet
                    };
                }

                return {
                    id: row.user_id, // We use user_id as the primary key for logic, though DB has uuid
                    name: row.name,
                    isHost: row.is_host,
                    onlineAt: row.last_seen,
                    seatIndex: row.seat_index,
                    avatar: row.avatar,
                    balance: row.balance,
                    currentBet: row.current_bet,
                    stagedBet: row.staged_bet || 0,
                    color: row.color,
                };
            });
        };

        const initialMappedPlayers = mapPlayers(existingPlayers || []);
        setPlayers(initialMappedPlayers);

        // Fetch Room State
        const { data: roomData } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomIdToConnect)
            .single();

        if (roomData) {
            setPot(roomData.pot || 0);
            setGameStatus(roomData.game_status || 'waiting');
            setDealerIndex(roomData.dealer_index ?? -1);
        }

        setStatus('connected');

        // 2. Subscribe to Changes
        const channel = supabase
            .channel(`room_db:${roomIdToConnect}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'players',
                    filter: `room_id=eq.${roomIdToConnect}`,
                },
                async (payload) => {
                    // ... (keep existing postgres_changes logic)
                    // Refresh players on any change
                    const { data: freshPlayers } = await supabase
                        .from('players')
                        .select('*')
                        .eq('room_id', roomIdToConnect);

                    if (freshPlayers) {
                        const mapped = mapPlayers(freshPlayers);
                        setPlayers(mapped);
                    }

                    // Also watch rooms for pot/status changes
                    const { data: roomData } = await supabase
                        .from('rooms')
                        .select('*')
                        .eq('id', roomIdToConnect)
                        .single();

                    if (roomData) {
                        setPot(roomData.pot || 0);
                        setGameStatus(roomData.game_status || 'waiting');
                        setDealerIndex(roomData.dealer_index ?? -1);
                    }

                    if (payload.eventType === 'UPDATE' && onBetRef.current) {
                        const oldRecord = payload.old as any;
                        const newRecord = payload.new as any;

                        // 1. Staged Bet Increased - REMOVED (Handled by Broadcast)
                        /*
                       if (newRecord.staged_bet > oldRecord.staged_bet) {
                            // ...
                       }
                       */

                        // 2. Current Bet Increased (Fly Stage -> Pot)
                        if (newRecord.current_bet > oldRecord.current_bet) {
                            const diff = newRecord.current_bet - oldRecord.current_bet;
                            onBetRef.current({
                                type: 'bet',
                                amount: diff,
                                playerId: newRecord.user_id,
                                timestamp: Date.now(),
                            });
                        }
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'stage_animation' },
                (payload) => {
                    if (onBetRef.current) {
                        onBetRef.current({
                            type: 'stage',
                            amount: payload.payload.amount,
                            velocity: payload.payload.velocity,
                            playerId: payload.payload.playerId,
                            timestamp: Date.now(),
                        });
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // setStatus('connected'); // Already set above
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setStatus('error');
                    console.error('Supabase channel error:', status);
                }
            });

        channelRef.current = channel;
    }, [cleanup, myPlayerId]); // Added myPlayerId dependency


    // Create Room -> Insert into DB
    const createRoom = async () => {
        const newRoomId = generateRoomId();

        const { error: roomError } = await supabase
            .from('rooms')
            .insert([{ id: newRoomId, game_status: 'waiting', pot: 0 }]);

        if (roomError) {
            console.error('Failed to create room:', roomError);
            alert(`Failed to create room: ${roomError.message}`);
            setStatus('error');
            return null;
        }

        setRoomId(newRoomId);
        setIsHost(true);

        // Host inserts themselves as a player
        const { error: playerError } = await supabase
            .from('players')
            .upsert({
                room_id: newRoomId,
                user_id: myPlayerId, // Use the persistent player ID
                name: 'Host', // Default name for host
                seat_index: -1, // Host typically doesn't occupy a seat
                avatar: '👑', // Host avatar
                balance: 999999, // Effectively infinite balance for host
                current_bet: 0,
                is_host: true,
                last_seen: new Date().toISOString()
            }, { onConflict: 'room_id, user_id' });

        if (playerError) {
            console.error('Error inserting host player:', playerError);
            alert(`Error inserting host player: ${playerError.message}`);
            setStatus('error');
            return null;
        }

        connectToRoom(newRoomId);
        return newRoomId;
    };

    // Join Room -> Insert Player Row
    const joinRoom = async (id: string, name: string, seatIndex: number, avatar: string, buyIn: number, color: string) => {
        setRoomId(id);

        // Check if I am already HOST in this room to prevent demotion
        const { data: existingMe } = await supabase
            .from('players')
            .select('is_host')
            .eq('room_id', id)
            .eq('user_id', myPlayerId)
            .single();

        if (existingMe && existingMe.is_host) {
            console.log('User is already host, resuming as host...');
            setIsHost(true);
            connectToRoom(id);
            return;
        }

        setIsHost(false);
        myInfoRef.current = { name, seatIndex, avatar, balance: buyIn, currentBet: 0, color: color } as any;

        // Insert Player into DB
        // Check if already joined? (Upsert)
        const { error } = await supabase
            .from('players')
            .upsert({
                room_id: id,
                user_id: myPlayerId,
                name: name,
                seat_index: seatIndex,
                avatar: avatar,
                balance: buyIn,
                current_bet: 0,
                is_host: false,
                last_seen: new Date().toISOString(),
                color: color
            }, { onConflict: 'room_id, user_id' });

        if (error) {
            console.error('Error joining room:', error);
            alert('Failed to join room. Seat might be taken?');
            return;
        }

        connectToRoom(id);
    };

    // Stage Bet -> Update DB for visuals only
    const stageBet = async (amount: number, delta?: number, velocity?: number) => {
        if (!roomId || !myPlayerId) return;

        // 1. Update DB (State Persistence)
        const { error } = await supabase
            .from('players')
            .update({ staged_bet: amount, last_seen: new Date().toISOString() })
            .eq('room_id', roomId)
            .eq('user_id', myPlayerId);

        if (error) console.error('Stage bet failed:', error);

        // 2. Broadcast Animation (Visuals)
        if (delta && velocity && channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'stage_animation',
                payload: { amount: delta, velocity, playerId: myPlayerId }
            });
        }
    };

    // Confirm Bet -> Commit Staged to Current -> Update DB
    const confirmBet = async (amount: number) => {
        if (!roomId || !myPlayerId) return;

        const myPlayer = players.find(p => p.id === myPlayerId);
        if (!myPlayer) return;

        if (amount <= 0) return;

        if (myPlayer.balance < amount) {
            console.warn('Insufficient balance for staged bet');
            return;
        }

        const newBalance = myPlayer.balance - amount;
        const newBet = myPlayer.currentBet + amount;

        const { error } = await supabase
            .from('players')
            .update({
                balance: newBalance,
                current_bet: newBet,
                staged_bet: 0,
                last_seen: new Date().toISOString()
            })
            .eq('room_id', roomId)
            .eq('user_id', myPlayerId);

        if (error) console.error('Confirm bet failed:', error);
    };

    // Clear Staged Bet
    const clearBet = async () => {
        if (!roomId || !myPlayerId) return;

        const { error } = await supabase
            .from('players')
            .update({ staged_bet: 0, last_seen: new Date().toISOString() })
            .eq('room_id', roomId)
            .eq('user_id', myPlayerId);

        if (error) console.error('Clear bet failed:', error);
    };

    // Send Bet -> Update Player Row
    const sendBet = async (amount: number) => {
        if (!roomId || !myPlayerId) return;

        // 1. Get current state from local (optimistic) or DB?
        // We need to know current balance to check if valid.
        const myPlayer = players.find(p => p.id === myPlayerId);
        if (!myPlayer) {
            console.error('My player not found in current state.');
            return;
        }

        if (myPlayer.balance < amount) {
            console.warn('Insufficient balance');
            return;
        }

        const newBalance = myPlayer.balance - amount;
        const newBet = myPlayer.currentBet + amount;

        // Update DB
        const { error } = await supabase
            .from('players')
            .update({ balance: newBalance, current_bet: newBet, last_seen: new Date().toISOString() })
            .eq('room_id', roomId)
            .eq('user_id', myPlayerId);

        if (error) {
            console.error('Bet failed:', error);
        }
    };

    // Auto-cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    const leaveRoom = useCallback(() => {
        cleanup();
        setRoomId(null);
        setPlayers([]);
        setStatus('idle');
        setPot(0);
        setIsHost(false);
    }, [cleanup]);

    // Resume as Host or Player
    const resumeHost = async (roomIdToResume: string): Promise<boolean> => {
        // 1. Check if room exists
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('id', roomIdToResume)
            .single();

        if (roomError || !room) {
            alert('Room does not exist.');
            return false;
        }

        // 2. Check integrity
        const { data: player, error: playerError } = await supabase
            .from('players')
            .select('is_host')
            .eq('room_id', roomIdToResume)
            .eq('user_id', myPlayerId)
            .single();

        if (playerError || !player) {
            alert('You are not a member of this room.');
            return false;
        }

        // 3. Connect
        setRoomId(roomIdToResume);
        setIsHost(player.is_host);
        connectToRoom(roomIdToResume);
        return true;
    };

    // Check if room exists and if I am already in it
    const checkRoom = async (roomIdCheck: string) => {
        // 1. Check Room Exists
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('id')
            .eq('id', roomIdCheck)
            .single();

        if (roomError || !room) {
            return { exists: false, member: false, occupiedSeats: [], takenNames: [] };
        }

        // 2. Fetch ALL players to determine state
        const { data: roomPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomIdCheck);

        const playersList = roomPlayers || [];

        // Check if I am already in
        const myPlayer = playersList.find(p => p.user_id === myPlayerId);

        // Gather validation data
        const occupiedSeats = playersList.map(p => p.seat_index).filter(s => s >= 0); // Filter out host (-1)
        const takenNames = playersList.map(p => p.name);

        if (myPlayer) {
            return { exists: true, member: true, player: myPlayer, occupiedSeats, takenNames };
        }

        return { exists: true, member: false, occupiedSeats, takenNames };
    };

    // DEALER ACTIONS -----------------------------------------------

    // 1. Collect all confirmed bets (current_bet) into pot
    const collectBets = async () => {
        if (!roomId || !isHost) return;

        // Calculate total to add
        const currentTotalBet = players.reduce((sum, p) => sum + (p.currentBet || 0), 0);
        if (currentTotalBet === 0) return;

        // Transactional update: Add to Room Pot AND Clear all Player currentBets
        // Note: Supabase doesn't have multi-table transactions in a single JS call easily without RPC
        // We'll use a sequence, but for high stakes a Stored Procedure is better.

        // Update Players in this room: current_bet = 0
        const { error: pError } = await supabase
            .from('players')
            .update({ current_bet: 0, last_seen: new Date().toISOString() })
            .eq('room_id', roomId);

        if (pError) console.error('Error clearing player bets:', pError);

        // Update Room Pot
        const { error: rError } = await supabase
            .from('rooms')
            .update({ pot: pot + currentTotalBet })
            .eq('id', roomId);

        if (rError) console.error('Error updating pot:', rError);
    };

    // 2. Distribute Pot to winner(s)
    const distributePot = async (winnerId: string) => {
        if (!roomId || !isHost || pot <= 0) return;

        const winner = players.find(p => p.id === winnerId);
        if (!winner) return;

        // Add pot to winner balance
        const { error: pError } = await supabase
            .from('players')
            .update({
                balance: winner.balance + pot,
                last_seen: new Date().toISOString()
            })
            .eq('user_id', winnerId)
            .eq('room_id', roomId);

        if (pError) console.error('Error giving pot to winner:', pError);

        // Clear Room Pot
        const { error: rError } = await supabase
            .from('rooms')
            .update({ pot: 0 })
            .eq('id', roomId);

        if (rError) console.error('Error clearing pot:', rError);
    };

    // 3. Update Game Status
    const updateGameStatus = async (newStatus: GameStatus) => {
        if (!roomId || !isHost) return;
        const { error } = await supabase
            .from('rooms')
            .update({ game_status: newStatus })
            .eq('id', roomId);

        if (error) console.error('Error updating status:', error);
    };

    // 4. Set Dealer Seat
    const setDealerSeat = async (index: number) => {
        if (!roomId || !isHost) return;
        const { error } = await supabase
            .from('rooms')
            .update({ dealer_index: index })
            .eq('id', roomId);

        if (error) console.error('Error setting dealer index:', error);
    };

    return {
        roomId,
        isHost,
        players,
        status,
        myPlayerId,
        pot,
        gameStatus,
        dealerIndex,
        createRoom,
        joinRoom,
        leaveRoom,
        resumeHost,
        checkRoom,
        sendBet,
        stageBet,
        confirmBet,
        clearBet,
        setOnBet,
        collectBets,
        distributePot,
        updateGameStatus,
        setDealerSeat,
    };
};
