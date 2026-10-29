export const OSV_SCANNER_NOTES = [
    '# This file stops OSV-Scanner from reading an osv-scanner.toml next to a lockfile.',
    '# Accept a vulnerability with gspot ignore dependencies/osv-scanner --rule <ID> and a reason.',
];

export const BUNFIG_FILE = 'bunfig.toml';

export const SCANNER_KEY = ['install', 'security', 'scanner'] as const;

export const OSV_SCANNER_CHECK = 'dependencies/osv-scanner';
