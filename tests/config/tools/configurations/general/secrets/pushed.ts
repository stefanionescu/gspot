/** Inert tokens recognized only by the loopback provider's custom detector. */
export const VERIFIER_TOKENS = {
    first: 'gspot-acceptance-token-first',
    second: 'gspot-acceptance-token-second',
} as const;

/** Native history and the two failed native output contracts share preparation. */
export const SECRET_VERIFICATION_CASES = [
    {
        name: 'verified-secret history scans every changed blob without exposing raw credentials',
        mode: 'native',
        code: 1,
        status: 'failed' as const,
    },
    {
        name: 'verified-secret history redacts malformed tool output',
        mode: 'malformed',
        code: 2,
        status: 'error' as const,
    },
    {
        name: 'verified-secret history redacts crashed tool output',
        mode: 'crashed',
        code: 2,
        status: 'error' as const,
    },
];
