import type { z } from 'zod';

import type { formatSchema } from '#cli/schemas/settings/fields.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import type { Defined, ParsedSettings, TableSettings } from '#cli/types/settings.ts';

export type TaskNames = { mise: Set<string>; scripts: Set<string>; binaries: Set<string> };

export type PathIndex = {
    paths: Set<string>;
    isIgnored: (path: string) => boolean;
    tasks: TaskNames;
};

export type SuppressionSyntax = {
    covered: ReadonlySet<string>;
    tool: string;
    marker: RegExp;
    inlineMarker: RegExp;
    extractReason: (text: string) => string | undefined;
    forbidden: boolean;
    separator: RegExp | undefined;
    allRules: RegExp | undefined;
    limitRules: RegExp | undefined;
};

export type AllowedPackage = TableSettings<'licenses'>['allowed_package'][number];

export type LockedPackage = {
    file: string;
    line: number;
    name: string;
    version: string;
    isPython: boolean;
    licenses: string[];
};

export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

export type ProseRouteBatch = [ProseRoute, ...ProseRoute[]];

export type CommitMessage = { text: string; prefix: string };

export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

export type Weakening = { rule: string; file: string; change: string; reason?: string | undefined };

export type FormatOverride = {
    files: string[];
    excludeFiles: string[];
    options: Record<string, unknown>;
};

export type FormatSettings = Required<Defined<Omit<NonNullable<ParsedSettings['format']>, 'override' | 'quotes'>>> &
    Pick<NonNullable<ParsedSettings['format']>, 'quotes'>;

export type ScopeFormat = {
    scopePath: string;
    paths: string[];
    format: { [Key in keyof FormatSettings]?: FormatSettings[Key] | undefined };
};

export type WrittenFormat = z.input<typeof formatSchema>;
