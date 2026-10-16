import { parse, stringify } from 'yaml';
import { readAsset } from '#cli/system/assets.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { getProjectDependencies } from '#cli/repository/dependency-files.ts';
import { type SemgrepDocument, type ToolFileContext } from '#cli/types/generation/files.ts';

/**
 * Build the selected Semgrep pack with its dependency and scope paths.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the selected Semgrep rules with paths relative to their configuration file.
 */
function buildSemgrepFile(context: ToolFileContext): string {
    const { selection, scopes } = context;
    const { dependencyFiles } = context.session;
    const source = readAsset(`${context.manifest.folder}/${context.toolFile.source}`);
    const configuration = context.manifest.configuration.name;

    const scopeDependencies = Object.keys(getProjectDependencies(dependencyFiles, selection.scope.path));
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

export { buildSemgrepFile };
