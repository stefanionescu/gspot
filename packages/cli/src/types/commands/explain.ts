// The types of commands/explain in this package.
import type { Manifest, CheckSpec } from '#cli/types/kits.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import type { ResolvedSetting } from '#cli/types/policy/policy.ts';

export type SettingScope = { scope: string; shipped: unknown; current: ResolvedSetting | undefined };
export type Explanation = {
    kind: 'check' | 'tool-rule' | 'configuration' | 'setting' | 'path';
    subject: string;
    text: string;
    data: Record<string, unknown>;
};
export type PathExplanation = {
    path: string;
    scope: string;
    nature: string;
    natureSource?: string;
    tags: string[];
    configurations: string[];
    checks: { check: string; stage: string; configuration?: string }[];
    ignores: { check: string; rule?: string; reason?: string }[];
    unchecked?: string;
    remedy?: string;
};
export type Found = { check: CheckSpec; kit: Manifest | undefined };
export type OwnCheck = Session['policyFiles']['policy']['checks'][number];
export type Facts = { settings: string[]; rules: string[]; crashPattern: string | undefined };
