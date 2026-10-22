import { z } from 'zod';
import { isTable } from '#cli/system/tables.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { RULE_TOKEN, RULE_OPTIONS_REFUSAL } from '#cli/config/settings/rule-tables.ts';

function formatRuleHelp(issue: z.core.$ZodIssue, check: string): string {
    const path = issue.path;
    const rule = path[path.indexOf('rules') + 1];
    const template =
        issue.code === 'invalid_key' ? issue.issues.map(({ message }) => message).join(' ') : RULE_OPTIONS_REFUSAL;
    return template.replaceAll(RULE_TOKEN, quoteArgument(String(rule))).replaceAll('{check}', check);
}

/**
 * Validate each rule with one refusal while retaining its published value schema.
 *
 * @param schema the accepted rule names and option values.
 * @param check the check whose ignore command accepts a refusal.
 * @returns the rule table schema with one issue per invalid rule.
 */
export function buildRuleTableSchema<Schema extends z.ZodType>(
    schema: Schema,
    check: string,
): z.ZodType<z.output<Schema>, z.input<Schema>> {
    return z.preprocess((table: z.input<Schema>, context) => {
        if (!isTable(table)) return table;
        for (const [rule, value] of Object.entries(table)) {
            const parsed = schema.safeParse({ [rule]: value });
            if (parsed.success) continue;
            for (const issue of parsed.error.issues.slice(0, 1)) {
                context.addIssue({
                    code: 'custom',
                    path: [rule],
                    message: formatRuleHelp({ ...issue, path: ['rules', rule] }, check),
                });
            }
        }
        return table;
    }, schema);
}
