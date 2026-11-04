import type { LintRuleDocs } from '#cli/types/tools.ts';
import { SYNTAX_RULE_DOCS } from '#cli/configurations/explanations.ts';
import { MISSING_HEADER_RULE } from '#cli/config/configurations/infrastructure.ts';

export const HEADER_RULE_DOCS = {
    [MISSING_HEADER_RULE]: {
        description:
            'The `/*` block of `_headers` sets `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, and `X-Frame-Options` or a `frame-ancestors` policy.',
        why: 'Without them, browsers guess content types, send full URLs to other sites, and let other sites frame the pages.',
        fix: 'Add the missing headers to the `/*` block.',
        example: 'A `/*` block that sets only `Referrer-Policy: no-referrer` reports `missing-header`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
