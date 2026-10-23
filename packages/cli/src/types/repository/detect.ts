import type { ScopeSettings } from '#cli/types/settings/inheritance.ts';
import type { Group, Configuration } from '#cli/types/configurations.ts';
import type { FileKind, TrackedFile } from '#cli/types/repository/files.ts';

export type ScopeContents = {
    files: TrackedFile[];
    extensionCounts: Map<string, number>;
    shebangs: Set<string>;
    runtimes: Map<string, string>;
    dependencies: Map<string, string>;
    scope: string;
};

export type ConfigurationEvidence = {
    configuration: string;
    evidence: string;
    group: Group;
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

export type DetectionEvidence = { evidence: string; count?: number };

export type CoveredFilesOptions = {
    configurations: Configuration[];
    scopePath: string;
    settings: Pick<ScopeSettings, 'test_files' | 'settings'>;
};
