import { z } from 'zod';
import { isTable } from '#cli/system/tables.ts';
import { quoteArgument } from '#cli/system/text.ts';

function formatRuleHelp(issue: z.core.$ZodIssue, checkId: string): string {
    if (issue.code === 'invalid_key') return issue.issues.map(({ message }) => message).join(' ');
    const path = issue.path;
    const rule = path[path.indexOf('rules') + 1];
    const quoted = quoteArgument(String(rule));
    return `This table holds options only, without a severity; the level decides which rules run. To turn ${quoted} off, run gspot ignore ${checkId} --rule ${quoted} --reason "<why>".`;
}

/**
Validate each rule with one refusal while retaining its published value schema.

@param schema the accepted rule names and option values.
@param checkId the check whose ignore command accepts a refusal.
@returns the rule table schema with one issue per invalid rule.
*/
export function buildRuleTableSchema<Schema extends z.ZodType>(
    schema: Schema,
    checkId: string,
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
                    message: formatRuleHelp({ ...issue, path: ['rules', rule] }, checkId),
                });
            }
        }
        return table;
    }, schema);
}
