import type { OwnedCheck } from '#cli/types/configurations.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';
import type { ResolvedSetting } from '#cli/types/policy/settings.ts';

export type Explanation = {
    kind: 'check' | 'tool-rule' | 'configuration' | 'setting' | 'path';
    subject: string;
    text: string;
    data: Record<string, unknown>;
};

export type PathExplanation = {
    path: string;
    scope: string;
    /** The kind of the file: source, generated, vendored, or binary. The explanation's own kind is path. */
    fileKind: FileKind;
    fileKindSource?: string;
    tags: string[];
    configurations: string[];
    checks: { check: string; stage: string; configuration?: string }[];
    ignores: { check: string; rule?: string; reason?: string }[];
    unchecked?: string;
    remedy?: string;
};

export type SettingScope = { scope: string; shipped: unknown; effective: ResolvedSetting | undefined };

export type ConfigurationExplanation = {
    name: string;
    kind: string;
    title: string;
    description: string;
    requires: string[];
    tools: string[];
    checks: { check: string; stage: string }[];
    settings: string[];
    guides: string[];
    auto: boolean;
    proposed: boolean;
};

export type DeclaredCheck = Session['policyFiles']['policy']['checks'][number];

export type Found = OwnedCheck | { check: DeclaredCheck; configuration: undefined };

export type CheckFacts = { source: string; settings: string[]; guides: string[]; crashPattern: string | undefined };

/** A native tool's rule-description command. */
export type RuleSummarizer = (rule: string, executable: string) => string | undefined;
