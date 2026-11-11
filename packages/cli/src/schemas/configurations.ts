import { z } from 'zod';

import { DOCSTRING_STYLES } from '#cli/config/configurations/shared.ts';

export const svelteFindingSchema = z.object({
    filename: z.string().min(1),
    start: z.object({
        line: z.int().nonnegative(),
        character: z.int().nonnegative(),
    }),
    message: z.string(),
    code: z.union([z.string(), z.number()]).optional(),
});

export const failureMessageSchema = z.string();

export const purgecssOutputSchema = z.object({ file: z.string().min(1), rejected: z.string().array() }).array();

const cloneLocationSchema = z.object({
    name: z.string().min(1),
    start: z.int().positive(),
});

export const jscpdOutputSchema = z.object({
    duplicates: z
        .object({
            lines: z.int().positive(),
            firstFile: cloneLocationSchema,
            secondFile: cloneLocationSchema,
        })
        .array(),
});

const osvPackageSchema = z.object({
    package: z.object({ name: z.string(), version: z.string(), ecosystem: z.string() }),
    license_violations: z.string().array().default([]),
});

const osvResultSchema = z.object({
    source: z.object({ path: z.string() }),
    packages: osvPackageSchema.array().default([]),
});

export const osvLicenseReportSchema = z.object({
    results: osvResultSchema.array().default([]),
});

const buildSchema = z.object({
    context: z.string().optional(),
    dockerfile: z.string().optional(),
});

const serviceSchema = z.object({
    image: z.string().min(1).optional(),
    build: z.union([z.string().transform((context) => ({ context, dockerfile: undefined })), buildSchema]).optional(),
});

export const composeSchema = z.object({
    services: z.record(z.string(), serviceSchema).optional(),
});

const vulnerabilitySchema = z.object({
    VulnerabilityID: z.string().min(1),
    PkgName: z.string().min(1),
});

const secretSchema = z.object({ RuleID: z.string().min(1), Title: z.string().min(1) });

export const trivyImageOutputSchema = z.object({
    Results: z
        .object({
            Vulnerabilities: vulnerabilitySchema.array().optional(),
            Secrets: secretSchema.array().optional(),
        })
        .array()
        .optional(),
});

const localizableStringSchema = z.object({
    shouldTranslate: z.boolean().optional(),
    localizations: z.record(z.string(), z.unknown()).optional(),
});

export const stringsFileSchema = z.object({
    sourceLanguage: z.string().optional(),
    strings: z.record(z.string(), localizableStringSchema).optional(),
});

export const assetContentsSchema = z.object({
    images: z.object({ filename: z.string().optional() }).array().optional(),
});

const toolDeptrySchema = z.object({
    extend_exclude: z.string().array().default([]),
    known_first_party: z.string().array().default([]),
});

export const deptrySchema = z.object({
    project: z.object({ name: z.string().optional() }).default({}),
    tool: z
        .object({
            deptry: toolDeptrySchema.default({ extend_exclude: [], known_first_party: [] }),
        })
        .default({ deptry: { extend_exclude: [], known_first_party: [] } }),
});

const pydoclintSchema = z.object({ style: z.enum(DOCSTRING_STYLES).optional() });

const pydocstyleSchema = z.object({ convention: z.unknown().optional() });

const lintSchema = z.object({
    pydocstyle: pydocstyleSchema.default({}),
});

const ruffSchema = z.object({
    lint: lintSchema.default({ pydocstyle: {} }),
});

const toolSchema = z.object({
    pydoclint: pydoclintSchema.catchall(z.unknown()).default({}),
    ruff: ruffSchema.default({ lint: { pydocstyle: {} } }),
});

export const docstringStyleSchema = z.object({
    tool: toolSchema.default({ pydoclint: {}, ruff: { lint: { pydocstyle: {} } } }),
});

export const packageDescriptionSchema = z.object({
    targets: z
        .object({
            name: z.string().min(1),
            path: z.string(),
            type: z.string(),
            module_type: z.string(),
            sources: z.string().array(),
        })
        .array(),
});

const linesSchema = z.object({
    count: z.int().nonnegative(),
    covered: z.int().nonnegative(),
});

const summarySchema = z.object({
    lines: linesSchema,
});

const fileSchema = z.object({
    filename: z.string(),
    summary: summarySchema,
});

export const swiftCoverageSchema = z.object({
    data: z
        .object({
            files: fileSchema.array(),
        })
        .array(),
});

export const xccovSchema = z.object({
    targets: z.object({ name: z.string().min(1), lineCoverage: z.number().min(0).max(1) }).array(),
});

export const messagesSchema = z.record(z.string(), z.unknown());

const storageSchema = z.object({ buckets: z.record(z.string(), z.unknown()).optional() });

const edgeFunctionSchema = z.object({ entrypoint: z.string().optional(), import_map: z.string().optional() });

export const supabaseProjectFileSchema = z.object({
    storage: storageSchema.optional(),
    functions: z.record(z.string(), edgeFunctionSchema).optional(),
});

const startSchema = z.object({ line: z.int().positive() });

export const denoLintOutputSchema = z.object({
    diagnostics: z
        .object({
            filename: z.string(),
            code: z.string(),
            message: z.string(),
            range: z.object({
                start: startSchema,
            }),
        })
        .array(),
    errors: z.object({ file_path: z.string(), message: z.string() }).array(),
});
