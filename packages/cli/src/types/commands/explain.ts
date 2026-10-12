import type { FileKind } from '#cli/types/repository/inventory.ts';
import type { CommandCheck, SettingEntry } from '#cli/types/settings/values.ts';
import type { Manifest, ConfigurationCheck } from '#cli/types/configurations.ts';

export type Explanation = {
    kind: 'check' | 'lint-rule' | 'configuration' | 'setting' | 'path';
    subject: string;
    text: string;
    data: Record<string, unknown>;
};

export type PathExplanation = {
    path: string;
    scope: string;
    /** The kind of the file: source, generated, vendored, or binary. The explanation uses the path kind. */
    fileKind: FileKind;
    fileKindSource?: string;
    tags: string[];
    configurations: string[];
    checks: { check: string; stage: string; configuration?: string }[];
    ignores: { check: string; rule?: string; reason?: string }[];
    unchecked?: string;
    remedy?: string;
};

export type SettingScope = { scope: string; shipped: unknown; effective: SettingEntry | undefined };

export type ConfigurationExplanation = {
    name: string;
    group: Manifest['configuration']['group'];
    title: string;
    description: string;
    requires: string[];
    tools: string[];
    checks: { check: string; stage: string }[];
    settings: string[];
    rules: string[];
    alwaysSelected: boolean;
};

export type Found = ConfigurationCheck | { check: CommandCheck; configuration: undefined };

export type CheckFacts = {
    source: string;
    settings: string[];
    rules: string[];
    crashPattern: string | undefined;
    minVersions: Record<string, string>;
};
