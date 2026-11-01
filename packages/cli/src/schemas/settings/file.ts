import { z } from 'zod';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { levelSchema, commandCheckFields } from '#cli/schemas/manifests/fields.ts';
import { toolsSchema as publicToolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import { DEVICE_NAME, UNSAFE_PATH_END, UNSAFE_CHARACTERS, RESERVED_SEGMENTS } from '#cli/config/system/files.ts';
import { ciSchema, hooksSchema, rulesSchema, namingSchema, importRulesSchema } from '#cli/schemas/settings/settings.ts';

import {
    formatSchema,
    relativePathSchema,
    nonemptyPathsSchema,
    removedConfigurationsSchema,
} from '#cli/schemas/settings/fields.ts';
import {
    LEVEL_SUMMARY,
    COMMAND_CHECK_ID,
    ALL_LEVEL_SUMMARY,
    GSPOT_FOLDER_PATH,
    SETTINGS_EXAMPLES,
    TABLE_DESCRIPTIONS,
    SCOPE_PATH_MESSAGES,
    NO_CHECK_RULE_MESSAGE,
    NO_CHECK_PATHS_MESSAGE,
} from '#cli/config/settings/settings.ts';

export const ignoreSchema = z
    .strictObject({
        check: z.string().optional().meta({
            description:
                'The check whose findings you accept: a shipped check or a command check. Leave it out to keep the paths out of every check.',
        }),
        rule: z.string().optional().meta({
            description: 'One lint rule of that check.',
        }),
        paths: nonemptyPathsSchema.optional().meta({
            description: 'Where the ignore applies.',
        }),
        reason: z.string({ error: 'needs a reason. Add reason = "..." to this record.' }).meta({
            description: 'Why you accept the findings.',
        }),
    })
    .superRefine((ignore, context) => {
        if (ignore.check !== undefined) {
            return;
        }
        if (ignore.paths === undefined)
            context.addIssue({ code: 'custom', path: ['paths'], message: NO_CHECK_PATHS_MESSAGE });
        if (ignore.rule !== undefined)
            context.addIssue({
                code: 'custom',
                path: ['rule'],
                message: NO_CHECK_RULE_MESSAGE,
            });
    });

export const commandCheckSchema = z.strictObject({
    id: z.string().regex(COMMAND_CHECK_ID, 'Use a check ID without whitespace or commas.').meta({
        description: 'The check ID that `--only` and `[[ignore]] check` use, which may not match a shipped check.',
    }),
    command: commandCheckFields.command.unwrap().meta({
        description: 'The executable and arguments to run on selected files.',
    }),
    paths: nonemptyPathsSchema.meta({
        description: 'The files the check reads, as repository-relative globs.',
    }),
    outputs: nonemptyPathsSchema.optional().meta({
        description:
            'The files that the command writes. With outputs, the check runs the command in a copy and reports each output that differs from the committed file.',
    }),
    stage: commandCheckFields.stage.exclude(['message']).meta({
        description: 'The earliest stage that runs this check.',
    }),
    summary: commandCheckFields.summary.meta({
        description: 'A short description shown in check listings.',
    }),
    help: commandCheckFields.help.meta({
        description: 'Instructions for resolving findings.',
    }),
    fix: commandCheckFields.fix.meta({
        description: 'The executable and arguments that correct findings.',
    }),
    exit_codes: commandCheckFields.exit_codes.meta({
        description:
            'Nonzero statuses that mean findings from command and fix. Other nonzero statuses mean execution failure.',
    }),
    output: commandCheckFields.output.meta({
        description: 'The parser and location patterns used to read findings.',
    }),
});

const { structure: rootStructure, ...scopeTables } = configurationTableSchemas;

const rootBody = {
    ...scopeTables,
    tools: publicToolsSchema.optional(),
};

const scopeBody = {
    ...rootBody,
    dependencies: configurationTableSchemas.dependencies.unwrap().omit({ min_release_age_days: true }).optional(),
    prose: configurationTableSchemas.prose.unwrap().omit({ banned_headings: true }).optional(),
    coverage: z
        .strictObject({
            lines: configurationTableSchemas.coverage.unwrap().shape.lines,
            branches: configurationTableSchemas.coverage.unwrap().shape.branches,
            functions: configurationTableSchemas.coverage.unwrap().shape.functions,
            statements: configurationTableSchemas.coverage.unwrap().shape.statements,
        })
        .optional(),
    licenses: configurationTableSchemas.licenses.unwrap().omit({ allowed_package: true }).optional(),
    naming: namingSchema.omit({ override: true }).optional(),
    structure: rootStructure.unwrap().pick({ environment_readers: true }).optional(),
    format: formatSchema.omit({ override: true }).optional(),
    tools: publicToolsSchema
        .omit({ v8r: true })
        .extend({
            eslint: publicToolsSchema.shape.eslint
                .unwrap()
                .omit({ override: true })
                .optional()
                .describe(publicToolsSchema.shape.eslint.description as string),
        })
        .optional(),
};

for (const [name, schema] of Object.entries(scopeBody)) {
    const description = TABLE_DESCRIPTIONS[name];
    if (description !== undefined) z.globalRegistry.add(schema, { ...schema.meta(), description });
}

export const scopeSchema = z.strictObject({
    path: relativePathSchema
        .refine(
            (path) =>
                stripTrailingSlashes(path)
                    .split('/')
                    .every(
                        (segment) =>
                            !RESERVED_SEGMENTS.has(segment) &&
                            !UNSAFE_CHARACTERS.test(segment) &&
                            !UNSAFE_PATH_END.test(segment) &&
                            !DEVICE_NAME.test(segment),
                    ),
            SCOPE_PATH_MESSAGES.portable,
        )
        .refine((path) => !GSPOT_FOLDER_PATH.test(path.normalize('NFC')), SCOPE_PATH_MESSAGES.gspot)
        .meta({
            description: 'The folder of the scope; no two records may name the same folder.',
        }),
    configurations: z
        .string()
        .array()
        .default([] as [])
        .meta({
            description:
                'Configurations for this folder, on top of the root ones; `gspot add --scope` writes this list.',
        }),
    removed_configurations: removedConfigurationsSchema.prefault({}).meta({
        reason_when: 'adding',
        description:
            'Configurations removed in this folder, each with the reason why; only `gspot add` and `gspot remove` write this table.',
    }),
    test_files: relativePathSchema.array().optional().meta({
        description: 'More test files for this folder, added to the root list.',
    }),
    ...scopeBody,
});

export const rootSettingSchemas = {
    level: levelSchema.default('basic').meta({
        description: `${LEVEL_SUMMARY} ${ALL_LEVEL_SUMMARY} No level turns on experimental or preview lint rules.`,
    }),
    tool_timeout_seconds: z.number().int().positive().default(600).meta({
        description:
            'The time limit in seconds for every tool command, including installation and version reads. Root only.',
    }),
    test_files: relativePathSchema
        .array()
        .default([
            '**/test/**',
            '**/tests/**',
            '**/__tests__/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/test_*.py',
            '**/*_test.py',
            '**/conftest.py',
            '**/Tests/**',
            '**/*Tests.swift',
        ] as [
            '**/test/**',
            '**/tests/**',
            '**/__tests__/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/test_*.py',
            '**/*_test.py',
            '**/conftest.py',
            '**/Tests/**',
            '**/*Tests.swift',
        ])
        .meta({
            description: 'Test files. Linters apply their test rules to these files.',
        }),
};

export const settingsSchema = z
    .strictObject({
        ...rootSettingSchemas,
        configurations: z
            .string()
            .array()
            .default([] as [])
            .meta({
                description:
                    'The configurations this repository uses besides the always-selected ones. `gspot init` writes the detected ones here; `gspot add` and `gspot remove` change the list.',
            }),
        removed_configurations: removedConfigurationsSchema.prefault({}).meta({
            reason_when: 'adding',
            description:
                'Configurations you removed, each with the reason why, which detection does not add back; only `gspot add` and `gspot remove` write this table.',
        }),
        scope: scopeSchema.array().optional(),
        ...rootBody,
        import_rule: importRulesSchema,
        ignore: ignoreSchema.array().optional(),
        command_check: commandCheckSchema.array().optional(),
        format: formatSchema.prefault({}),
        limits: limitsSchema.prefault({}),
        naming: namingSchema.prefault({}),
        structure: rootStructure.unwrap().prefault({}),
        hooks: hooksSchema.optional(),
        ci: ciSchema.optional(),
        rules: rulesSchema.prefault({}),
    })
    .superRefine((written, context) => {
        const records = [
            {
                key: 'import_rule',
                field: 'name',
                names: written.import_rule.map((rule) => rule.name),
            },
            {
                key: 'scope',
                field: 'path',
                names: (written.scope ?? []).map((scope) =>
                    stripTrailingSlashes(scope.path).normalize('NFC').toLowerCase(),
                ),
            },
            {
                key: 'command_check',
                field: 'id',
                names: (written.command_check ?? []).map((commandCheck) => commandCheck.id),
            },
        ];
        for (const { key, field, names } of records) {
            const seen = new Set<string>();
            for (const [index, name] of names.entries()) {
                if (seen.has(name))
                    context.addIssue({
                        code: 'custom',
                        path: [key, index, field],
                        message: `Two [[${key}]] records name ${name}. Keep one.`,
                    });
                seen.add(name);
            }
        }
    })
    .meta({ examples: SETTINGS_EXAMPLES });

for (const [name, schema] of Object.entries(settingsSchema.shape)) {
    const description = TABLE_DESCRIPTIONS[name];
    if (description !== undefined) z.globalRegistry.add(schema, { ...schema.meta(), description });
}
