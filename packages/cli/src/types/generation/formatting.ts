import type { Policy, FormatSettings } from '#cli/types/policy/settings.ts';

export type JsonFormat = { width: number; indent: number };

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

export type EditorconfigOverride = { path: string; options: Record<string, string | number | boolean> };

export type NativeOverride<Options> = {
    files: string | string[];
    excludeFiles?: string | string[] | undefined;
    options: Options;
};

export type ExcludedBasename = { isNegated: boolean; basename: string };

export type FormatSelectorGroup<Options> = {
    patterns: string[];
    excluded: string[];
    options: Options;
    hasSlash: boolean;
    sourceDirectory: string;
    fromGeneratedFile: (pattern: string) => string;
};

/** Plugin list emitted only when the formatter has applicable plugins. */
export type PrettierPluginOptions = { plugins?: string[] };

/** Effective formatting choices and authored overrides for one generated Prettier config file. */
export type PrettierInput = {
    policy: Policy;
    format: FormatSettings;
    targetPath: string;
    verbatim: Record<string, unknown> | undefined;
    plugins: PrettierPlugin[];
};
