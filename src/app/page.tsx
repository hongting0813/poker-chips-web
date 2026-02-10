// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Chip from '@/components/Chip';
import DraggableChip from '@/components/DraggableChip';
import ChipStack from '@/components/ChipStack';
import JoinRoom from '@/components/JoinRoom';
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
    sendBet,
    stageBet,
    confirmBet,
    clearBet,
    setOnBet,
    pot,
    myPlayerId
  } = usePokerRoom();

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
    return { x: x * 0.75, y: y * 0.75 }; // 75% distance
  };

  // Setup dealer listener for bets
  useEffect(() => {
    if (view === 'dealer') {
      setOnBet((payload: BetPayload) => {
        const player = players.find(p => p.id === payload.playerId);
        let startX = 0, startY = 600, endX = 0, endY = 0;

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

            // For confirm bets, we don't use incomingBets because it goes to pot, 
            // and pot update isn't masked currently (and doesn't need to be as much)
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
    <main className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background Texture Effect */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 to-transparent opacity-30 mix-blend-overlay"></div>

      {/* Dev Mode View Toggle - Hidden when connected */}
      {status !== 'connected' && (
        <div className="absolute bottom-6 right-6 z-50 flex gap-2 bg-black/40 p-1 rounded-full backdrop-blur-sm border border-white/10">
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
      <div className={`absolute top-6 left-6 px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2 border ${status === 'connected' ? 'bg-green-500/20 border-green-500/50 text-green-200' :
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

      {/* Room ID - Responsive Positioning */}
      {roomId && (
        <div className="fixed top-4 right-4 md:top-6 md:left-1/2 md:-translate-x-1/2 md:right-auto 
                        px-4 py-1.5 md:px-6 md:py-2 
                        bg-black/40 backdrop-blur-md rounded-full border border-white/10 
                        flex items-center gap-3 md:gap-4 shadow-lg z-50 transition-all">
          <span className="text-white/40 text-[10px] md:text-xs font-mono uppercase tracking-widest">Room ID</span>
          <span className="text-xl md:text-2xl font-mono font-bold text-yellow-400 tracking-[0.2em]">{roomId}</span>
        </div>
      )}

      {view === 'dealer' ? (
        // Dealer View (Main Screen)
        <div className="flex flex-col items-center z-10 w-full max-w-7xl relative h-full justify-center origin-center transition-transform duration-300">

          {!roomId ? (
            <div className="flex flex-col items-center scale-75 md:scale-100">
              <h1 className="text-5xl font-black text-white/90 mb-8 tracking-[0.2em] drop-shadow-2xl border-b-4 border-white/20 pb-4">
                POKER TABLE
              </h1>
              <button
                onClick={() => createRoom()}
                className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-black text-xl rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95"
              >
                CREATE TABLE
              </button>
            </div>
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
                <div className="text-white/30 font-bold text-xs md:text-lg tracking-widest mb-1">POT</div>
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
                        scale: 0.5,
                        rotate: Math.random() * 360
                      }}
                      animate={{
                        opacity: 1,
                        x: chip.endX,
                        y: chip.endY,
                        scale: 1,
                        rotate: 0,
                        transition: { type: 'spring', damping: 20, stiffness: 100, duration: chip.duration || 0.6 }
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
                return (
                  <div
                    key={seatIndex}
                    className="absolute top-1/2 left-1/2 w-20 h-20 md:w-32 md:h-32 flex flex-col items-center justify-center transition-all duration-500 z-20"
                    style={getSeatStyle(seatIndex)}
                  >
                    {/* Seat Visual (Empty) */}
                    <div className={`w-14 h-14 md:w-24 md:h-24 rounded-full border-2 md:border-4 flex items-center justify-center text-xl md:text-4xl relative shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-all
                             ${player ? 'bg-black/80 border-yellow-500 text-white scale-110' : 'bg-white/5 border-white/10 text-white/10 border-dashed'}
                          `}>
                      {player ? player.avatar : <span className="font-black text-xl md:text-3xl opacity-50">{seatIndex}</span>}

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

                    {/* Current Bet Chips (In front of player) */}
                    {player && player.currentBet > 0 && (
                      <div className="absolute -top-12 md:-top-20 scale-75 md:scale-100 z-30 drop-shadow-xl">
                        <ChipStack amount={player.currentBet} />
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
            </div>
          )}
        </div>
      ) : (
        // Player View
        <div className="z-10 w-full max-w-md flex flex-col items-center h-full justify-center">
          {!roomId || status !== 'connected' ? (
            <JoinRoom onJoin={(id, name, seat, avatar, buyIn) => joinRoom(id, name, seat, avatar, buyIn)} />
          ) : (
            <div className="flex flex-col items-center w-full h-full justify-between py-6">
              {/* Header Info */}
              <div className="w-full flex justify-between items-center px-4 bg-black/20 py-2 rounded-xl backdrop-blur-sm border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-2xl border-2 border-yellow-500 shadow-lg">
                    {myPlayer?.avatar ?? '👤'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-lg leading-tight">{myPlayer?.name ?? 'Player'}</span>
                    <span className="text-yellow-400 font-mono text-xs font-bold tracking-wider">SEAT {myPlayer?.seatIndex ?? '?'}</span>
                  </div>
                </div>

                <div className="bg-white/10 rounded-lg px-3 py-1 border border-white/10 text-right">
                  <div className="text-white/40 text-[10px] uppercase tracking-widest">Room</div>
                  <div className="font-mono text-yellow-400 font-bold tracking-widest">{roomId}</div>
                </div>
              </div>

              {/* Stats */}
              <div className="text-center my-8 flex flex-col items-center justify-center flex-1">
                <div className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">Your Balance</div>
                <div className="text-7xl font-black text-white tracking-tighter drop-shadow-2xl tabular-nums">
                  ${(myPlayer?.balance ?? 0) - stagedAmount}
                </div>
                {/* Staged Amount Indicator */}
                {stagedAmount > 0 && (
                  <div className="mt-4 flex flex-col items-center animate-bounce">
                    <span className="text-yellow-400 font-bold text-sm tracking-widest">READY TO BET</span>
                    <div className="text-4xl font-black text-yellow-300 drop-shadow-lg glow-text">
                      +${stagedAmount}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full my-4 flex items-center justify-center">
                <p className="text-white/30 text-xs text-center max-w-[200px] animate-pulse">
                  Swipe chips UP to stage bet
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full px-8 flex justify-between gap-4 mb-4">
                <button
                  onClick={handleAllIn}
                  className="flex-1 bg-red-600/80 hover:bg-red-500 text-white font-black py-3 rounded-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest"
                >
                  All In
                </button>

                {stagedAmount > 0 && (
                  <>
                    <button
                      onClick={handleClearBet}
                      className="flex-1 bg-gray-600/80 hover:bg-gray-500 text-white font-bold py-3 rounded-xl border-b-4 border-gray-800 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleConfirmBet}
                      className="flex-[2] bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest shadow-lg shadow-yellow-500/20"
                    >
                      CONFIRM BET
                    </button>
                  </>
                )}
              </div>

              {/* Betting Controls */}
              <div className="w-full pb-8 perspective-[800px]">
                <div className="flex flex-wrap gap-4 items-center justify-center px-4 py-4">
                  {CHIP_VALUES.slice().reverse().map((val) => (
                    <div key={val} className="shrink-0 transition-transform active:scale-95">
                      <DraggableChip value={val} onBet={(amount, velocity) => handleStageBet(amount, velocity)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}