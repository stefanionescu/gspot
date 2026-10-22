import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { nonemptyPaths } from '#cli/schemas/settings/parts.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import type { ImportRule, WrittenImportRule } from '#cli/types/settings/import-rules.ts';

const importRuleSchema = z.strictObject({
    name: z.string().min(1).describe(SETTING_DEFINITIONS['import_rule.name'].description),
    paths: nonemptyPaths.describe(SETTING_DEFINITIONS['import_rule.paths'].description),
    can_import: z.array(z.string()).optional().describe(SETTING_DEFINITIONS['import_rule.can_import'].description),
} satisfies SchemaShape<ImportRule, WrittenImportRule>);

function validateImportRules(rules: ImportRule[]): SettingsError[] {
    const names = new Set(rules.map((rule) => rule.name));
    return rules.flatMap((rule, index) =>
        (rule.can_import ?? []).flatMap((name, edge) =>
            names.has(name)
                ? []
                : [{ path: [index, 'can_import', edge], message: `There is no import rule named ${name}.` }],
        ),
    );
}

export const importRulesSchema = z
    .array(importRuleSchema)
    .superRefine((rules, context) => {
        for (const { path, message } of validateImportRules(rules))
            context.addIssue({ code: 'custom', path: [...path], message });
    })
    .default(SETTING_DEFINITIONS['import_rule'].default)
    .meta(SETTING_DEFINITIONS['import_rule']);
