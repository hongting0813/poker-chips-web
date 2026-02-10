import React from 'react';
import { getChipStack } from '@/utils/chipUtils';
import { CHIP_TEXT_COLORS } from '@/constants/chips';

interface ChipStackProps {
    amount: number;
}

const ChipStack: React.FC<ChipStackProps> = ({ amount }) => {
    const stacks = getChipStack(amount);

    return (
        <div className="flex items-end gap-2 isolate">
            {stacks.map((stack, stackIndex) => (
                <div key={stackIndex} className="relative w-8 h-8 md:w-10 md:h-10">
                    {Array.from({ length: stack.count }).map((_, i) => (
                        <div
                            key={i}
                            className={`
                absolute left-0 w-full h-full rounded-full border-2 border-dashed border-white/40
                shadow-[0_2px_4px_rgba(0,0,0,0.4)]
                ${stack.color}
                ring-1 ring-black/20 ring-inset
                flex items-center justify-center text-[8px] md:text-[10px] ${CHIP_TEXT_COLORS[stack.value] || 'text-white'} font-bold
              `}
                            style={{
                                bottom: `${i * 4}px`,
                                zIndex: i,
                            }}
                        >
                            {/* Top rim highlight */}
                            <div className="absolute inset-0 rounded-full border-t border-white/20"></div>
                            {/* Only show value on top chip */}
                            {i === stack.count - 1 && stack.value}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default ChipStack;
