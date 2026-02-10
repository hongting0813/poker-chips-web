'use client';

import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import Chip from './Chip';

interface DraggableChipProps {
    value: number;
    color?: string;
    onBet: (amount: number, velocity?: number) => void;
}

const DraggableChip: React.FC<DraggableChipProps> = ({ value, color, onBet }) => {
    const controls = useAnimation();
    const [isDragging, setIsDragging] = useState(false);

    const bind = useDrag(({ down, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy] }) => {
        setIsDragging(down);

        if (down) {
            // Follow cursor
            controls.start({ x: mx, y: my, scale: 1.1, rotateX: my / 4 });
        } else {
            // Released
            const isSwipeUp = my < -100;
            const isFastEnough = vy > 0.5;

            // Note: use-gesture velocity is usually positive magnitude. 
            // We verify direction using 'my' (negative for up) or 'dy' (negative for up).

            if (isSwipeUp && isFastEnough) {
                // Trigger Bet
                // Pass velocity (Y axis speed). 'vy' is pixels/ms or similar? 
                // use-gesture returns px/ms. Let's scale it up for the "eruptive" feel.
                onBet(value, vy * 5); // Scale up for effect

                // Animate flying away (upwards)
                controls.start({
                    y: -1000,
                    opacity: 0,
                    transition: { duration: 0.4, ease: "easeIn" }
                }).then(() => {
                    // Reset position instantly after animation
                    controls.set({ x: 0, y: 0, opacity: 0, scale: 0.5, rotateX: 0 });

                    // Animate appearing back
                    controls.start({
                        opacity: 1,
                        scale: 1,
                        transition: { type: "spring", stiffness: 300, damping: 20 }
                    });
                });
            } else {
                // Rebound to original position
                controls.start({ x: 0, y: 0, scale: 1, rotateX: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
            }
        }
    });

    return (
        <motion.div
            animate={controls}
            className="relative z-50"
        >
            <div
                {...bind()}
                className="touch-none select-none cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
            >
                <Chip value={value} color={color} />
            </div>

            {/* Visual Guide when dragging */}
            {isDragging && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: -20 }}
                    exit={{ opacity: 0 }}
                    className="absolute -top-16 left-1/2 transform -translate-x-1/2 text-white/80 text-xs font-bold uppercase tracking-widest whitespace-nowrap pointer-events-none bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/10"
                >
                    Release to Bet
                </motion.div>
            )}
        </motion.div>
    );
};

export default DraggableChip;
