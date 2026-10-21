// Reads the shipped lists of lint rule names that the tool files and explain use.
import { readAsset } from '#cli/system/assets.ts';
import type { LintRules } from '#cli/types/configurations.ts';
import { lintRulesSchema } from '#cli/schemas/configurations/lint-rules.ts';

/**
 * Read one shipped list of lint rule names.
 *
 * @param path the asset path of the list.
 * @returns the package and version the list comes from, and its rule names.
 */
export function readLintRules(path: string): LintRules {
    return lintRulesSchema.parse(JSON.parse(readAsset(path)));
}
