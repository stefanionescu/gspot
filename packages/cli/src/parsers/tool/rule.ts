import { ruffRuleSchema } from '#cli/parsers/schema/tool-rule.ts';

/**
 * Summarize the Ruff reported rule metadata after validating the JSON response.
 * @param text the native rule response
 * @returns the nonempty rule name and summary joined for display
 */
export function parseRuffRuleSummary(text: string): string {
    const parsed = ruffRuleSchema.parse(JSON.parse(text));
    const parts = [parsed.name, parsed.summary].filter((part) => part !== undefined && part !== '');
    return parts.join(': ');
}
