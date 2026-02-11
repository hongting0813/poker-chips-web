// src/components/JoinRoom.tsx
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

const AVATARS = ['👨🏻', '👩🏻', '👴🏻', '👵🏻', '🧑🏻', '👧🏻', '👱🏻', '👱🏻‍♀️', '🐶', '🐱', '🐣', '🐰', '🐭', '🐠', '🤖', '👽', '🤡', '👻', '😈', '💩'];
const COLORS = ['#000000', '#2f4a4a', '#4a0404', '#042f4a', '#044a04', '#4a044a', '#4a2f04', '#F1F3F5', '#FFC9C9', '#A5D8FF', '#B2F2BB', '#D0BFFF'];

interface JoinRoomProps {
    onJoin: (roomId: string, name: string, seatIndex: number, avatar: string, buyIn: number, color: string) => void;
    onStepChange?: (step: number) => void;
}

const JoinRoom: React.FC<JoinRoomProps> = ({ onJoin, onStepChange }) => {
    const [step, setStep] = useState(1);

    // Notify parent of step change
    React.useEffect(() => {
        onStepChange?.(step);
    }, [step, onStepChange]);

    const [roomId, setRoomId] = useState('');
    const [name, setName] = useState('');
    const [seatIndex, setSeatIndex] = useState<number | null>(null);
    const [avatar, setAvatar] = useState(AVATARS[0]);
    const [color, setColor] = useState(COLORS[0]);
    const [buyIn, setBuyIn] = useState(1000);

    const handleJoin = () => {
        if (roomId.trim() && name.trim() && seatIndex !== null) {
            onJoin(roomId, name, seatIndex, avatar, buyIn, color);
        }
    };

    const handleKeyDownStep1 = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && roomId.trim() && name.trim()) {
            setStep(2);
        }
    };

    return (
        <div className="flex flex-col items-center gap-3 md:gap-4 p-4 md:p-8 bg-black/80 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl w-full max-w-[95%] md:max-w-2xl mx-auto max-h-[95vh] overflow-y-auto landscape:max-w-5xl landscape:flex-row landscape:items-start">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-widest uppercase text-shadow-lg mb-1 md:mb-2 landscape:hidden">
                {step === 1 ? 'Enter Room' : 'Player Setup'}
            </h2>

            {step === 1 ? (
                // Step 1: Room ID & Name (Unchanged)
                <div className="w-full flex flex-col gap-3 md:gap-4 my-auto">
                    <h2 className="hidden landscape:block text-xl md:text-2xl font-bold text-white tracking-widest uppercase text-shadow-lg mb-2 md:mb-4 text-center">
                        Enter Room
                    </h2>
                    <input
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                        onKeyDown={handleKeyDownStep1}
                        placeholder="ROOM ID"
                        className="w-full px-4 py-3 md:px-6 md:py-4 bg-white/10 border-2 border-white/20 rounded-lg text-center text-lg md:text-xl font-mono text-white tracking-widest focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50 transition-all placeholder-white/30"
                        maxLength={6}
                    />
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDownStep1}
                        placeholder="YOUR NAME"
                        className="w-full px-4 py-3 md:px-6 md:py-4 bg-white/10 border-2 border-white/20 rounded-lg text-center text-lg md:text-xl font-bold text-white tracking-widest focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50 transition-all placeholder-white/30"
                        maxLength={12}
                    />
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { if (roomId && name) setStep(2); }}
                        className="mt-2 md:mt-4 w-full py-2 md:py-3 bg-yellow-500 text-black font-bold rounded-full text-base md:text-lg shadow-lg"
                    >
                        NEXT
                    </motion.button>
                </div>
            ) : (
                // Step 2: Avatar, Color, Seat, Buy-in
                <div className="w-full grid grid-cols-1 landscape:grid-cols-2 gap-4">
                    <h2 className="hidden landscape:block col-span-2 text-xl md:text-2xl font-bold text-white tracking-widest uppercase text-shadow-lg mb-2 text-center">
                        Player Setup
                    </h2>

                    {/* Left Column: Visuals (Avatar + Color) */}
                    <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                        {/* Avatar Grid */}
                        <div className="flex flex-col gap-1 md:gap-2">
                            <label className="text-white/50 text-[10px] md:text-xs uppercase tracking-widest">Choose Avatar</label>
                            <div className="grid grid-cols-5 gap-1 md:gap-2 h-32 overflow-y-auto p-1 bg-black/20 rounded-lg custom-scrollbar">
                                {AVATARS.map((a) => (
                                    <button
                                        key={a}
                                        onClick={() => setAvatar(a)}
                                        className={`text-xl md:text-2xl p-1 rounded hover:bg-white/10 transition-colors ${avatar === a ? 'bg-white/20 ring-2 ring-yellow-400' : ''}`}
                                    >
                                        {a}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Color Picker */}
                        <div className="flex flex-col gap-1 md:gap-2">
                            <label className="text-white/50 text-[10px] md:text-xs uppercase tracking-widest">Avatar Background: {color}</label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-8 h-8 rounded-full border-2 transition-all shadow-md ${color === c ? 'border-white scale-110 ring-2 ring-yellow-400' : 'border-white/20 hover:scale-105'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex items-center justify-center py-2">
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 border-yellow-500 shadow-xl"
                                style={{ backgroundColor: color }}
                            >
                                {avatar}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Game Info */}
                    <div className="flex flex-col gap-4 justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                        {/* Seat Selection */}
                        <div>
                            <label className="text-white/50 text-[10px] md:text-xs uppercase tracking-widest mb-1 md:mb-2 block">Choose Seat (0-8)</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setSeatIndex(s)}
                                        className={`py-2 rounded border text-xs font-mono transition-all ${seatIndex === s ? 'bg-green-500 text-white border-green-400 scale-105 shadow-lg' : 'bg-black/40 text-white/40 border-white/10 hover:bg-white/10'}`}
                                    >
                                        Seat {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Buy-in */}
                        <div>
                            <label className="text-white/50 text-[10px] md:text-xs uppercase tracking-widest mb-1 block">Buy-in Amount</label>
                            <input
                                type="number"
                                value={buyIn}
                                onChange={(e) => setBuyIn(Number(e.target.value))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && seatIndex !== null) handleJoin();
                                }}
                                className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded text-center text-white font-mono text-lg"
                            />
                        </div>

                        <div className="flex gap-4 mt-auto">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-3 bg-white/10 text-white font-bold rounded-full text-sm hover:bg-white/20 transition-all"
                            >
                                BACK
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleJoin}
                                className={`flex-1 py-3 font-bold rounded-full text-lg shadow-lg ${seatIndex !== null ? 'bg-green-500 text-white hover:bg-green-400' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                disabled={seatIndex === null}
                            >
                                JOIN TABLE
                            </motion.button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoinRoom;
