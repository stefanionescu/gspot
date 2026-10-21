import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import type { PlannedToolFile } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-view.ts';
import { COMMITLINT_RULES, COMMITLINT_ERROR_SEVERITY } from '#cli/config/generation/settings/builders/commitlint.ts';

/**
 * Build the commitlint file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the Commitlint rules with the allowed types and scopes of the repository.
 */
export function buildCommitlintFile(planned: PlannedToolFile): string {
    const { scopes } = planned.session;

    const types = getTable(planned.selection.view, 'tools.commitlint').types;
    const named = getTable(planned.selection.view, 'tools.commitlint').scopes;
    const allowed =
        named.length > 0
            ? named
            : scopes.filter(({ scope }) => scope.path !== '').map(({ scope }) => scope.path.split('/').at(-1));
    const rules: Record<string, readonly unknown[]> = {
        'type-enum': [COMMITLINT_ERROR_SEVERITY, 'always', types],
        ...COMMITLINT_RULES,
    };
    if (allowed.length > 0) {
        rules['scope-enum'] = [COMMITLINT_ERROR_SEVERITY, 'always', allowed];
        rules['scope-case'] = [0];
    }
    for (const [name, value] of Object.entries(getTable(planned.selection.view, 'tools.commitlint').rules))
        if (rules[name]?.[0] !== 0) rules[name] = [COMMITLINT_ERROR_SEVERITY, ...value];
    for (const name of listIgnoredRules(planned.selection, 'commits/commitlint')) rules[name] = [0];
    return JSON.stringify({ rules }, null, JSON_INDENT);
}
