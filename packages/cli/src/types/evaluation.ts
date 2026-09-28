// The types of evaluation in this package.
import type { z } from 'zod';
import type { AdoptedFormatting } from '#cli/types/policy/adoption.ts';
import type { EslintAdoption, EslintRegistration } from '#cli/types/policy/policy.ts';

import type {
    formatFields,
    eslintRequest,
    formatRequest,
    prettierSource,
    prettierSettings,
    configurationRequest,
} from '#cli/evaluation/protocol.ts';

export type PrettierOverride = NonNullable<z.infer<typeof prettierSource>['overrides']>[number];
export type EvaluationRequest = z.infer<typeof configurationRequest>;
export type EslintRequest = z.infer<typeof eslintRequest>;
export type LicenseChecker = {
    init: (
        options: { start: string; includePackages: string; excludePrivatePackages: boolean },
        callback: (error: Error | null, report: unknown) => void,
    ) => void;
};
export type FormatRequest = z.infer<typeof formatRequest>;
export type Source = NonNullable<FormatRequest['source']>;
export type FormatterSettings = { format: AdoptedFormatting['format']; extra: Record<string, unknown> };
export type NestedInput = { from: string; settings: AdoptedFormatting };
export type Base = z.infer<typeof prettierSettings>;
export type Parsed = {
    indent: ReturnType<typeof formatFields.indent_width.safeParse>;
    width: ReturnType<typeof formatFields.print_width.safeParse>;
    ending: ReturnType<typeof formatFields.line_ending.safeParse>;
};
export type Adoption = { request: EslintRequest; configPath: string; references: Map<unknown, EslintRegistration> };
export type Ignores = NonNullable<EslintAdoption['legacyIgnores']>;
export type Criteria = NonNullable<EslintAdoption['legacyCriteria']>;
export type Plugins = NonNullable<EslintrcEntry['plugins']>;
export type EslintrcTranslation = {
    api: EslintrcApi;
    factory: InstanceType<EslintrcApi['Legacy']['ConfigArrayFactory']>;
    compat: InstanceType<EslintrcApi['FlatCompat']>;
};
export type Translation = {
    root: string;
    configPath: string;
    references: Map<unknown, EslintRegistration>;
    eslintrc: EslintrcTranslation;
};
export type EslintrcMatcher = {
    pattern: string;
    negate: boolean;
    options: { matchBase?: boolean };
};
export type EslintrcCriteria = {
    basePath: string;
    patterns: { includes: EslintrcMatcher[] | null; excludes: EslintrcMatcher[] | null }[];
};
export type EslintrcDependency = {
    id: string;
    filePath: string;
    definition: unknown;
    original?: unknown;
    error?: Error | null;
};
export type EslintrcEntry = {
    type: string;
    name: string;
    criteria: EslintrcCriteria | null;
    ignorePattern?: { basePath: string; patterns: string[]; loose: boolean };
    parser?: EslintrcDependency;
    plugins?: Record<string, EslintrcDependency>;
    [key: string]: unknown;
};
export type EslintrcApi = {
    Legacy: {
        ConfigArrayFactory: new (options: Record<string, unknown>) => {
            loadFile(path: string): EslintrcEntry[];
            loadInDirectory(path: string): EslintrcEntry[];
            loadDefaultESLintIgnore(): EslintrcEntry[];
        };
        IgnorePattern: { DefaultPatterns: string[] };
        naming: { normalizePackageName(name: string, prefix: string): string };
    };
    FlatCompat: new (options: Record<string, unknown>) => {
        config(configuration: Record<string, unknown>): Record<string, unknown>[];
    };
};
export type PendingModule = { value: unknown; exported: string; members: string[] };
