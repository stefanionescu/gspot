import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-settings.ts';
import { COMMITLINT_RULES, COMMITLINT_ERROR_SEVERITY } from '#cli/config/generation/settings/builders/commitlint.ts';

/**
 * Build commitlint.json: the Commitlint rules with the allowed types and scopes of the repository.
 *
 * @param planned the tool file with its scope, level, and target path.
 * @returns the Commitlint rules with the allowed types and scopes of the repository.
 */
export function buildCommitlintFile(planned: PlannedToolFile): string {
    const { scopes } = planned.session;

    const types = getTable(planned.scope.settings, 'tools.commitlint').types;
    const named = getTable(planned.scope.settings, 'tools.commitlint').scopes;
    const allowed =
        named.length > 0
            ? named
            : scopes.filter(({ folder }) => folder.path !== '').map(({ folder }) => folder.path.split('/').at(-1));
    const rules: Record<string, readonly unknown[]> = {
        'type-enum': [COMMITLINT_ERROR_SEVERITY, 'always', types],
        ...COMMITLINT_RULES,
    };
    if (allowed.length > 0) {
        rules['scope-enum'] = [COMMITLINT_ERROR_SEVERITY, 'always', allowed];
        rules['scope-case'] = [0];
    }
    for (const [name, value] of Object.entries(getTable(planned.scope.settings, 'tools.commitlint').rules))
        if (rules[name]?.[0] !== 0) rules[name] = [COMMITLINT_ERROR_SEVERITY, ...value];
    for (const name of listIgnoredRules(planned.scope, 'commits/commitlint')) rules[name] = [0];
    return JSON.stringify({ rules }, null, JSON_INDENT);
}
