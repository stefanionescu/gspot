/** The required Wrangler fields absent from its native package schema. */
export const WRANGLER_FIELDS = {
    name: { pattern: /^/u, rule: 'missing-name', message: 'The configuration names no worker.' },
    compatibility_date: {
        pattern: /^\d{4}-\d{2}-\d{2}$/u,
        rule: 'compatibility-date',
        message: 'The configuration pins no compatibility_date, so the runtime behavior changes under it.',
    },
};

export const REQUIRED_HEADERS: Record<string, RegExp> = {
    'x-content-type-options': /^nosniff$/iu,
    'referrer-policy': /\S/u,
    'x-frame-options': /^(?:deny|sameorigin)$/iu,
};
