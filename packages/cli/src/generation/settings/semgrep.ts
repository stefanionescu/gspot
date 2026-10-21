import { parse, stringify } from 'yaml';
import { readAsset } from '#cli/system/assets.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import { type SemgrepDocument, type ToolFileContext } from '#cli/types/generation/files.ts';

/**
 * Build the Semgrep pack with its dependency and scope paths.
 *
 * @param context the tool file to build.
 * @returns the Semgrep rules with paths relative to the tool file.
 */
function buildSemgrepFile(context: ToolFileContext): string {
    const { selection, toolFile } = context;
    const { scopes } = context.session;
    const { dependencyFiles } = context.session.repository;
    const document = parse(readAsset(`${context.manifest.folder}/${toolFile.source}`)) as SemgrepDocument;
    const scopeDependencies = new Set(listProjectDependencyNames(dependencyFiles, selection.scope.path));
    const conditions = toolFile.rule_dependencies;
    const dropped =
        conditions === undefined
            ? []
            : Object.entries(conditions)
                  .filter(([, packages]) => !packages.some((name) => scopeDependencies.has(name)))
                  .map(([prefix]) => prefix);
    document.rules = document.rules.filter((rule) => !dropped.some((prefix) => rule.id.startsWith(prefix)));
    const setting = toolFile.rule_paths_setting;
    if (setting !== undefined) {
        const configuration = context.manifest.configuration.name;
        const folders = scopes
            .filter(({ view }) => view.configurations.includes(configuration))
            .toSorted((left, right) => compareScopeDepth(left.scope.path, right.scope.path))
            .map(({ view: { settings } }) => `/${String(settings[setting])}/**`);
        for (const rule of document.rules) if (rule.paths !== undefined) rule.paths.include = folders;
    }
    return stringify(document);
}

export { buildSemgrepFile };
