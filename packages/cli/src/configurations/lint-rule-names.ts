// Reads the shipped lists of lint rule names that the tool files and explain use.
import { z } from 'zod';
import { readAsset } from '#cli/system/assets.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { LintRuleNames } from '#cli/types/configurations.ts';

const lintRuleNamesSchema = z.strictObject({
    package: z.string().min(1),
    version: z.string().min(1),
    source: z.string().min(1),
    rules: z.array(z.string().min(1)),
} satisfies SchemaShape<LintRuleNames>) satisfies z.ZodType<LintRuleNames>;

/**
 * Read one shipped list of lint rule names.
 *
 * @param path the asset path of the list.
 * @returns the package and version the list comes from, and its rule names.
 */
export function readLintRuleNames(path: string): LintRuleNames {
    return lintRuleNamesSchema.parse(JSON.parse(readAsset(path)));
}
