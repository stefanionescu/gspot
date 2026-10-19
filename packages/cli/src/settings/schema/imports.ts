import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { nonemptyPaths } from '#cli/settings/schema/parts.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import type { ImportRule, WrittenImportRule } from '#cli/types/settings/imports.ts';

const importRuleSchema = z.strictObject({
    name: z.string().min(1).describe(SETTING_DECLARATIONS['import_rule.name'].description),
    paths: nonemptyPaths.describe(SETTING_DECLARATIONS['import_rule.paths'].description),
    can_also_import: z
        .array(z.string())
        .default([])
        .describe(SETTING_DECLARATIONS['import_rule.can_also_import'].description),
    can_import: z.array(z.string()).optional().describe(SETTING_DECLARATIONS['import_rule.can_import'].description),
} satisfies SchemaShape<ImportRule, WrittenImportRule>);

// Each rule names only declared rules, and lists them in can_import or can_also_import, never both.
function listImportRuleIssues(rules: ImportRule[]): SettingsError[] {
    const names = new Set(rules.map((rule) => rule.name));
    return rules.flatMap((rule, index) => [
        ...(rule.can_import !== undefined && rule.can_also_import.length > 0
            ? [
                  {
                      path: [index, 'can_import'],
                      message:
                          'Write can_import or can_also_import, not both: can_import already lists every allowed rule.',
                  },
              ]
            : []),
        ...(['can_also_import', 'can_import'] as const).flatMap((field) =>
            (rule[field] ?? []).flatMap((name, edge) =>
                names.has(name)
                    ? []
                    : [
                          {
                              path: [index, field, edge],
                              message: `There is no import rule named ${name}.`,
                          },
                      ],
            ),
        ),
    ]);
}

/** The [[import_rule]] records, each of which may name only import rules that exist. */
const importRulesSchema = z
    .array(importRuleSchema)
    .superRefine((rules, context) => {
        for (const { path, message } of listImportRuleIssues(rules))
            context.addIssue({ code: 'custom', path: [...path], message });
    })
    .default([])
    .meta({
        configurations: ['structure'],
        description:
            'Code may import its own files and the files of every import rule listed above it, never below. can_also_import names import rules listed below it, and can_import replaces the rules above with an exact list. When import rules exist, every code file belongs to one, apart from tests, tool settings files, scripts, and generated files.',
    });

export { importRulesSchema };
