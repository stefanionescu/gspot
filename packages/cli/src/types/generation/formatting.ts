import type { FormatSettings } from '#cli/types/settings/file.ts';

export type FormatOverride = {
    files: string[];
    excludeFiles: string[];
    options: Record<string, unknown>;
};

/** A Prettier plugin that a manifest ships: its npm name, its module file, and the overrides its files need. */
export type PrettierPlugin = {
    name: string;
    module: string;
    overrides: { files: string; options: Record<string, unknown> }[];
};

export type ScopeFormat = { scope: string; paths: string[]; format: Partial<FormatSettings> };
