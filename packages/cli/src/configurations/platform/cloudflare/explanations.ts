import { MISSING_HEADER_RULE } from '#cli/config/configurations/cloudflare.ts';
import { SYNTAX_EXPLANATIONS } from '#cli/configurations/syntax.ts';
import type { RuleExplanations } from '#cli/types/tools.ts';

export const HEADER_EXPLANATIONS = {
    [MISSING_HEADER_RULE]: {
        description:
            'The `/*` block of `_headers` sets `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, and `X-Frame-Options` or a `frame-ancestors` policy.',
        why: 'Without them, browsers guess content types, send full URLs to other sites, and let other sites frame the pages.',
        fix: 'Add the missing headers to the `/*` block.',
        example: 'A `/*` block that sets only `Referrer-Policy: no-referrer` reports `missing-header`.',
    },
    ...SYNTAX_EXPLANATIONS,
} as const satisfies RuleExplanations;
