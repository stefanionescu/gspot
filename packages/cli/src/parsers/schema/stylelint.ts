import { z } from 'zod';
import type { StylelintModule } from '#cli/types/parsers/stylelint.ts';
import { STYLELINT_RULE_NAMES_MODULE } from '#cli/config/parsers/stylelint.ts';

/** The exact installed standard preset and inherited native rule names. */
export const stylelintRuleNamesSchema = z.strictObject({
    package: z.literal(STYLELINT_RULE_NAMES_MODULE),
    version: z.string().min(1),
    source: z.literal('resolveConfig.rules'),
    rules: z.array(z.string().min(1)),
});

/** The installed public function the explicit maintenance command invokes. */
export const stylelintModuleSchema = z.object({
    default: z.custom<StylelintModule>(
        (value) =>
            value !== null &&
            (typeof value === 'function' || typeof value === 'object') &&
            typeof Reflect.get(value, 'resolveConfig') === 'function',
    ),
});

/** Rule values belong to Stylelint; capture consumes their names alone. */
export const stylelintConfigSchema = z.object({ rules: z.record(z.string(), z.unknown()) });
