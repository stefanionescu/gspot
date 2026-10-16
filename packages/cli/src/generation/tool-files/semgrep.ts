import { parse, stringify } from 'yaml';
import { readAsset } from '#cli/system/assets.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { getProjectDependencies } from '#cli/repository/dependency-files.ts';
import { gitignorePatterns, moveIgnorePatterns } from '#cli/generation/ignore-files.ts';
import { type SemgrepDocument, type ToolFileContext } from '#cli/types/generation/files.ts';
import { SEMGREP_IGNORED, SEMGREP_ENV_PATTERNS_INDEX } from '#cli/config/generation/tool-file-sources.ts';
/**
 * Build the selected Semgrep pack with its dependency and scope paths.
 * @param context the selected pack, dependencies, and repository scopes.
 * @returns the selected Semgrep rule pack text.
 */
function buildSemgrepFile(context: ToolFileContext): string {
    const { selection, scopes } = context;
    const { packageManifests } = context.session;
    const source = readAsset(`${context.manifest.dir}/${context.toolFile.source}`);
    const configuration = context.manifest.configuration.name;

    const scopeDependencies = Object.keys(getProjectDependencies(packageManifests, selection.scope.path));
    const document = parse(source) as SemgrepDocument;
    if (configuration === 'javascript' && !scopeDependencies.includes('jsonwebtoken'))
        document.rules = document.rules.filter((rule) => !rule.id.startsWith('gspot.javascript.jwt-'));
    if (configuration === 'supabase') {
        const functions = scopes
            .filter(({ view }) => view.configurations.includes('supabase'))
            .toSorted((left, right) => compareScopeDepth(left.scope.path, right.scope.path))
            .map(({ view: { settings } }) => `/${String(settings['supabase.functions_folder'])}/**`);
        for (const rule of document.rules) if (rule.paths !== undefined) rule.paths.include = functions;
    }
    return stringify(document).trimEnd();
}
/**
 * Build Semgrep ignore paths from the selected scope and explicit ignores.
 * @param context the selected scope and repository ignore paths.
 * @returns one ignored path per line.
 */
function buildSemgrepignore(context: ToolFileContext): string {
    const { ignoresFor } = context.selection.view;
    const scope = context.selection.scope.path;
    const ignoredPaths = gitignorePatterns(context.session);
    return (
        moveIgnorePatterns(
            [
                ...SEMGREP_IGNORED.slice(0, SEMGREP_ENV_PATTERNS_INDEX),
                ...ignoredPaths,
                ...SEMGREP_IGNORED.slice(SEMGREP_ENV_PATTERNS_INDEX),
                ...ignoresFor('security/semgrep')
                    .filter(({ rule }) => rule === undefined)
                    .flatMap(({ paths }) => paths),
            ],
            scope,
        ).join('\n') + '\n'
    );
}

export { buildSemgrepFile, buildSemgrepignore };
