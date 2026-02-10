import { CHIP_VALUES, CHIP_COLORS } from '@/constants/chips';

export interface ChipStackConfig {
    value: number;
    color: string;
    count: number;
}

export const getChipStack = (amount: number): ChipStackConfig[] => {
    const stack: ChipStackConfig[] = [];
    let remaining = amount;

    for (const value of CHIP_VALUES) {
        const count = Math.floor(remaining / value);
        if (count > 0) {
            stack.push({
                value,
                color: CHIP_COLORS[value] || 'bg-gray-400',
                count
            });
            remaining %= value;
        }
    }

    return stack;
};
