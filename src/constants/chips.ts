export const CHIP_VALUES = [1000, 500, 200, 100, 50, 10, 5, 2, 1];

export const CHIP_COLORS: Record<number, string> = {
    1: 'bg-slate-200',      // White/Grey
    2: 'bg-sky-300',       // Light Blue
    5: 'bg-red-600',       // Red
    10: 'bg-blue-700',     // Dark Blue
    50: 'bg-green-600',    // Green
    100: 'bg-slate-900',   // Black
    200: 'bg-purple-600',  // Purple
    500: 'bg-orange-500',  // Orange
    1000: 'bg-yellow-500', // Gold
};

export const CHIP_TEXT_COLORS: Record<number, string> = {
    1: 'text-slate-800',
    2: 'text-slate-900',
    5: 'text-white',       // Red needs white text
    10: 'text-white',      // Dark Blue needs white text
    50: 'text-white',      // Green needs white text
    100: 'text-white',     // Black needs white
    200: 'text-white',     // Purple needs white
    500: 'text-white',     // Orange works with white
    1000: 'text-black',    // Yellow/Gold needs black
};
