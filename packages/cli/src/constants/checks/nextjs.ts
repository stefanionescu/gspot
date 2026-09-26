// The literal values checks/nextjs reads: names, patterns, limits, and tables.

export const SEGMENT_NAME = /^(?<kind>page|route)\.[jt]sx?$/u;
export const CONFIG_FILE = /(?:^|\/)next\.config\.(?:js|mjs|cjs|ts|mts)$/u;
export const SWITCHED_OFF = /\b(?<name>ignoreDuringBuilds|ignoreBuildErrors)\s*:\s*true\b/gu;
export const SECRET_KEY = /\b(?<name>[A-Z][A-Z\d_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z\d_]*)\s*:/gu;
export const PAIRS: [string, string][] = [
    ['next', 'eslint-config-next'],
    ['next', '@next/eslint-plugin-next'],
    ['react', 'react-dom'],
];
export const SHOWN_LINES = 3;
export const TSC_LINE = /^(?<file>[^(]+)\((?<line>\d+),(?<column>\d+)\): error (?<rule>TS\d+): (?<text>.*)$/u;
export const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'];
