import React, { useState } from 'react';

interface HostJoinProps {
    onResume: (roomId: string) => void;
    onBack: () => void;
}

const HostJoin: React.FC<HostJoinProps> = ({ onResume, onBack }) => {
    const [roomId, setRoomId] = useState('');

    const handleResume = () => {
        if (roomId.trim()) {
            onResume(roomId.toUpperCase());
        }
    };

    return (
        <div className="flex flex-col items-center gap-6 p-8 bg-black/80 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-white tracking-widest uppercase text-shadow-lg mb-4 text-center">
                Resume Table
            </h2>

            <div className="w-full flex flex-col gap-4">
                <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleResume()}
                    placeholder="ENTER ROOM ID"
                    className="w-full px-6 py-4 bg-white/10 border-2 border-white/20 rounded-lg text-center text-xl font-mono text-white tracking-widest focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/50 transition-all placeholder-white/30"
                    maxLength={6}
                    autoFocus
                />

                <div className="flex gap-4 mt-4">
                    <button
                        onClick={onBack}
                        className="flex-1 py-3 bg-white/10 text-white font-bold rounded-full text-lg hover:bg-white/20 transition-all shadow-lg"
                    >
                        BACK
                    </button>
                    <button
                        onClick={handleResume}
                        disabled={!roomId.trim()}
                        className={`flex-[2] py-3 font-bold rounded-full text-lg shadow-lg transition-all 
                            ${roomId.trim()
                                ? 'bg-yellow-500 text-black hover:bg-yellow-400 active:scale-95'
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                        RESUME
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HostJoin;
