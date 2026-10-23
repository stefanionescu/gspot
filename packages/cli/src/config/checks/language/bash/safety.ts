export const ALL_LEVEL_SAFETY_PATTERNS = [
    [
        /\|\|\s*true(?:\s|$)/u,
        'ignored-failure',
        '`|| true` hides the failure of this command. Handle the failure, or let it stop the script.',
    ],
] as const;

export const SAFETY_PATTERNS = [
    [
        /\bpkill\s+-f\b/u,
        'broad-kill',
        '`pkill -f` stops every process whose command line matches. Stop the one process by its ID.',
    ],
    [/\bkillall\b/u, 'broad-kill', '`killall` stops every process with this name. Stop the one process by its ID.'],
    [
        /\brm\s+-(?:[\dA-Z_a-qs-z]*r\w*f|[\dA-Z_a-eg-z]*f\w*r)\b/u,
        'recursive-remove',
        'This line deletes files recursively. Delete only a mktemp path in a trap, or ignore this rule with a reason.',
    ],
] as const;
