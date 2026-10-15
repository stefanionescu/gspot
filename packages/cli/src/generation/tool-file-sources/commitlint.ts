import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import type { EmitInputs, ToolFileSource } from '#cli/types/generation/files.ts';
import { COMMITLINT_RULES, COMMITLINT_ERROR_SEVERITY } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Write the commitlint configuration from selected settings.
 *
 * @param root0 the values for this generated file.
 * @param root0.selection the selected scope and its settings.
 * @param root0.scopes the selected project scopes.
 *
 * @returns the generated configuration text.
 */
export function commitlintToolFile({ selection, scopes }: Pick<EmitInputs, 'selection' | 'scopes'>): ToolFileSource {
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
    const serialized = JSON.stringify(document, null, JSON_INDENT)
        .replaceAll('\u2028', String.raw`\u2028`)
        .replaceAll('\u2029', String.raw`\u2029`);
    return { content: `module.exports = ${serialized};`, document: document };
}
