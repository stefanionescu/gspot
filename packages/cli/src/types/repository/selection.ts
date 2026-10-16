import type { Manifest } from '#cli/types/configurations.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import type { GROUP_LABELS } from '#cli/config/configurations.ts';
import type { FileKind } from '#cli/types/repository/inventory.ts';

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
    scopes: Record<string, { configurations: string[]; removed_configurations: string[] }>;
    removed_configurations: string[];
};

/** A detected configuration absent from the saved selection, with its install command. */
export type ConfigurationSuggestion = { configuration: string; evidence: string; command: string };

/** Repository evidence with an optional count for extension matches. */
export type DetectionEvidence = { evidence: string; count?: number };

/** Configuration selection and scope values for repository file coverage. */
export type FileCoverageOptions = {
    selected: Manifest[];
    scope: string;
    view: Pick<ScopeView, 'test_files' | 'settings'>;
};
