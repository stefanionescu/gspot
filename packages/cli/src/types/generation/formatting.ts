import { type Defined, type Optional } from '#cli/types/shapes.ts';
import type { ParsedSettings } from '#cli/types/settings/settings.ts';

export type FormatOverride = {
    files: string[];
    excludeFiles: string[];
    options: Record<string, unknown>;
};

export type PrettierPlugin = {
    name: string;
    module: string;
    overrides: { files: string; options: Record<string, unknown> }[];
};

export type ScopeFormat = { scope: string; paths: string[]; format: Optional<FormatSettings> };

export type FormatSettings = Required<Defined<Omit<NonNullable<ParsedSettings['format']>, 'override' | 'quotes'>>> &
    Pick<NonNullable<ParsedSettings['format']>, 'quotes'>;
