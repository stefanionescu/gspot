import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { COMMITLINT_RULES, COMMITLINT_ERROR_SEVERITY } from '#cli/config/generation/tool-files.ts';

/**
 * Build the commitlint file from the settings.
 * @param context the tool file to build.
 * @returns the Commitlint rules with the allowed types and scopes of the repository.
 */
function buildCommitlintFile(context: ToolFileContext): string {
    const { selection } = context;
    const { scopes } = context.session;

    const { settings, rulesOff } = selection.view;
    const types = settings['tools.commitlint.types'] as string[];
    const named = settings['tools.commitlint.scopes'] as string[];
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
    for (const [name, value] of Object.entries(settings['tools.commitlint.rules'] as Record<string, unknown[]>))
        if (rules[name]?.[0] !== 0) rules[name] = [COMMITLINT_ERROR_SEVERITY, ...value];
    for (const name of rulesOff('commits/commitlint')) rules[name] = [0];
    const document = { rules };
    const serialized = JSON.stringify(document, null, JSON_INDENT);
    return `module.exports = ${serialized};`;
}

export { buildCommitlintFile };
