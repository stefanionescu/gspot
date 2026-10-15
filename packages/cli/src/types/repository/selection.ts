import type { Mutation } from '#cli/types/settings/file.ts';
import type { GROUP_LABELS } from '#cli/config/configurations.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';

/** Settings mutation and selection changes calculated from repository evidence. */
export type ConfigurationReconciliation = { mutate: Mutation; notes: string[] };

/** Existing and detected choices with a scope's recorded overrides. */
export type ConfigurationLists = {
    saved: string[];
    found: string[];
    removed: string[];
};

export type ConfigurationEvidence = {
    configuration: string;
    evidence: string;
    group: keyof typeof GROUP_LABELS;
    count?: number;
};

export type FileMatch = {
    extensions: string[];
    filenames: string[];
    tags: string[];
    paths: string[];
    languages: boolean;
    prettier_plugins: boolean;
    eslint_plugins: boolean;
    kinds: FileKind[];
};

/** Configuration choices declared at the root and in project scopes. */
export type ConfigurationSelection = {
    configurations: string[];
    scope: Record<string, { configurations: string[]; removed_configurations: string[] }>;
    removed_configurations: string[];
};

/** A detected configuration absent from the saved selection, with its install command. */
export type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

/** Repository evidence with an optional count for extension matches. */
export type DetectionEvidence = { evidence: string; count?: number };

/** Resolved setting patterns and the selected configuration defaults for absent values. */
export type SettingFilePatterns = { paths: string[]; defaults: FileMatch[] };
