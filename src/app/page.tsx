// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Chip from '@/components/Chip';
import DraggableChip from '@/components/DraggableChip';
import ChipStack from '@/components/ChipStack';
import JoinRoom from '@/components/JoinRoom';
import HostJoin from '@/components/HostJoin';
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
    const [hostMode, setHostMode] = useState<'menu' | 'join'>('menu');
    const [setupStep, setSetupStep] = useState(1);
    const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([]);
    const [incomingBets, setIncomingBets] = useState<Record<string, number>>({});
    const [stagedBetSums, setStagedBetSums] = useState<Record<string, number>>({});
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [localBalance, setLocalBalance] = useState(0);

    // Staged Betting State
    const [stagedAmount, setStagedAmount] = useState(0);
    const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

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
        currentTurnSeatIndex,
        currentHighestBet,
        bettingRoundComplete,
        collectBets,
        distributePot,
        updateGameStatus,
        setDealerSeat,
        moveButtonToNext,
        startBettingRound,
        playerFold,
        playerCheck,
        playerCall,
        playerBetRaise,
    } = usePokerRoom();

    // Handle Browser Back Button
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            leaveRoom();
            setView('dealer'); // Return to host view on back
            setSetupStep(1);   // Reset setup step
            setHostMode('menu'); // Reset host mode
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
            setHostMode('menu'); // Reset host mode
        }
    };

    // Find myself
    const myPlayer = players.find(p => p.id === myPlayerId);

    // Turn-based betting logic
    const isMyTurn = myPlayer && myPlayer.seatIndex === currentTurnSeatIndex;
    const canCheck = currentHighestBet === 0 || (myPlayer && myPlayer.currentBet === currentHighestBet);
    const needToCall = currentHighestBet > 0 && myPlayer && myPlayer.currentBet < currentHighestBet;
    const amountToCall = needToCall ? currentHighestBet - (myPlayer?.currentBet || 0) : 0;

    // Reset stagedAmount when room or player changes
    useEffect(() => {
        setStagedAmount(0);
    }, [roomId, myPlayerId]);

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
            {status !== 'connected' && hostMode !== 'join' && setupStep === 1 && (
                <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50 flex gap-2 bg-black/40 p-1 rounded-full backdrop-blur-sm border border-white/10">
                    <button
                        onClick={() => setView('dealer')}
                        className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${view === 'dealer' ? 'bg-white text-green-950 shadow-lg' : 'text-white/70 hover:text-white'}`}
                    >
                        HOST
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
                        hostMode === 'join' ? (
                            <HostJoin
                                onResume={async (id) => {
                                    const success = await resumeHost(id);
                                    if (success) {
                                        window.history.pushState({ room: 'host' }, '');
                                        setHostMode('menu');
                                    }
                                }}
                                onBack={() => setHostMode('menu')}
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
                                        onClick={() => setHostMode('join')}
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
                                            if (!isHost) return;

                                            if (gameStatus === 'showdown' && player) {
                                                // Showdown: 只有未棄牌的玩家才能獲得獎金
                                                if (player.isFolded) {
                                                    alert('此玩家已棄牌，無法獲得獎金');
                                                    return;
                                                }
                                                distributePot(player.id);
                                            } else if (gameStatus !== 'showdown') {
                                                // 非 Showdown: 設定 Dealer Button
                                                setDealerSeat(seatIndex);
                                            }
                                        }}
                                    >
                                        {/* Seat Visual (Empty) */}
                                        <div className={`w-14 h-14 md:w-24 md:h-24 rounded-full border-2 md:border-4 flex items-center justify-center text-xl md:text-4xl relative shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-all cursor-pointer group
                             ${player ? 'border-yellow-500 text-white scale-110' : 'bg-white/5 border-white/10 text-white/10 border-dashed hover:bg-white/10'}
                             ${seatIndex === currentTurnSeatIndex ? 'ring-4 ring-yellow-400 animate-pulse' : ''}
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

                            {/* Staged Bets (Middle Ring) - Now also shows currentBet chips */}
                            {players.map((p) => {
                                const incoming = incomingBets[p.id] || 0;
                                const stagedAmount = stagedBetSums[p.id] || p.stagedBet || 0;

                                // Priority: show currentBet chips if confirmed, otherwise show stagedBet chips
                                const displayAmount = p.currentBet > 0
                                    ? p.currentBet
                                    : Math.max(0, stagedAmount - incoming);

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

                            {/* Host Controls - Right Top Corner */}
                            {isHost && (
                                <div className={`fixed top-20 right-4 md:top-24 md:right-6 z-40 transition-all duration-300 ${isControlsCollapsed ? 'w-10' : 'w-[200px] md:w-[220px]'}`}>
                                    <div className={`bg-green-800/80 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl flex flex-col items-center overflow-hidden transition-all duration-300 ${isControlsCollapsed ? 'p-1' : 'p-4 gap-2.5'}`}>
                                        {/* Toggle Button */}
                                        <button
                                            onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
                                            className={`flex items-center justify-center transition-all ${isControlsCollapsed ? 'w-8 h-8 hover:bg-white/10 rounded-full' : 'absolute top-2 right-2 w-6 h-6 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-full z-10'}`}
                                            title={isControlsCollapsed ? "展開控制面板" : "收起控制面板"}
                                        >
                                            {isControlsCollapsed ? '⚙️' : '✕'}
                                        </button>

                                        {!isControlsCollapsed && (
                                            <>
                                                {/* Current Status */}
                                                <div className="text-white/40 font-bold text-[9px] tracking-[0.2em] uppercase text-center w-full px-2 border-b border-white/5 pb-2 mb-1">
                                                    Host Dashboard: <span className="text-emerald-400">{gameStatus}</span>
                                                </div>

                                                {/* Control Buttons - Vertical Stack */}
                                                <div className="flex flex-col gap-2 w-full">
                                                    {/* Next Stage */}
                                                    <button
                                                        onClick={() => {
                                                            const stages: ('waiting' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown')[] = ['waiting', 'pre-flop', 'flop', 'turn', 'river', 'showdown'];
                                                            const idx = stages.indexOf(gameStatus);
                                                            const next = stages[(idx + 1) % stages.length];
                                                            updateGameStatus(next);
                                                            // Start betting round when entering pre-flop/flop/turn/river
                                                            if (next !== 'waiting' && next !== 'showdown') {
                                                                startBettingRound();
                                                            }
                                                        }}
                                                        disabled={!bettingRoundComplete && gameStatus !== 'waiting' && gameStatus !== 'showdown'}
                                                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/5 transition-all active:scale-95 w-full disabled:opacity-20 disabled:cursor-not-allowed group"
                                                        title="Next Stage"
                                                    >
                                                        <span className="text-lg group-hover:translate-x-0.5 transition-transform">→</span>
                                                        <span className="text-[10px] text-white/90 uppercase tracking-wide font-bold">Next Stage</span>
                                                    </button>

                                                    {/* Collect Bets */}
                                                    <button
                                                        onClick={collectBets}
                                                        disabled={pot > 0 && players.every(p => p.currentBet === 0)}
                                                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/60 hover:bg-amber-500/70 border border-white/10 transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed w-full"
                                                        title="Collect Bets"
                                                    >
                                                        <span className="text-lg">💰</span>
                                                        <span className="text-[10px] text-white uppercase tracking-wide font-bold">Collect Bets</span>
                                                    </button>

                                                    {/* New Round */}
                                                    <button
                                                        onClick={() => {
                                                            updateGameStatus('waiting');
                                                            moveButtonToNext();
                                                        }}
                                                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/60 hover:bg-emerald-500/70 border border-white/10 transition-all active:scale-95 w-full"
                                                        title="New Round"
                                                    >
                                                        <span className="text-lg">🔄</span>
                                                        <span className="text-[10px] text-white uppercase tracking-wide font-bold">New Round</span>
                                                    </button>
                                                </div>

                                                {/* Hint Text */}
                                                <div className="text-white/40 text-[9px] text-center leading-relaxed border-t border-white/5 pt-2 w-full mt-1">
                                                    {gameStatus === 'waiting' && '點擊 → 開始遊戲'}
                                                    {gameStatus === 'pre-flop' && '下注後，點擊 💰'}
                                                    {gameStatus === 'flop' && '下注後，點擊 💰'}
                                                    {gameStatus === 'turn' && '下注後，點擊 💰'}
                                                    {gameStatus === 'river' && '下注後，點擊 💰'}
                                                    {gameStatus === 'showdown' && '選擇贏家以分配獎池'}
                                                </div>
                                            </>
                                        )}
                                    </div>
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
                            onJoin={async (id, name, seat, avatar, buyIn, color) => {
                                const success = await joinRoom(id, name, seat, avatar, buyIn, color);
                                if (success) {
                                    window.history.pushState({ room: id }, '');
                                }
                                return success;
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


                                </div>
                            </div>

                            {/* LOWER SECTION (50%) - Chips and Action Buttons */}
                            <div className="flex-1 w-full flex flex-col min-h-0 relative justify-center">
                                {/* Turn-based Action Buttons */}
                                {view === 'player' && gameStatus !== 'waiting' && (
                                    <div className="absolute top-4 left-0 w-full px-4 z-20">
                                        {myPlayer?.isFolded ? (
                                            <div className="text-center py-2">
                                                <div className="inline-block bg-red-900/60 px-6 py-2 rounded-full backdrop-blur-sm border border-red-500/30">
                                                    <span className="text-red-300 text-xs uppercase tracking-widest">
                                                        已棄牌 (Folded)
                                                    </span>
                                                </div>
                                            </div>
                                        ) : isMyTurn ? (
                                            <div className="flex gap-2 justify-center animate-fade-in">
                                                {/* Fold Button */}
                                                <button
                                                    onClick={() => {
                                                        playerFold(myPlayerId);
                                                        setStagedAmount(0);  // Clear staged amount
                                                    }}
                                                    className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wide transition-all active:scale-95 border border-white/20 flex flex-col items-center leading-tight"
                                                >
                                                    <span>Fold</span>
                                                    <span className="text-[8px] opacity-80">棄牌</span>
                                                </button>

                                                {/* Check Button - only if no bet or already matched */}
                                                {canCheck && (
                                                    <button
                                                        onClick={() => {
                                                            playerCheck(myPlayerId);
                                                            setStagedAmount(0);  // Clear staged amount
                                                        }}
                                                        className="px-3 py-2 bg-blue-600/80 hover:bg-blue-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wide transition-all active:scale-95 border border-white/20 flex flex-col items-center leading-tight"
                                                    >
                                                        <span>Check</span>
                                                        <span className="text-[8px] opacity-80">過牌</span>
                                                    </button>
                                                )}

                                                {/* Call Button - only if need to match bet */}
                                                {needToCall && (
                                                    <button
                                                        onClick={() => {
                                                            playerCall(myPlayerId);
                                                            setStagedAmount(0);  // Clear staged amount
                                                        }}
                                                        className="px-3 py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wide transition-all active:scale-95 border border-white/20 flex flex-col items-center leading-tight"
                                                    >
                                                        <span>Call ${amountToCall}</span>
                                                        <span className="text-[8px] opacity-80">跟注</span>
                                                    </button>
                                                )}

                                                {/* Bet/Raise Button - use staged chips */}
                                                <button
                                                    onClick={() => {
                                                        if (stagedAmount > currentHighestBet) {
                                                            playerBetRaise(myPlayerId, stagedAmount);
                                                            setStagedAmount(0);
                                                        }
                                                    }}
                                                    disabled={stagedAmount === 0 || stagedAmount <= currentHighestBet}
                                                    className="px-3 py-2 bg-yellow-600/80 hover:bg-yellow-500 text-white font-bold rounded-xl text-[10px] uppercase tracking-wide transition-all active:scale-95 border border-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center leading-tight"
                                                >
                                                    <span>{currentHighestBet > 0 ? 'Raise' : 'Bet'}</span>
                                                    <span className="text-[8px] opacity-80">{currentHighestBet > 0 ? '加注' : '下注'}</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center py-2">
                                                <div className="inline-block bg-black/60 px-6 py-2 rounded-full backdrop-blur-sm border border-white/10">
                                                    <span className="text-white/50 text-xs uppercase tracking-widest">
                                                        等待其他玩家行動...
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Swipe Hint - Context-aware */}
                                <div className="absolute top-2 left-0 w-full flex items-center justify-center opacity-50 z-10 pointer-events-none">
                                    {gameStatus !== 'waiting' && isMyTurn && stagedAmount === 0 ? (
                                        <p className="text-yellow-400/50 text-[10px] text-center animate-pulse tracking-[0.2em] uppercase flex flex-col items-center gap-1">
                                            <span className="text-lg">👆</span>
                                            Your Turn - Choose Action
                                        </p>
                                    ) : gameStatus !== 'waiting' && isMyTurn && stagedAmount > 0 ? (
                                        <p className="text-yellow-400/50 text-[10px] text-center animate-pulse tracking-[0.2em] uppercase flex flex-col items-center gap-1">
                                            <span className="text-lg">✓</span>
                                            Click Bet/Raise Below
                                        </p>
                                    ) : null}
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
            )
            }
        </main >
    );
}