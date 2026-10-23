import { z } from 'zod';

import type {
    GlobalsModule,
    PackageModule,
    TestsManifest,
    PrettierModule,
    PackageIdentity,
    StylelintModule,
    EslintRuleModule,
    StylelintSettings,
    StylelintModuleExport,
} from '#cli/types/linter-lists.ts';

export const packageIdentitySchema = z.object({
    name: z.string(),
    version: z.string(),
    peerDependencies: z.record(z.string(), z.string()).default({}),
}) satisfies z.ZodType<PackageIdentity>;
export const stylelintSettingsSchema = z.object({
    rules: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<StylelintSettings>;
export const stylelintModuleSchema = z.object({
    default: z.custom<StylelintModule>(
        (value) =>
            value !== null &&
            (typeof value === 'function' || typeof value === 'object') &&
            typeof Reflect.get(value, 'resolveConfig') === 'function',
    ),
}) satisfies z.ZodType<StylelintModuleExport>;
export const prettierModuleSchema = z.object({
    format: z.custom<PrettierModule['format']>((value) => typeof value === 'function'),
    resolveConfig: z.custom<PrettierModule['resolveConfig']>((value) => typeof value === 'function'),
}) satisfies z.ZodType<PrettierModule>;
export const eslintRuleModuleSchema = z.object({
    builtinRules: z.map(z.string(), z.unknown()),
}) satisfies z.ZodType<EslintRuleModule>;
export const packageModuleSchema = z.object({ default: z.unknown() }) satisfies z.ZodType<PackageModule>;
export const globalsModuleSchema = z.object({
    default: z.record(z.string(), z.record(z.string(), z.boolean())),
}) satisfies z.ZodType<GlobalsModule>;

export const testsManifestSchema = z.object({
    devDependencies: z.record(z.string(), z.string()),
}) satisfies z.ZodType<TestsManifest>;
