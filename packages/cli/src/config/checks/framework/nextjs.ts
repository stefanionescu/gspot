export const SEGMENT_NAME = /^(?<kind>page|route)\.[jt]sx?$/u;

export const NEXT_CONFIG = /(?:^|\/)next\.config\.(?:js|mjs|cjs|ts|mts)$/u;

export const PAIRS: [string, string][] = [
    ['next', 'eslint-config-next'],
    ['next', '@next/eslint-plugin-next'],
    ['react', 'react-dom'],
];

export const TSC_LINE = /^(?<file>[^(]+)\((?<line>\d+),(?<column>\d+)\): error (?<rule>TS\d+): (?<text>.*)$/u;

export const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'];

export const SHOWN_LINES = 3;

// The marked line and the one after it.
export const MARKED_LINES = 2;
