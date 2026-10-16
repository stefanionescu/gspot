import type { Settings } from '#cli/types/settings/values.ts';
import type { FormatSettings } from '#cli/types/settings/file.ts';

export type FormatOverride<Options = Record<string, unknown>> = {
    files: string[];
    excludeFiles: string[];
    options: Options;
};

/** A Prettier plugin a selected manifest ships: its npm name, its entry file, and the overrides its files need. */
export type PrettierPlugin = {
    name: string;
    entry: string;
    overrides: { files: string; options: Record<string, unknown> }[];
};

export type ScopeFormat = { scope: string; paths: string[]; format: Partial<FormatSettings> };

export type ExtraOverride<Options> = {
    files: string | string[];
    excludeFiles?: string | string[] | undefined;
    options: Options;
};

/** Plugin list used only when the formatter has applicable plugins. */
export type PrettierPluginOptions = { plugins?: string[] };

/** Effective formatting choices and authored overrides for one generated Prettier tool file. */
export type PrettierInput = {
    settings: Settings;
    format: FormatSettings;
    targetPath: string;
    extra: Record<string, unknown> | undefined;
    plugins: PrettierPlugin[];
};
