// The types of generation/formatting in this package.
import type { FormatSettings } from '#cli/types/policy/policy.ts';

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
export type ExcludedBasename = { isNegated: boolean; basename: string };
export type FormatSelectorGroup<Options> = {
    patterns: string[];
    excluded: string[];
    options: Options;
    hasSlash: boolean;
    sourceDirectory: string;
    fromGeneratedFile: (pattern: string) => string;
};
export type NativeOverride<Options> = {
    files: string | string[];
    excludeFiles?: string | string[] | undefined;
    options: Options;
};
