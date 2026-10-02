// The types of commands/explain in this package.
import type { Session } from '#cli/types/tools/tools.ts';
import type { Manifest, CheckSpec } from '#cli/types/kits.ts';
import type { ResolvedSetting } from '#cli/types/policy/policy.ts';

export type SettingScope = { scope: string; shipped: unknown; current: ResolvedSetting | undefined };
export type Explanation = {
    kind: 'check' | 'tool-rule' | 'kit' | 'setting' | 'path';
    subject: string;
    text: string;
    data: Record<string, unknown>;
};
export type PathExplanation = {
    path: string;
    scope: string;
    /** The kind of the file: source, generated, vendored, or binary. The explanation's own kind is path. */
    fileKind: string;
    fileKindSource?: string;
    tags: string[];
    kits: string[];
    checks: { check: string; stage: string; kit?: string }[];
    ignores: { check: string; rule?: string; reason?: string }[];
    unchecked?: string;
    remedy?: string;
};
export type Found = { check: CheckSpec; kit: Manifest | undefined };
export type DeclaredCheck = Session['policyFiles']['policy']['checks'][number];
export type CheckFacts = { settings: string[]; rules: string[]; crashPattern: string | undefined };

export type ListingRow = {
    name: string;
    kind: string;
    title: string;
    description: string;
    requires: string[];
    tools: string[];
    checks: { check: string; stage: string }[];
    settings: string[];
    rules: string[];
    auto: boolean;
    proposed: boolean;
};
