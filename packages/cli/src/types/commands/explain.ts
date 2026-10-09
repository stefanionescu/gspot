import type { OwnedCheck } from '#cli/types/configurations.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';
import type { ResolvedSetting, RepositoryDefinition } from '#cli/types/policy/settings.ts';

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
    agentRules: string[];
    auto: boolean;
};

export type Found = OwnedCheck | { check: RepositoryDefinition; configuration: undefined };

export type CheckFacts = {
    source: string;
    settings: string[];
    agentRules: string[];
    crashPattern: string | undefined;
    minVersions: Record<string, string> | undefined;
    versionRequirements: string[];
};
