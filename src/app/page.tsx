// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Chip from '@/components/Chip';
import DraggableChip from '@/components/DraggableChip';
import ChipStack from '@/components/ChipStack';
import JoinRoom from '@/components/JoinRoom';
import DealerJoin from '@/components/DealerJoin';
import { usePokerRoom, BetPayload } from '@/hooks/usePokerRoom';
import { CHIP_VALUES } from '@/constants/chips'; // Use shared constants

type ViewMode = 'dealer' | 'player';

interface FlyingChip {
    id: string;
    amount: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    type?: 'stage' | 'bet';
    duration?: number;
    onComplete?: () => void;
}
// ...

export default function Home() {
    const [view, setView] = useState<ViewMode>('dealer');
    const [dealerMode, setDealerMode] = useState<'menu' | 'join'>('menu');
    const [setupStep, setSetupStep] = useState(1);
    const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([]);
    const [incomingBets, setIncomingBets] = useState<Record<string, number>>({});
    const [stagedBetSums, setStagedBetSums] = useState<Record<string, number>>({});
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [localBalance, setLocalBalance] = useState(0);

    // Staged Betting State
    const [stagedAmount, setStagedAmount] = useState(0);

    // Responsive Window Size
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const {
        roomId,
        isHost,
        players,
        status,
        createRoom,
        joinRoom,
        resumeHost, // Added
        leaveRoom, // Added
        sendBet,
        stageBet,
        confirmBet,
        clearBet,
        setOnBet,
        pot,
        myPlayerId,
        checkRoom,
        gameStatus,
        dealerIndex,
        collectBets,
        distributePot,
        updateGameStatus,
        setDealerSeat,
    } = usePokerRoom();

    // Handle Browser Back Button
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            leaveRoom();
            setView('dealer'); // Return to dealer view on back
            setSetupStep(1);   // Reset setup step
            setDealerMode('menu'); // Reset dealer mode
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [leaveRoom]);

    const handleHome = () => {
        if (window.history.state) {
            window.history.back();
        } else {
            leaveRoom();
            setView('dealer');
            setSetupStep(1);   // Reset setup step
            setDealerMode('menu'); // Reset dealer mode
        }
    };

    // Find myself
    const myPlayer = players.find(p => p.id === myPlayerId);

    // Sync stagedBetSums with DB source of truth to handle eventual consistency
    useEffect(() => {
        setStagedBetSums(prev => {
            const next = { ...prev };
            let changed = false;
            players.forEach(p => {
                const dbValue = p.stagedBet;
                const current = next[p.id] || 0;

                let newValue = current;
                if (dbValue === 0) {
                    // Reset (Clear/Confirm)
                    newValue = 0;
                } else {
                    // Keep the larger of local vs DB (handles DB latency)
                    newValue = Math.max(current, dbValue);
                }

                if (newValue !== current) {
                    next[p.id] = newValue;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [players]);

    const handleStageBet = (amount: number, velocity?: number) => {
        if (!myPlayer) return;
        const currentStaged = stagedAmount;
        const newStaged = currentStaged + amount;

        if (newStaged > myPlayer.balance) return;

        setStagedAmount(newStaged);
        stageBet(newStaged, amount, velocity); // Sync to DB
    };

    const handleClearBet = () => {
        setStagedAmount(0);
        clearBet(); // Sync to DB
    };

    const handleAllIn = () => {
        if (myPlayer) {
            const allInAmount = myPlayer.balance;
            setStagedAmount(allInAmount);
            stageBet(allInAmount);
        }
    };

    const handleConfirmBet = () => {
        if (stagedAmount > 0) {
            confirmBet(stagedAmount); // Atomic update
            setStagedAmount(0);
        }
    };

    // Auto-switch view
    useEffect(() => {
        if (status === 'connected') {
            setView(isHost ? 'dealer' : 'player');
        }
    }, [status, isHost]);

    // Helper for Seat Coordinates
    const getSeatCoordinates = (index: number) => {
        const totalSeats = 9;
        const angleOffset = Math.PI / 2;
        const angle = (index / totalSeats) * 2 * Math.PI + angleOffset;

        let radiusX = 420;
        let radiusY = 280;

        const isMobile = windowSize.width < 768;
        const isLandscape = windowSize.width > windowSize.height;

        if (windowSize.width > 0) {
            if (isMobile) {
                if (isLandscape) {
                    radiusX = Math.min(windowSize.width / 2 - 80, 350);
                    radiusY = Math.max(120, windowSize.height / 2 - 40);
                } else {
                    radiusX = Math.min(windowSize.width / 2 - 40, 180);
                    radiusY = Math.min(windowSize.height / 2 - 80, 400);
                }
            } else if (windowSize.width < 1024) {
                radiusX = 350;
                radiusY = 240;
            }
        }

        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY;
        return { x, y };
    };

    const getSeatStyle = (index: number) => {
        const { x, y } = getSeatCoordinates(index);
        return { transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` };
    };

    const getStagedCoordinates = (index: number) => {
        const { x, y } = getSeatCoordinates(index);
        return { x: x * 0.55, y: y * 0.55 }; // 55% distance (even further from avatar, closer to center)
    };

    // Setup dealer listener for bets
    useEffect(() => {
        if (view === 'dealer') {
            setOnBet((payload: BetPayload) => {
                const player = players.find(p => p.id === payload.playerId);
                // Default start position (Bottom Center) if player not found (e.g. race condition or ghost event)
                let startX = windowSize.width / 2;
                let startY = windowSize.height + 100;
                let endX = 0, endY = 0;

                if (player) {
                    const seatCoords = getSeatCoordinates(player.seatIndex);
                    const stageCoords = getStagedCoordinates(player.seatIndex);

                    if (payload.type === 'stage') {
                        // Seat -> Staged Area
                        startX = seatCoords.x;
                        startY = seatCoords.y;
                        endX = stageCoords.x;
                        endY = stageCoords.y;

                        // Register incoming bet to hide it from staged area temporarily
                        setIncomingBets(prev => ({
                            ...prev,
                            [payload.playerId]: (prev[payload.playerId] || 0) + payload.amount
                        }));

                        // Optimistically update sum to prepare for landing
                        setStagedBetSums(prev => ({
                            ...prev,
                            [payload.playerId]: (prev[payload.playerId] || 0) + payload.amount
                        }));
                    } else {
                        // Bet (Confirm) -> Staged Area -> Pot (Center) 
                        // (Note: payload.amount is the diff, so it matches what we confirm)
                        startX = stageCoords.x;
                        startY = stageCoords.y;
                        endX = 0;
                        endY = 0;

                        // Immediately clear staged chips visually to avoid "double chips" look
                        setStagedBetSums(prev => ({
                            ...prev,
                            [payload.playerId]: 0
                        }));
                    }
                }

                // Calculate duration based on velocity (if provided)
                // Default 0.6s. High velocity -> faster (e.g. 0.3s).
                // Velocity from use-gesture is usually px/ms. e.g. 0.5 to 5.
                const baseDuration = 0.6;
                // Scale velocity: e.g. 5px/ms is very fast.
                const speedFactor = payload.velocity ? Math.abs(payload.velocity) / 5 : 0;
                const duration = Math.max(0.25, baseDuration - (speedFactor * 0.3));

                const newChip: FlyingChip = {
                    id: `${payload.timestamp}-${Math.random()}`,
                    amount: payload.amount,
                    startX, startY, endX, endY,
                    type: payload.type,
                    duration,
                    onComplete: () => {
                        if (payload.type === 'stage') {
                            setIncomingBets(prev => {
                                const current = prev[payload.playerId] || 0;
                                const next = Math.max(0, current - payload.amount);
                                const newState = { ...prev, [payload.playerId]: next };
                                if (next === 0) delete newState[payload.playerId];
                                return newState;
                            });
                        }
                    }
                };
                setFlyingChips(prev => [...prev, newChip]);

                // Cleanup after animation duration
                // Adding a small buffer to ensure visual completion
                setTimeout(() => {
                    setFlyingChips(prev => {
                        const chip = prev.find(c => c.id === newChip.id);
                        if (chip && chip.onComplete) {
                            chip.onComplete();
                        }
                        return prev.filter(c => c.id !== newChip.id);
                    });
                }, duration * 1000 + 50);
            });
        }
    }, [view, setOnBet, players, windowSize]);


    // ... (rest of render)

    // Helper for Responsive Pot styling
    const isMobile = windowSize.width < 768;
    const isPortrait = windowSize.height > windowSize.width;

    const potStyle = isMobile && isPortrait
        ? { width: '85%', height: '420px', borderRadius: '140px' } // Larger Mobile Portrait
        : windowSize.width > 0 && isMobile
            ? { width: '400px', height: '200px', borderRadius: '100px' } // Mobile Lanscape
            : {}; // Fallback to class names for desktop

    return (
        <main className="h-[100dvh] w-full bg-green-900 flex flex-col items-center justify-center overflow-hidden relative">
            {/* Background Texture Effect */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent opacity-30 mix-blend-overlay"></div>

            {/* Dev Mode View Toggle - Hidden when connected or in setup screens */}
            {status !== 'connected' && dealerMode !== 'join' && setupStep === 1 && (
                <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50 flex gap-2 bg-black/40 p-1 rounded-full backdrop-blur-sm border border-white/10">
                    <button
                        onClick={() => setView('dealer')}
                        className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${view === 'dealer' ? 'bg-white text-green-950 shadow-lg' : 'text-white/70 hover:text-white'}`}
                    >
                        DEALER
                    </button>
                    <button
                        onClick={() => setView('player')}
                        className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${view === 'player' ? 'bg-white text-green-950 shadow-lg' : 'text-white/70 hover:text-white'}`}
                    >
                        PLAYER
                    </button>
                </div>
            )}

            {/* Connection Status Indicator */}
            <div className={`fixed top-4 left-4 md:top-6 md:left-6 z-50 px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2 border ${status === 'connected' ? 'bg-green-500/20 border-green-500/50 text-green-200' :
                status === 'connecting' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200' :
                    status === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-200' :
                        'bg-black/20 border-white/10 text-white/40'
                }`}>
                <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400 animate-pulse' :
                    status === 'connecting' ? 'bg-yellow-400' :
                        status === 'error' ? 'bg-red-400' : 'bg-gray-400'
                    }`}></div>
                {status.toUpperCase()}
            </div>

            {/* Room ID - Responsive Positioning (Top Right with Home) */}
            {roomId && (
                <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50 
                        pl-1 pr-5 py-1 
                        bg-black/40 backdrop-blur-md rounded-full border border-white/10 
                        flex items-center gap-3 shadow-lg transition-all hover:bg-black/50 group">
                    <button
                        onClick={handleHome}
                        className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all active:scale-95 border border-white/5 group-hover:bg-white/20"
                        aria-label="Home"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </button>

                    <div className="flex flex-col">
                        <span className="text-white/30 text-[9px] md:text-[10px] font-mono uppercase tracking-widest leading-none mb-0.5">Room ID</span>
                        <span className="text-lg md:text-xl font-mono font-bold text-yellow-400 tracking-[0.1em] leading-none">{roomId}</span>
                    </div>
                </div>
            )}

            {view === 'dealer' ? (
                // Dealer View (Main Screen)
                <div className="flex flex-col items-center z-10 w-full max-w-7xl relative h-full justify-center origin-center transition-transform duration-300 p-4">

                    {!roomId ? (
                        dealerMode === 'join' ? (
                            <DealerJoin
                                onResume={async (id) => {
                                    const success = await resumeHost(id);
                                    if (success) {
                                        window.history.pushState({ room: 'host' }, '');
                                        setDealerMode('menu');
                                    }
                                }}
                                onBack={() => setDealerMode('menu')}
                            />
                        ) : (
                            <div className="flex flex-col items-center scale-75 md:scale-100">
                                <h1 className="text-5xl font-black text-white/90 mb-8 tracking-[0.2em] drop-shadow-2xl border-b-4 border-white/20 pb-4">
                                    POKER TABLE
                                </h1>
                                <div className="flex flex-col gap-4 w-full max-w-xs md:max-w-sm">
                                    <button
                                        onClick={() => {
                                            createRoom();
                                            window.history.pushState({ room: 'host' }, '');
                                        }}
                                        className="w-full px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-black text-xl rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 text-center"
                                    >
                                        CREATE TABLE
                                    </button>
                                    <button
                                        onClick={() => setDealerMode('join')}
                                        className="w-full px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xl rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 border-2 border-white/10 text-center"
                                    >
                                        RESUME TABLE
                                    </button>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center w-full relative h-[600px] md:h-[700px]">
                            {/* Room ID Removed from here (moved to fixed) */}

                            {/* Central Pot Area */}
                            <div
                                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      ${isMobile && isPortrait ? '' : 'w-[280px] h-[160px] md:w-[450px] md:h-[260px] rounded-[80px] md:rounded-[130px]'}
                      border-4 md:border-[6px] border-white/10 bg-green-800/50 backdrop-blur-sm flex flex-col items-center justify-center shadow-inner z-10 transition-all duration-300`}
                                style={potStyle}
                            >
                                <div className="text-white/30 font-bold text-xs md:text-lg tracking-widest mb-1">{gameStatus.toUpperCase()}</div>
                                <div className="text-yellow-400 font-mono text-3xl md:text-5xl font-black mb-2 md:mb-6 tracking-tighter drop-shadow-md">${pot}</div>
                                {/* Pot Chips (Placeholder visual using simplified stack) */}
                                {pot > 0 && <ChipStack amount={pot} />}
                            </div>

                            {/* Flying Chips Animation Layer - Centered relative to table */}
                            <div className="absolute top-1/2 left-1/2 w-0 h-0 pointer-events-none z-50">
                                <AnimatePresence>
                                    {flyingChips.map((chip) => (
                                        <motion.div
                                            key={chip.id}
                                            initial={{
                                                opacity: 0,
                                                x: chip.startX,
                                                y: chip.startY,
                                                scale: 0.8, // Start slightly smaller but no rotation
                                            }}
                                            animate={{
                                                opacity: 1,
                                                x: chip.endX,
                                                y: chip.endY,
                                                scale: 1, // Smooth scale up
                                                transition: { ease: "easeInOut", duration: chip.duration || 0.6 } // Smooth curve, no spring
                                            }}
                                            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                                            style={{ position: 'absolute' }}
                                        >
                                            <Chip value={chip.amount} />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            {/* Seats & Players */}
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((seatIndex) => {
                                const player = players.find(p => p.seatIndex === seatIndex);
                                const isDealer = dealerIndex === seatIndex;
                                return (
                                    <div
                                        key={seatIndex}
                                        className="absolute top-1/2 left-1/2 w-20 h-20 md:w-32 md:h-32 flex flex-col items-center justify-center transition-all duration-500 z-20"
                                        style={getSeatStyle(seatIndex)}
                                        onClick={() => {
                                            if (isHost) {
                                                if (gameStatus === 'showdown' && player) {
                                                    distributePot(player.id);
                                                } else {
                                                    setDealerSeat(seatIndex);
                                                }
                                            }
                                        }}
                                    >
                                        {/* Seat Visual (Empty) */}
                                        <div className={`w-14 h-14 md:w-24 md:h-24 rounded-full border-2 md:border-4 flex items-center justify-center text-xl md:text-4xl relative shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-all cursor-pointer group
                             ${player ? 'border-yellow-500 text-white scale-110' : 'bg-white/5 border-white/10 text-white/10 border-dashed hover:bg-white/10'}
                          `}
                                            style={player ? { backgroundColor: player.color || 'rgba(0,0,0,0.8)' } : {}}
                                        >
                                            {player ? player.avatar : <span className="font-black text-xl md:text-3xl opacity-50">{seatIndex}</span>}

                                            {/* Dealer Button (D) */}
                                            {isDealer && (
                                                <div className="absolute -top-2 -right-2 w-6 h-6 md:w-8 md:h-8 bg-white text-black rounded-full flex items-center justify-center font-bold text-[10px] md:text-sm border-2 border-black shadow-lg animate-bounce">
                                                    D
                                                </div>
                                            )}

                                            {/* Balance Badge */}
                                            {player && (
                                                <div className="absolute -bottom-3 md:-bottom-5 bg-yellow-500 text-black text-[10px] md:text-sm font-bold px-2 md:px-3 py-0.5 rounded-full shadow-lg border md:border-2 border-white/20 min-w-[40px] md:min-w-[60px] text-center">
                                                    ${player.balance}
                                                </div>
                                            )}
                                        </div>

                                        {/* Player Name */}
                                        {player && (
                                            <div className="mt-4 md:mt-6 text-white font-bold text-xs md:text-xl text-shadow-md whitespace-nowrap bg-black/40 px-2 md:px-3 py-0.5 rounded backdrop-blur-sm">
                                                {player.name}
                                            </div>
                                        )}

                                        {/* Current Bet Amount (Text Indicator instead of Chips) */}
                                        {player && player.currentBet > 0 && (
                                            <div className="absolute -top-8 md:-top-12 z-30">
                                                <div className="bg-black/60 text-yellow-400 font-mono font-bold text-xs md:text-lg px-3 py-1 rounded-full border border-yellow-500/30 shadow-lg backdrop-blur-md flex items-center gap-1">
                                                    <span className="text-yellow-600 text-[10px] md:text-sm">$</span>
                                                    {player.currentBet}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Staged Bets (Middle Ring) */}
                            {players.map((p) => {
                                const incoming = incomingBets[p.id] || 0;
                                // Use local sum which handles latency, or fallback to DB if local is missing
                                const baseAmount = stagedBetSums[p.id] || p.stagedBet || 0;
                                const displayAmount = Math.max(0, baseAmount - incoming);

                                return displayAmount > 0 && (
                                    <div
                                        key={`staged-${p.id}`}
                                        className="absolute top-1/2 left-1/2 z-40 transition-all duration-300 drop-shadow-xl pointer-events-none"
                                        style={{
                                            transform: `translate(${getStagedCoordinates(p.seatIndex).x}px, ${getStagedCoordinates(p.seatIndex).y}px) translate(-50%, -50%)`
                                        }}
                                    >
                                        <ChipStack amount={displayAmount} />
                                    </div>
                                );
                            })}

                            {/* Dealer Controls Footer */}
                            {isHost && (
                                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/80 p-2 rounded-full border border-white/10 backdrop-blur-xl shadow-2xl scale-90 md:scale-100">
                                    <div className="px-4 py-1 border-r border-white/10">
                                        <span className="text-[10px] text-white/30 uppercase tracking-widest block leading-none mb-1">Status</span>
                                        <span className="text-yellow-400 font-bold text-xs uppercase">{gameStatus}</span>
                                    </div>

                                    <button
                                        onClick={() => {
                                            const stages: any[] = ['waiting', 'pre-flop', 'flop', 'turn', 'river', 'showdown'];
                                            const idx = stages.indexOf(gameStatus);
                                            const next = stages[(idx + 1) % stages.length];
                                            updateGameStatus(next);
                                        }}
                                        className="px-4 py-2 rounded-full text-[10px] font-bold bg-white/10 text-white hover:bg-white/20 transition-all flex items-center gap-2 group"
                                    >
                                        NEXT STAGE
                                        <span className="opacity-50 group-hover:translate-x-1 transition-transform">→</span>
                                    </button>

                                    <button
                                        onClick={collectBets}
                                        disabled={pot > 0 && players.every(p => p.currentBet === 0)}
                                        className="px-6 py-2 rounded-full text-[10px] font-bold bg-yellow-500 text-black hover:bg-yellow-400 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                    >
                                        COLLECT BETS
                                    </button>

                                    {gameStatus === 'showdown' && (
                                        <div className="px-4 py-2 rounded-full text-[10px] font-bold bg-green-500 text-white animate-pulse">
                                            SELECT WINNER ↓
                                        </div>
                                    )}

                                    <button
                                        onClick={() => updateGameStatus('waiting')}
                                        className="px-4 py-2 rounded-full text-[10px] font-bold bg-red-900/40 text-red-200 hover:bg-red-900/60 border border-red-500/20 transition-all"
                                    >
                                        RESET
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                // Player View
                <div className="z-10 w-full max-w-5xl flex flex-col items-center h-full justify-center">
                    {!roomId || status !== 'connected' ? (
                        <JoinRoom
                            onJoin={(id, name, seat, avatar, buyIn, color) => {
                                joinRoom(id, name, seat, avatar, buyIn, color);
                                window.history.pushState({ room: id }, '');
                            }}
                            onStepChange={setSetupStep}
                            checkRoom={checkRoom}
                            onResume={async (id) => {
                                // Reuse logic: JoinRoom calls this if checkRoom says we are a member
                                const success = await resumeHost(id); // resumeHost now should handle regular players too if we update it or use joinRoom
                                if (success) {
                                    window.history.pushState({ room: id }, '');
                                }
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center w-full h-full pt-16 pb-6 px-4 relative">
                            {/* UPPER SECTION (50%) - Info & Decisions */}
                            <div className="flex-1 w-full flex flex-col min-h-0 relative pb-2 border-b border-white/5">
                                {/* Header Info */}
                                <div className="w-full flex-none flex justify-between items-center px-4 bg-black/20 py-2 rounded-xl backdrop-blur-sm border border-white/5 relative z-10 mt-2">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 border-yellow-500 shadow-lg"
                                            style={{ backgroundColor: myPlayer?.color || 'rgba(0,0,0,0.6)' }}
                                        >
                                            {myPlayer?.avatar ?? '👤'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-lg leading-tight">{myPlayer?.name ?? 'Player'}</span>
                                            <span className="text-yellow-400 font-mono text-xs font-bold tracking-wider">SEAT {myPlayer?.seatIndex ?? '?'}</span>
                                        </div>
                                    </div>

                                    {/* All In Button moved to Header for quick access but safety */}
                                    <button
                                        onClick={handleAllIn}
                                        className="bg-red-900/40 hover:bg-red-600 text-red-200 hover:text-white px-3 py-1 rounded border border-red-500/30 text-xs font-bold uppercase tracking-widest transition-all"
                                    >
                                        All In
                                    </button>
                                </div>

                                {/* Stats - Flexible Middle Area - Distributed Evenly */}
                                <div className="flex-1 flex flex-col items-center justify-evenly w-full min-h-0 py-2">
                                    <div className="flex flex-col items-center">
                                        <div className="text-white/40 text-[10px] uppercase tracking-[0.2em] mb-1">Your Balance</div>
                                        <div className="text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-2xl tabular-nums">
                                            ${(myPlayer?.balance ?? 0) - stagedAmount}
                                        </div>
                                    </div>

                                    {/* Staged Amount Indicator - Reserved Space */}
                                    <div className={`flex flex-col items-center transition-all duration-300 min-h-[60px] justify-center ${stagedAmount > 0 ? 'opacity-100 transform-none' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                        <span className="text-yellow-400 font-bold text-xs tracking-widest mb-1">READY TO BET</span>
                                        <div className="text-3xl font-black text-yellow-300 drop-shadow-lg glow-text">
                                            +${stagedAmount}
                                        </div>
                                    </div>

                                    {/* Action Buttons - Moved Here */}
                                    <div className={`w-full px-6 flex gap-3 transition-all duration-300 h-[50px] items-end ${stagedAmount > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                                        <button
                                            onClick={handleClearBet}
                                            disabled={stagedAmount === 0}
                                            className="flex-1 bg-gray-700/80 hover:bg-gray-600 text-white/80 font-bold py-3 rounded-2xl border border-white/10 active:scale-95 transition-all uppercase tracking-widest text-xs h-full"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            onClick={handleConfirmBet}
                                            disabled={stagedAmount === 0}
                                            className="flex-[2.5] bg-gradient-to-br from-yellow-400 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black font-black py-3 rounded-2xl border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest text-sm h-full"
                                        >
                                            CONFIRM BET
                                        </button>
                                    </div>


                                </div>
                            </div>

                            {/* LOWER SECTION (50%) - Chips Only */}
                            <div className="flex-1 w-full flex flex-col min-h-0 relative justify-center">
                                {/* Swipe Hint */}
                                <div className="absolute top-2 left-0 w-full flex items-center justify-center opacity-50 z-10 pointer-events-none">
                                    <p className="text-white/30 text-[10px] text-center animate-pulse tracking-[0.3em] uppercase flex flex-col items-center gap-1">
                                        <span className="text-lg">↑</span>
                                        Swipe UP
                                    </p>
                                </div>


                                {/* Betting Controls */}
                                <div className="w-full">
                                    <div className="flex flex-wrap gap-4 items-center justify-center px-4">
                                        {CHIP_VALUES.slice().reverse().map((val) => (
                                            <div key={val} className="shrink-0 transition-transform active:scale-95">
                                                <DraggableChip value={val} onBet={(amount, velocity) => handleStageBet(amount, velocity)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}