import { parse, stringify } from 'yaml';
import type { Session } from '#cli/types/planning.ts';
import { byScopeDepth, projectDependencies } from '#cli/repository/scopes.ts';
import type { EmitInputs, SemgrepDocument } from '#cli/types/generation/files.ts';
import { gitignorePatterns, scopeIgnorePatterns } from '#cli/generation/ignore-patterns.ts';
import { SEMGREP_IGNORED, SEMGREP_ENV_PATTERNS_INDEX } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Set dependency and folder values in a shipped Semgrep pack.
 *
 * @param source the source paths and dependency trees.
 * @param configuration the configuration name.
 * @param root0 the values for this generated file.
 * @param root0.selection the selected scope and its settings.
 * @param root0.scopes the selected project scopes.
 * @param root0.packageManifests the parsed package dependency files.
 *
 * @returns the generated configuration text.
 */
export function semgrepToolFile(
    source: string,
    configuration: string,
    {
        selection,
        scopes,
        packageManifests,
    }: Pick<EmitInputs, 'selection' | 'scopes'> & Pick<Session, 'packageManifests'>,
): string {
    const scopeDependencies = Object.keys(projectDependencies(packageManifests, selection.scope.path));
    const document = parse(source) as SemgrepDocument;
    if (configuration === 'javascript' && !scopeDependencies.includes('jsonwebtoken'))
        document.rules = document.rules.filter((rule) => !rule.id.startsWith('gspot.javascript.jwt-'));
    if (configuration === 'supabase') {
        const functions = scopes
            .filter(({ view }) => view.configurations.includes('supabase'))
            .toSorted((left, right) => byScopeDepth(left.scope.path, right.scope.path))
            .map(({ view: { settings } }) => `/${String(settings['supabase.functions_folder'])}/**`);
        for (const rule of document.rules) if (rule.paths !== undefined) rule.paths.include = functions;
    }
    return stringify(document).trimEnd();
}

/**
 * Write the semgrepignore configuration from selected settings.
 *
 * @param input the source values.
 *
 * @returns the generated configuration text.
 */
export function semgrepignoreToolFile(
    input: Pick<EmitInputs, 'selection' | 'scopes'> & Pick<Session, 'root' | 'reads' | 'repository'>,
): string {
    const { ignoresFor } = input.selection.view;
    const scope = input.selection.scope.path;
    const ignoredPaths = gitignorePatterns(input);
    return (
        [
            ...SEMGREP_IGNORED.slice(0, SEMGREP_ENV_PATTERNS_INDEX),
            ...ignoredPaths,
            SEMGREP_IGNORED[SEMGREP_ENV_PATTERNS_INDEX],
            ...scopeIgnorePatterns(
                ignoresFor('security/semgrep')
                    .filter(({ rule }) => rule === undefined)
                    .flatMap(({ paths }) => paths),
                scope,
            ),
        ].join('\n') + '\n'
    );
}
