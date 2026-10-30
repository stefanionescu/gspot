import type { FileKind } from '#cli/types/repository/files.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { InheritedSetting } from '#cli/types/settings/inheritance.ts';

export type Explanation = {
    kind: 'check' | 'lint-rule' | 'configuration' | 'setting' | 'path';
    subject: string;
    text: string;
    facts: Record<string, unknown>;
};

export type CheckIgnore = { rule?: string | undefined; paths?: string[] | undefined; reason: string; command: string };

export type PathExplanation = {
    path: string;
    scope: string;
    fileKind: FileKind;
    fileKindOrigin?: string;
    tags: string[];
    configurations: string[];
    checks: { check: string; stage: string; configuration?: string }[];
    ignores: { check?: string; rule?: string; reason: string }[];
    unchecked?: string;
    remedy?: string;
};

export type SettingScope = {
    scope: string;
    shipped: unknown;
    inherited: InheritedSetting | undefined;
    readBy: string[];
};

export type ConfigurationExplanation = {
    name: string;
    group: Configuration['group'];
    title: string;
    description: string;
    requires: string[];
    tools: string[];
    checks: { check: string; stage: string }[];
    settings: string[];
    rules: string[];
    alwaysSelected: boolean;
    removed: { scope: string; reason: string; command: string }[];
};

export type LintRuleDocs = { description: string | undefined; url: string | undefined };

export type CheckFacts = {
    source: string;
    settings: string[];
    rules: string[];
    crashPattern: string | undefined;
    ignores: CheckIgnore[];
    minVersions: Record<string, string>;
};
