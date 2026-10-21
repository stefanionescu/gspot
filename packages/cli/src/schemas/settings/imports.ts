import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { nonemptyPaths } from '#cli/schemas/settings/parts.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import type { ImportRule, WrittenImportRule } from '#cli/types/settings/imports.ts';

const importRuleSchema = z.strictObject({
    name: z.string().min(1).describe(SETTING_DECLARATIONS['import_rule.name'].description),
    paths: nonemptyPaths.describe(SETTING_DECLARATIONS['import_rule.paths'].description),
    can_import: z.array(z.string()).optional().describe(SETTING_DECLARATIONS['import_rule.can_import'].description),
} satisfies SchemaShape<ImportRule, WrittenImportRule>);

function listImportRuleIssues(rules: ImportRule[]): SettingsError[] {
    const names = new Set(rules.map((rule) => rule.name));
    return rules.flatMap((rule, index) =>
        (rule.can_import ?? []).flatMap((name, edge) =>
            names.has(name)
                ? []
                : [{ path: [index, 'can_import', edge], message: `There is no import rule named ${name}.` }],
        ),
    );
}

const importRulesSchema = z
    .array(importRuleSchema)
    .superRefine((rules, context) => {
        for (const { path, message } of listImportRuleIssues(rules))
            context.addIssue({ code: 'custom', path: [...path], message });
    })
    .default(SETTING_DECLARATIONS['import_rule'].default)
    .meta(SETTING_DECLARATIONS['import_rule']);

export { importRulesSchema };
