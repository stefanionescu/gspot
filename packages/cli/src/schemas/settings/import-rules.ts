import { z } from 'zod';
import type { SettingsError } from '#cli/types/settings/file.ts';
import { nonemptyPathsSchema } from '#cli/schemas/settings/fields.ts';
import type { ImportRule } from '#cli/types/settings/import-rules.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

const importRuleSchema = z.strictObject({
    name: z.string().min(1).meta(SETTING_DEFINITIONS['import_rule.name']),
    paths: nonemptyPathsSchema.meta(SETTING_DEFINITIONS['import_rule.paths']),
    can_import: z.string().array().optional().meta(SETTING_DEFINITIONS['import_rule.can_import']),
});

function validateImportRules(rules: ImportRule[]): SettingsError[] {
    const names = new Set(rules.map((rule) => rule.name));
    return rules.flatMap((rule, index) =>
        (rule.can_import ?? []).flatMap((name, edge) =>
            names.has(name)
                ? []
                : { path: [index, 'can_import', edge], message: `There is no import rule called ${name}.` },
        ),
    );
}

export const importRulesSchema = importRuleSchema
    .array()
    .superRefine((rules, context) => {
        for (const { path, message } of validateImportRules(rules))
            context.addIssue({ code: 'custom', path: [...path], message });
    })
    .default(SETTING_DEFINITIONS['import_rule'].default)
    .meta(SETTING_DEFINITIONS['import_rule']);
