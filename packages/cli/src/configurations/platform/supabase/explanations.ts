import type { RuleExplanations } from '#cli/types/tools.ts';
import { SYNTAX_EXPLANATIONS } from '#cli/configurations/syntax.ts';
import { SUPABASE_CHECK_RULES } from '#cli/config/configurations/supabase.ts';

export const DENO_CHECK_EXPLANATIONS = {
    [SUPABASE_CHECK_RULES.typeError]: {
        description: 'The entry file of each edge function passes `deno check`.',
        why: 'A type error in an edge function fails when the function deploys or runs.',
        fix: 'Fix the type error at the reported line.',
        example: 'Passing a number where the handler expects a `Request` reports `type-error`.',
    },
    ...SYNTAX_EXPLANATIONS,
} as const satisfies RuleExplanations;

export const STORAGE_POLICY_EXPLANATIONS = {
    [SUPABASE_CHECK_RULES.bucketPolicy]: {
        description: 'A migration policy on `storage.objects` names each bucket of `supabase/config.toml`.',
        why: 'A bucket that no policy names has access rules that nobody wrote down.',
        fix: 'Add a policy on `storage.objects` that checks `bucket_id` for the bucket.',
        example: 'A bucket `avatars` that no policy names reports `bucket-policy`.',
    },
    ...SYNTAX_EXPLANATIONS,
} as const satisfies RuleExplanations;
