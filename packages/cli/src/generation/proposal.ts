// What generation proposes and lifecycle applies: files, managed blocks, and shared configuration edits.
import type { FileSnapshot } from '#cli/platform/safe-paths.ts';
import type { ConfigurationFormat } from '#cli/lifecycle/configuration-document.ts';

export type GeneratedFile = {
    rulesPath?: string[];
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    observed?: FileSnapshot;
    kind: 'lock' | 'config' | 'pointer' | 'hook' | 'runner' | 'workflow' | 'rules' | 'managed-block';
    configuration?: string;
};

export type BlockOutput = { path: string; block: string; style: 'markdown' | 'hash' };

export type ConfigurationOutput = {
    path: string;
    format: ConfigurationFormat;
    changes: { path: (string | number)[]; value: unknown }[];
};

export type GeneratedProposal = {
    notes: string[];
    files: GeneratedFile[];
    blocks: BlockOutput[];
    merges: ConfigurationOutput[];
    configurations: ConfigurationOutput[];
};
