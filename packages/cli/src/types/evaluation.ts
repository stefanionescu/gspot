// The types of evaluation in this package.
import type { z } from 'zod';
import type { CarriedFormatter } from '#cli/types/policy/adoption.ts';
import type { EslintAdoption, EslintRegistration } from '#cli/types/policy/policy.ts';

import type {
    configurationRequest,
    eslintRequest,
    formatFields,
    formatRequest,
    prettierSettings,
    prettierSource,
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
export type Carried = { format: CarriedFormatter['format']; extra: Record<string, unknown> };
export type NestedInput = { from: string; settings: CarriedFormatter };
export type Base = z.infer<typeof prettierSettings>;
export type Parsed = {
    indent: ReturnType<typeof formatFields.indent_width.safeParse>;
    width: ReturnType<typeof formatFields.print_width.safeParse>;
    ending: ReturnType<typeof formatFields.line_ending.safeParse>;
};
export type Adoption = { request: EslintRequest; configPath: string; references: Map<unknown, EslintRegistration> };
export type Ignores = NonNullable<EslintAdoption['legacyIgnores']>;
export type Criteria = NonNullable<EslintAdoption['legacyCriteria']>;
export type Plugins = NonNullable<LegacyEslintEntry['plugins']>;
export type Legacy = {
    api: LegacyEslintApi;
    factory: InstanceType<LegacyEslintApi['Legacy']['ConfigArrayFactory']>;
    compat: InstanceType<LegacyEslintApi['FlatCompat']>;
};
export type Translation = {
    root: string;
    configPath: string;
    references: Map<unknown, EslintRegistration>;
    legacy: Legacy;
};
export type LegacyEslintMatcher = {
    pattern: string;
    negate: boolean;
    options: { matchBase?: boolean };
};
export type LegacyEslintCriteria = {
    basePath: string;
    patterns: { includes: LegacyEslintMatcher[] | null; excludes: LegacyEslintMatcher[] | null }[];
};
export type LegacyEslintDependency = {
    id: string;
    filePath: string;
    definition: unknown;
    original?: unknown;
    error?: Error | null;
};
export type LegacyEslintEntry = {
    type: string;
    name: string;
    criteria: LegacyEslintCriteria | null;
    ignorePattern?: { basePath: string; patterns: string[]; loose: boolean };
    parser?: LegacyEslintDependency;
    plugins?: Record<string, LegacyEslintDependency>;
    [key: string]: unknown;
};
export type LegacyEslintApi = {
    Legacy: {
        ConfigArrayFactory: new (options: Record<string, unknown>) => {
            loadFile(path: string): LegacyEslintEntry[];
            loadInDirectory(path: string): LegacyEslintEntry[];
            loadDefaultESLintIgnore(): LegacyEslintEntry[];
        };
        IgnorePattern: { DefaultPatterns: string[] };
        naming: { normalizePackageName(name: string, prefix: string): string };
    };
    FlatCompat: new (options: Record<string, unknown>) => {
        config(configuration: Record<string, unknown>): Record<string, unknown>[];
    };
};
export type PendingModule = { value: unknown; exported: string; members: string[] };
