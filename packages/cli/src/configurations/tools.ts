import { z } from 'zod';
import { commandSchema } from '#cli/configurations/command-schema.ts';
import { MAX_EXIT_CODE, TOOL_PLATFORMS } from '#cli/constants/configurations.ts';

const installerDefinition = z.strictObject({ name: z.string(), version: z.string() });
const installerSchema = z.union([z.string(), installerDefinition]);
const npmInstallerSchema = z.union([
    z.string(),
    installerDefinition.extend({ version_exit_code: z.number().int().min(0).max(MAX_EXIT_CODE).optional() }),
]);

const installerFields = {
    npm: npmInstallerSchema.optional(),
    pypi: installerSchema.optional(),
    mise: installerSchema.optional(),
    brew: installerSchema.optional(),
    apt: installerSchema.optional(),
    cargo: installerSchema.optional(),
    github: installerSchema.optional(),
    winget: installerSchema.optional(),
    scoop: installerSchema.optional(),
};

const suppressionPattern = z
    .string()
    .min(1)
    .refine((value) => {
        try {
            new RegExp(value, 'u');
            return true;
        } catch {
            return false;
        }
    }, 'Expected a valid Unicode regular expression.');

export const toolSchema = z.strictObject({
    name: z.string(),
    kind: z.enum(['binary', 'library']).default('binary'),
    version: z.string().optional(),
    floor: z.string().optional(),
    provider: z.literal('host').optional(),
    // The platforms the tool has a build for; unset means every platform.
    platforms: z.array(z.enum(TOOL_PLATFORMS)).min(1).optional(),
    version_command: commandSchema.optional(),
    version_exit_code: z.number().int().min(0).max(MAX_EXIT_CODE).optional(),
    version_regex: z.string().optional(),
    // Output that means the tool fell over rather than found something, for every check that runs it.
    crash_pattern: suppressionPattern.optional(),
    // Where the tool documents one rule; explain prints it with the rule name in place of `{rule}`.
    rule_page: z.string().includes('{rule}', { message: 'A rule page names where {rule} goes.' }).optional(),
    suppression: z
        .strictObject({
            marker: suppressionPattern,
            inline_marker: suppressionPattern.optional(),
            reason: suppressionPattern,
            forbidden: z.boolean().optional(),
        })
        .optional(),
    env: z.record(z.string(), z.string()).optional(),
    query_packs: z.record(z.string().regex(/^[a-z][a-z0-9-]*$/u), z.string().regex(/^\d+\.\d+\.\d+$/u)).optional(),
    prettier: z
        .strictObject({
            entry: z.string().min(1),
            overrides: z
                .array(z.strictObject({ files: z.string().min(1), options: z.record(z.string(), z.unknown()) }))
                .default([]),
        })
        .optional(),
    takeover: z
        .array(
            z
                .strictObject({
                    file: z.string().min(1),
                    table: z.string().min(1).optional(),
                    key: z.string().min(1).optional(),
                    shared: z.boolean().default(false),
                    check: z.string().min(1).optional(),
                    carries: z.enum([
                        'ignore-paths',
                        'rules-table',
                        'words',
                        'advisories',
                        'licenses',
                        'eslint-config',
                    ]),
                })
                .superRefine((row, context) => {
                    if (row.key !== undefined && row.table !== undefined)
                        context.addIssue({
                            code: 'custom',
                            message: 'A takeover row selects either a key or a table.',
                        });
                    if ((row.key !== undefined || row.table !== undefined) && !row.shared)
                        context.addIssue({
                            code: 'custom',
                            message: 'A selected key or table must preserve its shared file.',
                        });
                }),
        )
        .optional(),
    ...installerFields,
});

export const INSTALLER_KEYS = Object.keys(installerFields) as (keyof typeof installerFields)[];
