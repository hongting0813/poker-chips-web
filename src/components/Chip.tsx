import React from 'react';

import { CHIP_COLORS, CHIP_TEXT_COLORS } from '@/constants/chips';

interface ChipProps {
    value: number;
    color?: string;
}

const Chip: React.FC<ChipProps> = ({ value, color }) => {
    const bgClass = color || CHIP_COLORS[value] || 'bg-gray-400';
    const textClass = CHIP_TEXT_COLORS[value] || 'text-white';

    return (
        // 使用 Tailwind 的 shadow 和 border 營造厚度感
        <div className={`
      w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-dashed border-white/50
      flex items-center justify-center font-bold shadow-xl
      transform transition-transform active:scale-95 cursor-pointer
      ${bgClass} ${textClass}
      ring-4 ring-black/20 ring-inset
      relative text-sm md:text-base
    `}>
            {/* 籌碼的側面厚度效果 */}
            <div className="absolute inset-0 rounded-full border-b-4 border-black/30"></div>
            {value}
        </div>
    );
};

export default Chip;