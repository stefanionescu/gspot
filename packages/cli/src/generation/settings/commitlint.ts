import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-view.ts';
import { COMMITLINT_RULES, COMMITLINT_ERROR_SEVERITY } from '#cli/config/generation/settings.ts';

/**
 * Build the commitlint file from the settings.
 *
 * @param context the tool file to build.
 * @returns the Commitlint rules with the allowed types and scopes of the repository.
 */
function buildCommitlintFile(context: ToolFileContext): string {
    const { scopes } = context.session;

    const types = getTable(context.selection.view, 'tools.commitlint').types;
    const named = getTable(context.selection.view, 'tools.commitlint').scopes;
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
    for (const [name, value] of Object.entries(getTable(context.selection.view, 'tools.commitlint').rules))
        if (rules[name]?.[0] !== 0) rules[name] = [COMMITLINT_ERROR_SEVERITY, ...value];
    for (const name of listIgnoredRules(context.selection, 'commits/commitlint')) rules[name] = [0];
    return JSON.stringify({ rules }, null, JSON_INDENT);
}

export { buildCommitlintFile };
