import React from 'react';
import { getChipStack } from '@/utils/chipUtils';
import { CHIP_TEXT_COLORS } from '@/constants/chips';

interface ChipStackProps {
    amount: number;
}

const ChipStack: React.FC<ChipStackProps> = ({ amount }) => {
    const stacks = getChipStack(amount);

    return (
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 isolate justify-items-center items-end">
            {stacks.map((stack, stackIndex) => (
                <div key={stackIndex} className="relative w-8 h-8 md:w-10 md:h-10">
                    {Array.from({ length: stack.count }).map((_, i) => (
                        <div
                            key={i}
                            className={`
                absolute left-0 w-full h-full rounded-full border-2 border-dashed border-white/40
                shadow-[0_2px_3px_rgba(0,0,0,0.5)]
                ${stack.color}
                ring-1 ring-black/20 ring-inset
                flex items-center justify-center text-[8px] md:text-[10px] ${CHIP_TEXT_COLORS[stack.value] || 'text-white'} font-bold
              `}
                            style={{
                                bottom: `${i * 5}px`, // Increased offset for thickness
                                zIndex: i,
                            }}
                        >
                            {/* Side thickness effect */}
                            <div className="absolute inset-0 rounded-full border-b-[3px] border-black/30 pointer-events-none"></div>

                            {/* Top rim highlight */}
                            <div className="absolute inset-0 rounded-full border-t border-white/20 pointer-events-none"></div>

                            {/* Only show value on top chip */}
                            {i === stack.count - 1 && <span className="relative z-10 drop-shadow-md">{stack.value}</span>}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default ChipStack;
