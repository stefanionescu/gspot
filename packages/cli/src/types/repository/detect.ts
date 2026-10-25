import type { Group } from '#cli/types/configurations.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';

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

export type DetectionEvidence = { evidence: string; count?: number };
