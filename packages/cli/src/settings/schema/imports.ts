import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { nonemptyPaths } from '#cli/settings/schema/parts.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import type { ImportRule, WrittenImportRule } from '#cli/types/settings/imports.ts';

const importRuleSchema = z.strictObject({
    name: z.string().min(1).describe(SETTING_DECLARATIONS['import_rule.name'].description),
    paths: nonemptyPaths.describe(SETTING_DECLARATIONS['import_rule.paths'].description),
    can_also_import: z
        .array(z.string())
        .default([])
        .describe(SETTING_DECLARATIONS['import_rule.can_also_import'].description),
} satisfies SchemaShape<ImportRule, WrittenImportRule>);

/** The [[import_rule]] records, each of which may name only import rules that exist in can_also_import. */
const importRulesSchema = z
    .array(importRuleSchema)
    .superRefine((rules, context) => {
        const names = new Set(rules.map((rule) => rule.name));
        for (const [index, rule] of rules.entries())
            for (const [edge, name] of rule.can_also_import.entries()) {
                if (!names.has(name))
                    context.addIssue({
                        code: 'custom',
                        path: [index, 'can_also_import', edge],
                        message: `There is no import rule named ${name}.`,
                    });
            }
    })
    .default([])
    .meta({
        configurations: ['structure'],
        description:
            'Code may import its own files and the files of every import rule listed above it, never below. can_also_import names import rules listed below it.',
    });

export { importRulesSchema };
