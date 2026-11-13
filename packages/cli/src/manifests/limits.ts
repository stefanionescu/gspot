import { readConfigurations } from '#cli/manifests/read.ts';
import { findToolName } from '#cli/manifests/tools.ts';
import type { LimitCheck } from '#cli/types/manifests.ts';

const checks = readConfigurations()
    .values()
    .flatMap((configuration) => configuration.checks)
    .toArray();

export const LIMIT_READERS: readonly LimitCheck[] = checks.flatMap((check) => {
    if (check.limits === undefined) return [];
    return [
        {
            check: check.id,
            languages: check.limit_languages ?? [],
            limits: [...new Set(Array.isArray(check.limits) ? check.limits : Object.values(check.limits))],
        },
    ];
});

export const LIMIT_RULES_BY_CHECK = new Map(
    checks.flatMap((check) =>
        check.limits === undefined || Array.isArray(check.limits) ? [] : [[check.id, check.limits] as const],
    ),
);

export const LIMIT_SETTING_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.fromEntries(
    checks.flatMap((check) => {
        if (check.limits === undefined || Array.isArray(check.limits)) return [];
        const tool = findToolName(check);
        if (tool === undefined) return [];
        return [
            [tool, Object.fromEntries(Object.entries(check.limits).map(([rule, limit]) => [rule, `limits.${limit}`]))],
        ];
    }),
);
