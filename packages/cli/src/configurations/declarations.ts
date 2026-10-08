// Validated configuration declarations and their shipped rule assets.
import { posix } from 'node:path';
import { listAssets } from '#cli/platform/assets.ts';
import type { FileDeclaration } from '#cli/types/repository/inventory.ts';
import { CONFIG_PREFIX, CONFIGURATION_RULES_FOLDER } from '#cli/config/configurations.ts';
import type { Manifest, OwnedCheck, RuleSource, ToolFileDeclaration } from '#cli/types/configurations.ts';

/**
 * Every declared check by ID, with the configuration that ships it. Borrowed checks retain their original owner.
 * @param manifests the manifests to index
 * @returns the declared checks by ID
 */
export function allChecks(manifests: Iterable<Manifest>): Map<string, OwnedCheck> {
    const checks = new Map<string, OwnedCheck>();
    for (const manifest of manifests) {
        const owned = manifest.checks.filter((check) => !manifest.configuration.borrowed_checks.includes(check.name));
        for (const check of owned) {
            if (checks.has(check.name)) throw new Error(`Duplicate check identity: ${check.name}`);
            checks.set(check.name, { check, configuration: manifest });
        }
    }
    return checks;
}

/**
 * The repository-relative path of a tool file generated for a scope.
 * @param scope the scope path, empty for the root
 * @param toolFile the tool-file declaration
 * @returns the path of the generated tool file
 */
export function targetInScope(scope: string, toolFile: ToolFileDeclaration): string {
    if (scope === '' || !toolFile.scoped) return toolFile.target;
    if (toolFile.target.startsWith(CONFIG_PREFIX))
        return posix.join(CONFIG_PREFIX, scope, toolFile.target.slice(CONFIG_PREFIX.length));
    return `${scope}/${toolFile.target}`;
}

/**
 * The name a `{tool_file:<name>}` placeholder uses for a tool file.
 * @param target the target path
 * @returns the file name under .gspot/config without its extensions
 */
export function toolFileName(target: string): string {
    const bare = target.startsWith(CONFIG_PREFIX) ? target.slice(CONFIG_PREFIX.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}

/**
 * The files of a configuration's rules folder. Each installs under the configuration's category and name, as language/bash/BASH.md.
 * @param manifest the configuration
 * @returns each file with its path inside the rules folder
 */
export function configurationFiles(manifest: Manifest): RuleSource[] {
    const { kind, name } = manifest.configuration;
    const sources = listAssets(`${manifest.dir}/${CONFIGURATION_RULES_FOLDER}/`);
    return sources.map((source) => ({
        source,
        path: `${kind}/${name}/${posix.relative(manifest.dir + '/' + CONFIGURATION_RULES_FOLDER, source)}`,
    }));
}

/**
 * Resolve authored declarations and generated paths of the configurations each scope selects.
 * @param declarations the authored file declarations
 * @param selected the actual manifests selected by each authored scope
 * @returns file declarations with internal configuration origins retained
 */
export function fileDeclarations(
    declarations: FileDeclaration[],
    selected: Map<string, Manifest[]>,
): FileDeclaration[] {
    return [
        ...declarations.filter((entry) => entry.kind !== 'generated' || entry.configuration === undefined),
        ...selected.entries().flatMap(([path, manifests]) =>
            manifests.flatMap(({ generated, configuration }) =>
                generated.length === 0
                    ? []
                    : [
                          {
                              kind: 'generated' as const,
                              configuration: configuration.name,
                              paths: generated.map((file) => posix.join(path, file)),
                          },
                      ],
            ),
        ),
    ];
}

/**
 * The selected Semgrep packs and repository rule paths for one scope.
 * @param selected the configurations this scope selects
 * @param scope the repository-relative scope path
 * @param authored the resolved repository rule paths
 * @returns the required native rule paths, relative to the repository
 */
export function semgrepRuleFiles(selected: Manifest[], scope: string, authored: string[]): string[] {
    const declared = selected.flatMap((manifest) =>
        manifest.toolFiles
            .filter((file) => file.tool.includes('semgrep') && file.rule_keys?.includes('rules') === true)
            .map((file) => targetInScope(scope, file)),
    );
    return [...new Set([...declared, ...authored])];
}
