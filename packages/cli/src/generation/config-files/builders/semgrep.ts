import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { buildAssetPath } from '#cli/system/assets.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';
import type { SemgrepDocument, PlannedConfigFile } from '#cli/types/generation/files.ts';

/**
 * Build a Semgrep config file: drop the rules whose packages the scope does not depend on, and point folder-limited rules
 * at the configured folders.
 *
 * @param planned the config file to build.
 * @returns the Semgrep rules as YAML.
 */
export function buildSemgrepFile(planned: PlannedConfigFile): string {
    const { scope, configFile } = planned;
    const { scopes } = planned.session;
    const { dependencyFiles } = planned.session.repository;
    const document = parse(
        readFileSync(buildAssetPath(`${planned.configuration.folder}/${configFile.source}`), 'utf8'),
    ) as SemgrepDocument;
    const scopeDependencies = new Set(listProjectDependencyNames(dependencyFiles, scope.folder.path));
    const conditions = configFile.rule_dependencies;
    const dropped =
        conditions === undefined
            ? []
            : Object.entries(conditions)
                  .filter(([, packages]) => !packages.some((name) => scopeDependencies.has(name)))
                  .map(([prefix]) => prefix);
    document.rules = document.rules.filter((rule) => !dropped.some((prefix) => rule.id.startsWith(prefix)));
    const setting = configFile.paths_setting;
    if (setting !== undefined) {
        const configuration = planned.configuration.name;
        const folders = scopes
            .filter(({ settings }) => settings.configurations.includes(configuration))
            .toSorted((left, right) => compareScopeDepth(left.folder.path, right.folder.path))
            .map(({ settings: { settings } }) => `/${String(settings[setting])}/**`);
        for (const rule of document.rules) if (rule.paths !== undefined) rule.paths.include = folders;
    }
    return stringify(document);
}
