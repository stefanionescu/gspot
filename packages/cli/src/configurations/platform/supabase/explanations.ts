import type { LintRuleDocs } from '#cli/types/tools.ts';
import { SYNTAX_RULE_DOCS } from '#cli/configurations/explanations.ts';
import { SUPABASE_CHECK_RULES } from '#cli/config/configurations/infrastructure.ts';

export const DENO_CHECK_RULE_DOCS = {
    [SUPABASE_CHECK_RULES.typeError]: {
        description: 'The entry file of each edge function passes `deno check`.',
        why: 'A type error in an edge function fails when the function deploys or runs.',
        fix: 'Fix the type error at the reported line, then run the check again.',
        example: 'Passing a number where the handler expects a `Request` reports `type-error`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;

export const STORAGE_POLICY_RULE_DOCS = {
    [SUPABASE_CHECK_RULES.bucketPolicy]: {
        description: 'A migration policy on `storage.objects` names each bucket of `supabase/config.toml`.',
        why: 'A bucket that no policy names has access rules that nobody wrote down.',
        fix: 'Add a policy on `storage.objects` that checks `bucket_id` for the bucket.',
        example: 'A bucket `avatars` that no policy names reports `bucket-policy`.',
    },
    ...SYNTAX_RULE_DOCS,
} as const satisfies Readonly<Record<string, LintRuleDocs>>;
